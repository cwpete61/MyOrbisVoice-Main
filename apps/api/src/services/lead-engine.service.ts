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
import { getConfigValue, setConfigValue, getOpenAiApiKey } from './system-config.service.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

const LEADENGINE_URL = process.env['LEADENGINE_URL'] ?? 'http://lead-engine:7000'
const LEADENGINE_TOKEN = process.env['LEADENGINE_INTERNAL_TOKEN'] ?? ''

interface EngineLead {
  businessName?: string
  ownerName?: string | null
  ownerTitle?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  rating?: number | null
  reviewCount?: number | null
  mapRank?: number | null
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
          ownerName: l.ownerName ?? null,
          ownerTitle: l.ownerTitle ?? null,
          email: l.email ?? null,
          phone: l.phone ?? null,
          website: l.website ?? null,
          address: l.address ?? null,
          latitude: l.latitude ?? null,
          longitude: l.longitude ?? null,
          rating: l.rating ?? null,
          reviewCount: l.reviewCount ?? null,
          mapRank: l.mapRank ?? null,
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

/** Render a CSV cell: RFC-4180 quoting, plus formula-injection defense.
 *  Lead data is scraped — a business could seed a name with `=`, `+`, `-`,
 *  `@`, tab, or CR that Excel/Sheets would execute on open — so a cell that
 *  starts with one of those is prefixed with an apostrophe. */
function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A search's leads as a CSV string (best-scored first). */
export async function exportSearchCsv(partnerId: string, searchId: string): Promise<string> {
  const search = await prisma.leadSearch.findFirst({
    where:  { id: searchId, partnerId },
    select: { id: true },
  })
  if (!search) throw new AppError('NOT_FOUND', 'Search not found', 404)

  const leads = await prisma.lead.findMany({
    where:   { searchId },
    orderBy: { score: 'desc' },
  })

  const header = [
    'Business', 'Owner', 'Title', 'Email', 'Phone', 'Website',
    'Address', 'Rating', 'Reviews', 'Map Rank', 'Category', 'Score', 'Status',
  ]
  const rows = leads.map((l) => [
    l.businessName, l.ownerName ?? '', l.ownerTitle ?? '', l.email ?? '', l.phone ?? '',
    l.website ?? '', l.address ?? '', l.rating ?? '', l.reviewCount ?? '',
    l.mapRank ?? '', l.category ?? '', l.score, l.reviewStatus,
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Set a lead's review status (NEW lets the partner un-save / un-reject).
 *  PROMOTED leads can't be re-reviewed. */
export async function reviewLead(
  partnerId: string,
  leadId: string,
  status: 'NEW' | 'SAVED' | 'REJECTED',
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

/**
 * Generate a personalized cold-email opening paragraph for a lead. On-demand
 * and stateless — nothing is persisted; the partner copies the text. The
 * prompt forbids invented facts, hype, false urgency, and guarantees, in line
 * with the platform's prohibited-language rules.
 */
export async function generateEmailIntro(
  partnerId: string,
  leadId: string,
): Promise<{ intro: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, partnerId } })
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found', 404)

  const apiKey = await getOpenAiApiKey()
  if (!apiKey) throw new AppError('NOT_CONFIGURED', 'OpenAI API key is not configured', 503)

  const facts = [
    `Business: ${lead.businessName}`,
    lead.category ? `Type: ${lead.category}` : null,
    lead.address ? `Location: ${lead.address}` : null,
    lead.ownerName ? `Owner/contact: ${lead.ownerName}${lead.ownerTitle ? `, ${lead.ownerTitle}` : ''}` : null,
    lead.rating != null ? `Google rating: ${lead.rating} (${lead.reviewCount ?? 0} reviews)` : null,
    lead.website ? `Website: ${lead.website}` : null,
  ].filter(Boolean).join('\n')

  const system =
    'You write the opening paragraph of a cold outreach email for a sales partner. ' +
    'One short paragraph, 2-3 sentences. Warm, specific, professional. Reference a ' +
    'concrete detail about the business so it reads as researched, not mass-sent. ' +
    'Address the owner by first name when one is given. Never invent facts, prices, ' +
    'or claims. No hype, no false urgency, no guarantees. Output only the paragraph — ' +
    'no subject line, no greeting line, no sign-off.'
  const user = `Write the opening paragraph for an outreach email to this business:\n\n${facts}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let res: Response
  try {
    res = await fetch(OPENAI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens:  220,
        temperature: 0.8,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    throw new AppError('EXTERNAL_ERROR', isAbort ? 'AI timed out — try again.' : 'Could not reach the AI service.', 502)
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new AppError('EXTERNAL_ERROR', `AI service returned ${res.status}.`, 502)
  }
  const json = await res.json().catch(() => null) as
    { choices?: Array<{ message?: { content?: string } }> } | null
  const intro = json?.choices?.[0]?.message?.content?.trim()
  if (!intro) throw new AppError('EXTERNAL_ERROR', 'AI returned an empty response.', 502)
  return { intro }
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
