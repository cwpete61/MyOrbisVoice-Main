/**
 * MyOrbisAgents custom agent demo (Lane C).
 *
 * An admin pastes an agent's details + 3 listing blurbs on /admin/agent-demos.
 * We provision a per-agent DEMO tenant (isDemo=true, demoKind=AGENT so the
 * money-guard applies but demo-reset never wipes it), give it Orby (DNA templated
 * from the paste) + the 3 listings, score the agent for a recommended tier, then
 * enrich the listings in the background so Orby can answer area questions.
 *
 *   paste ─▶ provisionAgentDemoTenant ─▶ AgentDemo row (GENERATING)
 *                                          │
 *                              background enrich ×3 ─▶ status READY
 *                                          │
 *                              admin reviews ─▶ Send (Lane D) ─▶ SENT
 *                                          │
 *                              agent claims promo ─▶ CLAIMED (Lane B)
 *
 * The demo tenant CONVERTS IN PLACE to a paid account on claim — DNA + listings
 * carried over — so nothing here is throwaway.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { provisionAgentOrby, type AgentIntake } from './agent-onboarding.service.js'
import { applyDemoEntitlements } from './demo.service.js'
import { updateChannel } from './channel.service.js'
import { formatListing, createListing } from './listing.service.js'
import { enrichListing } from './listing-enrichment.service.js'
import { scoreProspect } from './prospect-scorer.service.js'

/** Demo link lifetime before it lapses (unclaimed). */
const DEMO_TTL_DAYS = 7

export interface CreateAgentDemoInput {
  agentName:    string
  brokerage?:   string
  market:       string
  agentEmail:   string
  agentPhone?:  string   // any format; normalized to E.164-ish for caller-ID match
  specialties?: string
  listings:     string[] // up to 3 pasted blurbs
  avgPriceUsd?: number   // optional — feeds the tier scorer
  salesLast12?: number   // optional — feeds the tier scorer
  createdById:  string   // the admin who created it (provisioning actor)
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'agent'
}

/** Strip a US phone to digits and prefix +1 so it matches Twilio's `From`. */
export function normalizePhone(raw?: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return digits ? `+${digits}` : null
}

function gen6(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10)
  return s
}

/**
 * Provision a per-agent demo tenant with Orby + listings, create the AgentDemo
 * row, and kick off background enrichment. Returns the AgentDemo (status
 * GENERATING; flips to READY when enrichment finishes).
 */
export async function createAgentDemo(input: CreateAgentDemoInput) {
  const blurbs = input.listings.map(l => l.trim()).filter(Boolean).slice(0, 3)
  if (blurbs.length === 0) throw new AppError('VALIDATION_ERROR', 'At least one listing is required', 422)

  // 1. The per-agent demo tenant. isDemo=true (money-guard) + demoKind=AGENT
  //    (excluded from demo-reset + the shared-line inbound fallback).
  const slug = `agentdemo-${slugify(input.agentName)}-${Date.now().toString(36)}`
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      displayName:       `${input.agentName} — MyOrbisAgents Demo`,
      registrationEmail: input.agentEmail,
      status:            'TRIAL',
      isDemo:            true,
      demoKind:          'AGENT',
      industryVertical:  'REAL_ESTATE',
    },
  })
  await applyDemoEntitlements(tenant.id)

  // 2. Orby brain from the paste. provisionAgentOrby mints a UNIQUE per-tenant
  //    widget publicKey (unlike the shared sandbox), which the microsite embeds.
  const intake: AgentIntake = {
    agentName:     input.agentName,
    brokerage:     input.brokerage,
    market:        input.market,
    specialties:   input.specialties,
    listingsBrief: blurbs.map(b => b.replace(/\s+/g, ' ').slice(0, 160)).join(' | '),
    language:      'bilingual',
  }
  const orby = await provisionAgentOrby(tenant.id, input.createdById, intake)

  // 3. Inbound channel on so the caller-ID-routed phone demo can connect.
  await updateChannel(tenant.id, 'INBOUND', { isEnabled: true }).catch(() => {})

  // 4. The 3 listings — AI-format each blurb, fall back to raw text on failure.
  for (const blurb of blurbs) {
    const draft = await formatListing(blurb).catch(() => null)
    const data = draft ?? {
      address: blurb.slice(0, 120), headline: null, priceUsd: null, beds: null, baths: null,
      sqft: null, propertyType: null, description: blurb, highlights: [] as string[],
    }
    await createListing(tenant.id, { ...data, rawText: blurb }).catch(() => {})
  }

  // 5. Tier recommendation.
  const scored = scoreProspect({
    name: input.agentName, brokerage: input.brokerage ?? null, market: input.market,
    email: input.agentEmail, phone: input.agentPhone ?? null,
    avgPriceUsd: input.avgPriceUsd ?? null, salesLast12: input.salesLast12 ?? null,
  })

  // 6. The AgentDemo row (PIN is the caller-ID fallback for the shared line).
  const micrositeSlug = `${slugify(input.agentName)}-${Date.now().toString(36)}`
  let demo
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      demo = await prisma.agentDemo.create({
        data: {
          agentName:       input.agentName,
          brokerage:       input.brokerage ?? null,
          market:          input.market,
          agentEmail:      input.agentEmail,
          agentPhone:      normalizePhone(input.agentPhone),
          tenantId:        tenant.id,
          pin:             gen6(),
          micrositeSlug,
          recommendedTier: scored.recommendedTier,
          status:          'GENERATING',
          expiresAt:       new Date(Date.now() + DEMO_TTL_DAYS * 86_400_000),
          createdById:     input.createdById,
        },
      })
      break
    } catch (e) {
      // unique(pin) collision — retry with a fresh PIN. Anything else: rethrow.
      if (attempt === 7) throw e
    }
  }
  if (!demo) throw new AppError('INTERNAL_ERROR', 'Could not allocate a demo PIN', 500)

  // 7. Background enrichment (paid AVM + free area facts). Never blocks the
  //    request; flips status→READY when done so the admin preview can poll.
  void enrichAndReady(tenant.id, demo.id)

  return { ...demo, widgetPublicKey: orby.publicKey }
}

/** Enrich each listing (paid + free), then mark the demo READY. Best-effort. */
async function enrichAndReady(tenantId: string, demoId: string): Promise<void> {
  try {
    const listings = await prisma.listing.findMany({ where: { tenantId }, select: { id: true } })
    for (const l of listings) {
      await enrichListing(tenantId, l.id, true, { includePaid: true }).catch(() => {})
      // Overpass (OSM) throttles back-to-back queries — space them out.
      await new Promise(res => setTimeout(res, 2500))
    }
  } finally {
    await prisma.agentDemo.update({
      where: { id: demoId },
      data:  { status: 'READY', enrichedAt: new Date() },
    }).catch(() => {})
  }
}

/** Admin list — newest first, with the demo tenant's listing count. */
export async function listAgentDemos() {
  const demos = await prisma.agentDemo.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const counts = await prisma.listing.groupBy({
    by: ['tenantId'],
    where: { tenantId: { in: demos.map(d => d.tenantId) } },
    _count: { _all: true },
  })
  const byTenant = new Map(counts.map(c => [c.tenantId, c._count._all]))
  return demos.map(d => ({ ...d, listingCount: byTenant.get(d.tenantId) ?? 0 }))
}

/** Admin detail — the demo + its listings (with enrichment) for preview. */
export async function getAgentDemo(id: string) {
  const demo = await prisma.agentDemo.findUnique({ where: { id } })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  const listings = await prisma.listing.findMany({
    where:   { tenantId: demo.tenantId },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, address: true, headline: true, priceUsd: true, beds: true, baths: true,
               sqft: true, propertyType: true, enrichedAt: true },
  })
  return { ...demo, listings }
}
