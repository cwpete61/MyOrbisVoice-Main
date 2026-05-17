/**
 * Lead engine service — the app-side half of the lead sourcing system.
 *
 * Talks to the `lead-engine` Python container (Google Places search + website
 * enrichment) over the internal Docker network, owns the LeadSearch / Lead
 * rows, manages per-partner search credits, and promotes accepted leads into
 * the partner CRM.
 *
 * Compliance wall: a scraped lead consented to nothing. promoteLead() creates
 * the Contact with source=SCRAPED_LEAD and born-opted-out of voice + SMS, so
 * the voice gateway and SMS service refuse it automatically. Cold email is the
 * only channel left open.
 */
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'
import * as crmService from './crm.service.js'
import { normalizePhoneE164 } from './contact.service.js'
import { getConfigValue, setConfigValue } from './system-config.service.js'

const LEADENGINE_URL = process.env['LEADENGINE_URL'] ?? 'http://lead-engine:7000'
const LEADENGINE_TOKEN = process.env['LEADENGINE_INTERNAL_TOKEN'] ?? ''

interface EngineLead {
  businessName?: string
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  rating?: number | null
  reviewCount?: number | null
  category?: string | null
  socials?: Record<string, string>
  score?: number
}

async function leadengineFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(`${LEADENGINE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(LEADENGINE_TOKEN ? { 'X-Internal-Token': LEADENGINE_TOKEN } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    throw new AppError('EXTERNAL_ERROR', `Lead engine unreachable: ${(err as Error).message}`, 502)
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AppError('EXTERNAL_ERROR', `Lead engine ${resp.status}: ${text.slice(0, 200)}`, 502)
  }
  return resp.json() as Promise<T>
}

/**
 * Partner CRM rows need a tenantId (Contact.tenantId is NOT NULL). Mirrors
 * partner-crm.ts: prefer a tenant that has hosted this partner's conversations,
 * else the platform demo tenant.
 */
async function resolveHostingTenantId(partnerId: string): Promise<string> {
  const recent = await prisma.conversation.findFirst({
    where: { partnerId },
    orderBy: { startedAt: 'desc' },
    select: { tenantId: true },
  })
  if (recent?.tenantId) return recent.tenantId

  const platform = await prisma.tenant.findFirst({
    where: { slug: 'orbis-platform' },
    select: { id: true },
  })
  if (platform) return platform.id

  const any = await prisma.tenant.findFirst({ select: { id: true } })
  if (!any) throw new AppError('SERVER_ERROR', 'No hosting tenant available for the lead engine', 500)
  return any.id
}

export async function getCredits(partnerId: string): Promise<number> {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: { leadSearchCredits: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)
  return partner.leadSearchCredits
}

/**
 * Submit a new lead search. Charges `count` credits up front (the unused
 * remainder is refunded when the search completes with fewer results).
 */
export async function createSearch(
  partnerId: string,
  input: { industry: string; location: string; count: number },
) {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: { leadSearchCredits: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)
  if (partner.leadSearchCredits < input.count) {
    throw new AppError(
      'FAILED_PRECONDITION',
      `Not enough lead credits — this search needs ${input.count}, you have ${partner.leadSearchCredits}.`,
      402,
    )
  }

  // Submit to the engine first — only charge + persist once it accepts the job.
  const job = await leadengineFetch<{ jobId: string }>('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  const [, search] = await prisma.$transaction([
    prisma.affiliateAccount.update({
      where: { id: partnerId },
      data: { leadSearchCredits: { decrement: input.count } },
    }),
    prisma.leadSearch.create({
      data: {
        partnerId,
        industry: input.industry,
        location: input.location,
        resultCount: input.count,
        status: 'RUNNING',
        externalJobId: job.jobId,
      },
    }),
  ])
  return search
}

/**
 * Poll the engine for a search's job. On completion, persists the Lead rows
 * (once) and refunds credits for the result shortfall. Safe to call on every
 * read — a no-op once the search is terminal.
 */
export async function syncSearch(searchId: string) {
  const search = await prisma.leadSearch.findUnique({ where: { id: searchId } })
  if (!search) throw new AppError('NOT_FOUND', 'Search not found', 404)
  if (search.status === 'COMPLETED' || search.status === 'FAILED' || !search.externalJobId) {
    return search
  }

  let job: { status: string; error?: string | null }
  try {
    job = await leadengineFetch(`/jobs/${search.externalJobId}`)
  } catch {
    return search // engine briefly unreachable — leave RUNNING, retry next poll
  }

  if (job.status === 'FAILED') {
    // Refund the full charge — the partner got nothing. The guarded
    // updateMany makes the transition + refund happen exactly once even if
    // two reads race.
    await prisma.$transaction(async (tx) => {
      const claim = await tx.leadSearch.updateMany({
        where: { id: searchId, status: { in: ['PENDING', 'RUNNING'] } },
        data: { status: 'FAILED', errorReason: (job.error ?? 'search failed').slice(0, 500) },
      })
      if (claim.count === 0) return // another caller already finalized this search
      await tx.affiliateAccount.update({
        where: { id: search.partnerId },
        data: { leadSearchCredits: { increment: search.resultCount } },
      })
    })
    return prisma.leadSearch.findUnique({ where: { id: searchId } })
  }

  if (job.status !== 'COMPLETED') {
    return search // still PENDING / RUNNING
  }

  // Fetch results outside the transaction (network call). The DB writes —
  // claim, persist leads, refund — run inside one transaction guarded by an
  // updateMany so concurrent reads can't double-insert leads or double-refund.
  const results = await leadengineFetch<{ leads: EngineLead[] }>(`/jobs/${search.externalJobId}/results`)
  const leads = results.leads ?? []
  const emailCount = leads.filter((l) => l.email).length
  const refund = Math.max(0, search.resultCount - leads.length)

  await prisma.$transaction(async (tx) => {
    const claim = await tx.leadSearch.updateMany({
      where: { id: searchId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'COMPLETED', leadCount: leads.length, emailCount },
    })
    if (claim.count === 0) return // another caller already finalized this search

    if (leads.length > 0) {
      await tx.lead.createMany({
        data: leads.map((l) => ({
          searchId,
          partnerId: search.partnerId,
          businessName: l.businessName || 'Unknown business',
          email: l.email ?? null,
          phone: l.phone ?? null,
          website: l.website ?? null,
          address: l.address ?? null,
          rating: l.rating ?? null,
          reviewCount: l.reviewCount ?? null,
          category: l.category ?? null,
          socialsJson: l.socials ?? {},
          score: l.score ?? 0,
        })),
      })
    }
    if (refund > 0) {
      await tx.affiliateAccount.update({
        where: { id: search.partnerId },
        data: { leadSearchCredits: { increment: refund } },
      })
    }
  })

  return prisma.leadSearch.findUnique({ where: { id: searchId } })
}

export async function listSearches(partnerId: string) {
  return prisma.leadSearch.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

/** A search plus its leads (best-scored first). Syncs the job first. */
export async function getSearchWithLeads(partnerId: string, searchId: string) {
  const owned = await prisma.leadSearch.findFirst({
    where: { id: searchId, partnerId },
    select: { id: true },
  })
  if (!owned) throw new AppError('NOT_FOUND', 'Search not found', 404)

  await syncSearch(searchId)

  const [search, leads] = await Promise.all([
    prisma.leadSearch.findUnique({ where: { id: searchId } }),
    prisma.lead.findMany({
      where: { searchId },
      orderBy: { score: 'desc' },
    }),
  ])
  return { search, leads }
}

/** Mark a lead SAVED or REJECTED. PROMOTED leads can't be re-reviewed. */
export async function reviewLead(
  partnerId: string,
  leadId: string,
  status: 'SAVED' | 'REJECTED',
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, partnerId },
    select: { id: true, reviewStatus: true },
  })
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found', 404)
  if (lead.reviewStatus === 'PROMOTED') {
    throw new AppError('CONFLICT', 'Lead is already promoted to a contact', 409)
  }
  return prisma.lead.update({ where: { id: leadId }, data: { reviewStatus: status } })
}

/**
 * Promote a lead into the partner CRM as a Contact in the "New Lead" stage.
 * The Contact is born opted-out of voice + SMS (compliance wall) — a scraped
 * lead never consented; cold email is the only channel left open.
 */
export async function promoteLead(partnerId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, partnerId } })
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found', 404)
  if (lead.reviewStatus === 'PROMOTED' && lead.promotedContactId) {
    throw new AppError('CONFLICT', 'Lead is already promoted', 409)
  }

  const hostingTenantId = await resolveHostingTenantId(partnerId)
  const now = new Date()

  const contact = await prisma.contact.create({
    data: {
      tenantId: hostingTenantId,
      partnerId,
      fullName: lead.businessName,
      email: lead.email,
      phoneE164: normalizePhoneE164(lead.phone) ?? null,
      addressLine1: lead.address,
      source: 'SCRAPED_LEAD',
      // Compliance wall — no consent on a scraped lead. Born opted-out of
      // voice + SMS; the voice gateway and SMS service refuse these. Cold
      // email stays open (optedOutEmail defaults false).
      optedOutSms: true,
      optedOutSmsAt: now,
      optedOutVoice: true,
      optedOutVoiceAt: now,
      metadataJson: {
        leadId: lead.id,
        website: lead.website,
        rating: lead.rating,
        category: lead.category,
        socials: lead.socialsJson ?? {},
      },
    },
  })

  await crmService.seedDefaultPipelineForPartner({ partnerId, hostingTenantId })
  await crmService.placeNewContactOnPipeline(
    { kind: 'partner', partnerId, hostingTenantId },
    contact.id,
  )

  await prisma.lead.update({
    where: { id: leadId },
    data: { reviewStatus: 'PROMOTED', promotedContactId: contact.id },
  })

  return contact
}

/**
 * Promote several leads at once — "send selected businesses to contacts".
 * Best-effort: each lead is promoted independently so one failure (e.g. an
 * already-promoted lead) doesn't abort the rest. Returns what landed and
 * what didn't.
 */
export async function promoteLeads(
  partnerId: string,
  leadIds: string[],
): Promise<{ promoted: string[]; failed: { leadId: string; reason: string }[] }> {
  const promoted: string[] = []
  const failed: { leadId: string; reason: string }[] = []
  for (const leadId of leadIds) {
    try {
      const contact = await promoteLead(partnerId, leadId)
      promoted.push(contact.id)
    } catch (err) {
      failed.push({ leadId, reason: (err as Error).message || 'promote failed' })
    }
  }
  return { promoted, failed }
}

// ── Credits administration ──────────────────────────────────────────────────

const DEFAULT_CREDITS_KEY = 'lead_engine.default_credits'
const FALLBACK_DEFAULT_CREDITS = 250

/** The credit allotment a partner is granted on approval. Admin-configurable;
 *  falls back to 250 when unset or malformed. */
export async function getDefaultCredits(): Promise<number> {
  const raw = await getConfigValue(DEFAULT_CREDITS_KEY)
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : FALLBACK_DEFAULT_CREDITS
}

export async function setDefaultCredits(value: number, updatedBy: string): Promise<void> {
  await setConfigValue(DEFAULT_CREDITS_KEY, String(value), false, updatedBy)
}

/** Admin override of one partner's remaining lead-search credits. */
export async function setPartnerCredits(partnerId: string, credits: number) {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: { id: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)
  return prisma.affiliateAccount.update({
    where: { id: partnerId },
    data: { leadSearchCredits: credits },
    select: { id: true, leadSearchCredits: true },
  })
}
