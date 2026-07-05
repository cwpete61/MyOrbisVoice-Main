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
import { getStripe } from '../lib/stripe.js'
import { getOrCreateStripeCustomer } from './stripe.service.js'
import { syncEntitlementsFromPlan } from './entitlement.service.js'
import { startPasswordReset } from './auth.service.js'
import { sendPasswordResetEmail, sendAgentDemoEmail } from './email.service.js'
import { DEMO_PHONE_E164 } from './demo-session.service.js'

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

/**
 * Caller-ID routing for the shared demo line. If the inbound `From` matches an
 * agent's demo phone, return that demo tenant's INBOUND channel so Orby answers
 * loaded with THEIR DNA + listings. Null → the caller isn't a known agent (the
 * inbound handler falls back to the generic sandbox). Most-recent demo wins if
 * an agent has more than one.
 */
export async function resolveAgentDemoInboundByPhone(
  fromE164: string | null | undefined,
): Promise<{ tenantId: string; channelConfigId: string } | null> {
  const phone = normalizePhone(fromE164 ?? undefined)
  if (!phone) return null
  const demo = await prisma.agentDemo.findFirst({
    where:   { agentPhone: phone, status: { not: 'EXPIRED' } },
    orderBy: { createdAt: 'desc' },
    select:  { tenantId: true },
  })
  if (!demo) return null
  const ch = await prisma.channelConfig.findFirst({
    where:  { tenantId: demo.tenantId, channelType: 'INBOUND' },
    select: { id: true },
  })
  return { tenantId: demo.tenantId, channelConfigId: ch?.id ?? '' }
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

const AGENTS_APP_BASE = 'https://app.myorbisagents.com'
const AGENTS_API_BASE = 'https://api.myorbisagents.com'

/** Send (or resend) the demo email to the agent. Requires enrichment done. */
export async function sendAgentDemo(id: string): Promise<{ status: string }> {
  const demo = await prisma.agentDemo.findUnique({ where: { id } })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  if (demo.status === 'GENERATING') throw new AppError('BAD_REQUEST', 'Still generating — wait until enrichment finishes.', 400)
  if (demo.status === 'CLAIMED') throw new AppError('CONFLICT', 'This demo has already been claimed.', 409)

  const listings = await prisma.listing.findMany({
    where:   { tenantId: demo.tenantId },
    orderBy: { createdAt: 'asc' },
    select:  { address: true, headline: true, priceUsd: true, highlights: true },
  })
  const planName = demo.recommendedTier === '497' ? 'Solo Power' : 'Solo Capture'
  await sendAgentDemoEmail({
    to:           demo.agentEmail,
    agentName:    demo.agentName,
    micrositeUrl: `${AGENTS_APP_BASE}/agent-demo/${demo.micrositeSlug}`,
    claimUrl:     `${AGENTS_API_BASE}/api/public/agent-demo/${demo.micrositeSlug}/claim`,
    demoPhone:    DEMO_PHONE_E164,
    pin:          demo.pin,
    planName,
    listings,
  })
  await prisma.agentDemo.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } })
  return { status: 'SENT' }
}

/** Sweep: mark unclaimed demos past their expiry as EXPIRED. Called on the
 *  demo-reset interval. Returns how many were flipped. */
export async function markExpiredAgentDemos(): Promise<number> {
  const r = await prisma.agentDemo.updateMany({
    where: { status: { notIn: ['CLAIMED', 'EXPIRED'] }, expiresAt: { lt: new Date() } },
    data:  { status: 'EXPIRED' },
  })
  return r.count
}

/**
 * Build the promo Checkout Session for claiming a demo. Subscription mode:
 *   line_items          = [the agent plan's recurring price]
 *   add_invoice_items   = [$250 setup one-time]  (first invoice only)
 *   discounts           = [50%-off-12mo coupon]  (product-scoped → plan only)
 * metadata carries scope=agent_demo_claim + tenantId/planCode/agentDemoId so the
 * webhook converts THIS demo tenant to a paid account in place. Setup + coupon
 * are resolved from Stripe at call time (created by provision-agent-promo-stripe).
 */
export async function createAgentDemoClaimSession(
  slug: string,
  tierOverride?: '297' | '497',
): Promise<{ url: string }> {
  const demo = await prisma.agentDemo.findUnique({ where: { micrositeSlug: slug } })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  if (demo.expiresAt && demo.expiresAt.getTime() < Date.now()) {
    throw new AppError('GONE', 'This demo link has expired', 410)
  }

  const tier     = tierOverride ?? (demo.recommendedTier as '297' | '497')
  const planCode = tier === '497' ? 'solo_power' : 'solo_capture'
  const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } })
  if (!plan?.stripePriceId) throw new AppError('BAD_REQUEST', 'Plan has no Stripe price configured', 400)

  const stripe     = getStripe()
  const customerId = await getOrCreateStripeCustomer(demo.tenantId)

  // Resolve the promo coupon + $250 setup price (provisioned once, idempotent).
  const [coupons, setupPrices] = await Promise.all([
    stripe.coupons.list({ limit: 100 }),
    stripe.prices.list({ lookup_keys: ['agent_setup_250'], limit: 1 }),
  ])
  const coupon = (coupons.data as Array<{ id: string; valid: boolean; metadata: Record<string, string> | null }>)
    .find(c => c.metadata?.['promo'] === 'agent_launch' && c.valid)
  const setupPriceId = setupPrices.data[0]?.id

  const meta = { scope: 'agent_demo_claim', tenantId: demo.tenantId, planCode, agentDemoId: demo.id }
  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items:  [{ price: plan.stripePriceId, quantity: 1 }],
    subscription_data: {
      metadata: meta,
      ...(setupPriceId ? { add_invoice_items: [{ price: setupPriceId, quantity: 1 }] } : {}),
    },
    ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
    metadata:    meta,
    success_url: `${AGENTS_APP_BASE}/agent-demo/${slug}?claimed=1`,
    cancel_url:  `${AGENTS_APP_BASE}/agent-demo/${slug}`,
  })
  if (!session.url) throw new AppError('INTERNAL_ERROR', 'Failed to create checkout session', 500)
  return { url: session.url }
}

/**
 * Webhook side of the claim (called from stripe.service checkout.session.completed
 * when scope=agent_demo_claim). Converts the demo tenant to a real paid account
 * IN PLACE — creates the agent's owner login, flips the demo flags, syncs plan
 * entitlements — then emails a set-password link. Idempotent (guards on CLAIMED),
 * so Stripe retries are safe. Runs BEFORE the standard subscription upsert.
 */
export async function completeAgentDemoClaim(
  session: { metadata?: Record<string, string> | null; customer_email?: string | null; customer_details?: { email?: string | null } | null },
): Promise<void> {
  const agentDemoId = session.metadata?.['agentDemoId']
  const tenantId    = session.metadata?.['tenantId']
  if (!agentDemoId || !tenantId) return

  const demo = await prisma.agentDemo.findUnique({ where: { id: agentDemoId } })
  if (!demo || demo.status === 'CLAIMED') return // idempotent — already converted

  const email = (session.customer_email || session.customer_details?.email || demo.agentEmail).trim()
  const firstName = demo.agentName.split(/\s+/)[0] ?? null

  // Owner user (reuse if the email already has an account).
  let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  if (!user) {
    user = await prisma.user.create({ data: { email, firstName, passwordHash: null, preferredLocale: 'en' } })
  }
  const ownerRole = await prisma.roleDefinition.findUnique({ where: { key: 'tenant_owner' } })
  if (ownerRole) {
    const existing = await prisma.tenantMember.findFirst({ where: { tenantId, userId: user.id } })
    if (!existing) {
      await prisma.tenantMember.create({ data: { tenantId, userId: user.id, roleDefinitionId: ownerRole.id, isOwner: true } })
    }
  }

  // Flip the demo tenant into a real paid account (DNA + listings carry over).
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { isDemo: false, demoKind: null, status: 'ACTIVE', registrationEmail: email },
  })

  const plan = await prisma.plan.findFirst({ where: { code: session.metadata?.['planCode'] ?? '' } })
  if (plan) await syncEntitlementsFromPlan(tenantId, plan.id).catch(() => {})

  await prisma.agentDemo.update({ where: { id: demo.id }, data: { status: 'CLAIMED', claimedAt: new Date() } })

  await prisma.auditLog.create({
    data: { tenantId, actorType: 'SYSTEM', action: 'agent_demo.claimed',
            targetType: 'AgentDemo', targetId: demo.id, metadataJson: { email, planCode: plan?.code ?? null } },
  }).catch(() => {})

  // Set-password link so the agent can log in (best-effort — they can also use
  // "forgot password" if it lapses).
  try {
    const reset = await startPasswordReset(email)
    if (reset) {
      await sendPasswordResetEmail({
        to: email, firstName: reset.firstName,
        resetUrl: `${AGENTS_APP_BASE}/reset-password?token=${reset.rawToken}`,
        expiresInMinutes: 15,
      })
    }
  } catch { /* non-fatal */ }
}
