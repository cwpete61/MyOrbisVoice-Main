import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'
import { AppError } from '@voiceautomation/shared'
import { getStripe } from '../lib/stripe.js'

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  return prisma.affiliateSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

export async function updateSettings(data: {
  cookieDurationDays?: number
  commissionRatePct?: number
  commissionType?: string
  minPayoutCents?: number
  autoApproveAfterDays?: number
  programName?: string
  programDescription?: string
  termsUrl?: string | null
}) {
  return prisma.affiliateSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
}

// ── Account management ────────────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode()
    const exists = await prisma.affiliateAccount.findUnique({ where: { referralCode: code } })
    if (!exists) return code
  }
  throw new Error('Could not generate unique referral code')
}

export async function applyForAffiliate(userId: string) {
  const existing = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (existing) return existing
  const code = await uniqueCode()
  // Auto-approve on application (decided 2026-05-04 — reverses earlier "vetted
  // application" decision). Partners get an active referral link immediately
  // and can start sending traffic. They still need to complete payout-account
  // setup (Stripe Connect) before they can actually receive money.
  return prisma.affiliateAccount.create({
    data: { userId, referralCode: code, status: 'ACTIVE' },
  })
}

export async function getAffiliateAccount(userId: string) {
  return prisma.affiliateAccount.findUnique({ where: { userId } })
}

export async function getAffiliateAccountById(id: string) {
  return prisma.affiliateAccount.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  })
}

export async function updatePayoutMethod(userId: string, data: Record<string, unknown>) {
  const account = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (!account) throw new AppError('NOT_FOUND', 'No partner account found for this user', 404)
  return prisma.affiliateAccount.update({
    where: { id: account.id },
    data: { payoutMethodJson: data as never },
  })
}

// ── Stripe Connect Express onboarding ─────────────────────────────────────────
//
// Three-step flow:
//   1. Partner clicks "Connect now" → POST /api/affiliate/connect/onboard
//      → we create (or reuse) a Stripe Express account, then a one-shot
//        AccountLink, and hand back the URL.
//   2. Partner completes the Stripe-hosted form (bank details, W-9/W-8BEN, etc.)
//      and is redirected to /partner-portal/payouts?stripe=return.
//   3. The dashboard auto-calls /api/affiliate/connect/refresh on that return,
//      which re-fetches the account state from Stripe and stores the verified
//      flags in our DB. Status = "verified" once Stripe says payouts are
//      enabled and details are submitted.

interface ConnectStatus {
  connected: boolean        // do we have a Stripe account on file at all
  detailsSubmitted: boolean // partner finished the onboarding form
  payoutsEnabled: boolean   // Stripe has approved them for payouts
  chargesEnabled: boolean   // (informational; not required for payouts)
  accountId: string | null
  /** Stripe's `requirements.disabled_reason` if any — e.g. "requirements.past_due" */
  disabledReason: string | null
}

function summarizeAccount(stripeAccount: {
  id: string
  details_submitted?: boolean
  payouts_enabled?: boolean
  charges_enabled?: boolean
  requirements?: { disabled_reason?: string | null } | null
}): ConnectStatus {
  return {
    connected:        true,
    detailsSubmitted: !!stripeAccount.details_submitted,
    payoutsEnabled:   !!stripeAccount.payouts_enabled,
    chargesEnabled:   !!stripeAccount.charges_enabled,
    accountId:        stripeAccount.id,
    disabledReason:   stripeAccount.requirements?.disabled_reason ?? null,
  }
}

const NOT_CONNECTED: ConnectStatus = {
  connected: false, detailsSubmitted: false, payoutsEnabled: false,
  chargesEnabled: false, accountId: null, disabledReason: null,
}

/** Fetch + cache the latest Connect status for the partner. Pulls from Stripe
 *  if we have an account on file, then writes the summary into payoutMethodJson
 *  so the dashboard checklist renders without a Stripe round-trip.
 *
 *  Returns NOT_CONNECTED for users without an AffiliateAccount — the
 *  partner-portal pages call this on every load and not every user is a
 *  partner. Throwing here would 500 the page; returning a clean
 *  not-connected status lets the UI render the "you need to apply first"
 *  state gracefully. */
export async function refreshConnectStatus(userId: string): Promise<ConnectStatus> {
  const account = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (!account || !account.stripeConnectAccountId) return NOT_CONNECTED

  const stripe = getStripe()
  const stripeAccount = await stripe.accounts.retrieve(account.stripeConnectAccountId)
  const status = summarizeAccount(stripeAccount as unknown as Parameters<typeof summarizeAccount>[0])

  await prisma.affiliateAccount.update({
    where: { id: account.id },
    data: {
      payoutMethodJson: {
        type: 'stripe_connect_express',
        ...status,
        refreshedAt: new Date().toISOString(),
      } as never,
    },
  })
  return status
}

/** Read the cached Connect status without hitting Stripe. Falls back to
 *  refreshing if we have an account ID but no cached payload (first read).
 *
 *  Returns NOT_CONNECTED for users without an AffiliateAccount (see note on
 *  refreshConnectStatus above — same reasoning). */
export async function getConnectStatus(userId: string): Promise<ConnectStatus> {
  const account = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (!account || !account.stripeConnectAccountId) return NOT_CONNECTED
  const cached = (account.payoutMethodJson as Record<string, unknown> | null) ?? {}
  if (typeof cached['payoutsEnabled'] === 'boolean') {
    return {
      connected:        true,
      detailsSubmitted: !!cached['detailsSubmitted'],
      payoutsEnabled:   !!cached['payoutsEnabled'],
      chargesEnabled:   !!cached['chargesEnabled'],
      accountId:        account.stripeConnectAccountId,
      disabledReason:   (cached['disabledReason'] as string | null) ?? null,
    }
  }
  // Have an account ID but no cached payload — refresh from Stripe
  return refreshConnectStatus(userId)
}

/** Create a Stripe Connect Express account if one doesn't exist yet, then
 *  generate a one-shot AccountLink for the partner to complete onboarding.
 *  Returns the URL the dashboard should open. The same call is safe to make
 *  before AND during onboarding — Stripe lets you regenerate links freely. */
export async function createConnectOnboardingLink(
  userId: string,
  opts: { returnUrl: string; refreshUrl: string }
): Promise<{ url: string; accountId: string }> {
  const stripe = getStripe()
  const account = await prisma.affiliateAccount.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  })
  if (!account) throw new AppError('NOT_FOUND', 'No partner account found for this user', 404)
  if (account.status !== 'ACTIVE') {
    throw new Error('Partner account must be ACTIVE before connecting payouts')
  }

  // Reuse existing Stripe account if present, otherwise create one.
  let connectAccountId = account.stripeConnectAccountId
  if (!connectAccountId) {
    const created = await stripe.accounts.create({
      type:    'express',
      country: 'US',  // Default; Stripe Connect onboarding lets the partner change this if needed
      email:   account.user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        affiliateAccountId: account.id,
        platform:           'MyOrbisVoice',
      },
    })
    connectAccountId = created.id
    await prisma.affiliateAccount.update({
      where: { id: account.id },
      data:  { stripeConnectAccountId: connectAccountId },
    })
  }

  const link = await stripe.accountLinks.create({
    account:    connectAccountId,
    refresh_url: opts.refreshUrl,
    return_url:  opts.returnUrl,
    type:       'account_onboarding',
  })

  return { url: link.url, accountId: connectAccountId }
}

export async function approveAffiliate(id: string) {
  return prisma.affiliateAccount.update({
    where: { id },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  })
}

export async function pauseAffiliate(id: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { status: 'PAUSED' } })
}

export async function reactivateAffiliate(id: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { status: 'ACTIVE' } })
}

export async function disableAffiliate(id: string, notes?: string) {
  return prisma.affiliateAccount.update({
    where: { id },
    data: { status: 'DISABLED', notes: notes ?? null },
  })
}

export async function updateAffiliateNotes(id: string, notes: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { notes } })
}

// ── Referral link ─────────────────────────────────────────────────────────────

/** Returns the partner's referral link, or null if the user doesn't have a
 *  partner account. Used by both the tenant dashboard (where most users
 *  won't have one — the partner program is opt-in) and the partner portal.
 *  Previously threw P2025 for non-partner users, which spammed the API
 *  error log and produced 500s the frontend had to .catch() defensively. */
export async function getReferralLink(userId: string): Promise<{ url: string; code: string } | null> {
  const account = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (!account) return null
  const appUrl = process.env.APP_URL ?? 'https://app.myorbisvoice.com'
  return {
    url:  `${appUrl}/r/${account.referralCode}`,
    code: account.referralCode,
  }
}

// ── Code/slug resolution ──────────────────────────────────────────────────────
//
// Visitors can land via the partner's primary referralCode OR via any of their
// custom slugs. Resolve handles both — single source of truth for click
// tracking AND signup attribution.
async function resolveCodeOrSlug(input: string): Promise<{
  account: { id: string; status: string; referralCode: string } | null
  customLinkId: string | null
}> {
  if (!input) return { account: null, customLinkId: null }

  // Primary referral code is uppercase hex; custom slugs are lowercase. Try
  // direct referralCode first since it's the common case.
  const direct = await prisma.affiliateAccount.findUnique({
    where: { referralCode: input },
    select: { id: true, status: true, referralCode: true },
  })
  if (direct) return { account: direct, customLinkId: null }

  // Fall through to custom slug lookup.
  const link = await prisma.affiliateCustomLink.findUnique({
    where: { slug: input },
    include: {
      affiliateAccount: { select: { id: true, status: true, referralCode: true } },
    },
  })
  if (link && !link.archivedAt && link.affiliateAccount.status === 'ACTIVE') {
    return { account: link.affiliateAccount, customLinkId: link.id }
  }
  return { account: null, customLinkId: null }
}

/** Public resolver — returns the parent referral code so the /r/ page can
 *  drop the right cookie. Slug-aware. Returns null for unknown / disabled. */
export async function resolveReferral(input: string): Promise<{ referralCode: string } | null> {
  const { account } = await resolveCodeOrSlug(input)
  if (!account || account.status !== 'ACTIVE') return null
  return { referralCode: account.referralCode }
}

// ── Click tracking ────────────────────────────────────────────────────────────

export async function trackClick(
  codeOrSlug: string,
  meta: { sessionId?: string; landingPath?: string; referrer?: string; ipHash?: string; userAgent?: string }
) {
  const { account, customLinkId } = await resolveCodeOrSlug(codeOrSlug)
  if (!account || account.status !== 'ACTIVE') return null
  return prisma.affiliateClick.create({
    data: {
      affiliateAccountId: account.id,
      customLinkId,
      sessionId:   meta.sessionId,
      landingPath: meta.landingPath,
      referrer:    meta.referrer,
      ipHash:      meta.ipHash,
      userAgent:   meta.userAgent,
    },
  })
}

// ── Attribution on signup ─────────────────────────────────────────────────────

export async function attributeTenant(tenantId: string, codeOrSlug: string) {
  const { account } = await resolveCodeOrSlug(codeOrSlug)
  if (!account || account.status !== 'ACTIVE') return
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { referredByCode: account.referralCode, attributedAt: new Date() },
  })
  // Record a 'signup' conversion immediately so the partner sees the referral
  // even when it never converts to a paid plan. Free-tier signups are real
  // referrals — they just haven't generated a commission yet. The Stripe
  // webhook later records a separate 'subscription' or 'one_time' conversion
  // (with a non-zero value + commission row) when the tenant actually pays;
  // both rows live side-by-side and tell the full referral story.
  const dupe = await prisma.affiliateConversion.findFirst({
    where: { affiliateAccountId: account.id, tenantId, conversionType: 'signup' },
    select: { id: true },
  })
  if (!dupe) {
    await prisma.affiliateConversion.create({
      data: {
        affiliateAccountId: account.id,
        tenantId,
        conversionType:  'signup',
        conversionValue: 0,
        occurredAt:      new Date(),
      },
    }).catch(() => null)
  }
}

// ── Custom links (per-partner CRUD) ───────────────────────────────────────────
//
// Partners can mint additional named slugs that point to their account so they
// can split-track campaigns. Each click logs which slug it came through; stats
// roll up to the parent affiliate for commission math.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'signin',
  'r', 'redirect', 'partner', 'partner-portal', 'affiliate', 'affiliates',
  'dashboard', 'settings', 'help', 'support', 'pricing', 'home',
  'index', 'public', 'static', 'assets', 'webhook', 'webhooks',
])

function validateSlug(slug: string): void {
  if (!slug || typeof slug !== 'string') throw new Error('slug is required')
  const lower = slug.toLowerCase().trim()
  if (lower.length < 3 || lower.length > 50) throw new Error('slug must be 3–50 characters')
  if (!SLUG_RE.test(lower)) throw new Error('slug must use lowercase letters, numbers, and hyphens (start/end alphanumeric)')
  if (RESERVED_SLUGS.has(lower)) throw new Error('that slug is reserved — pick another')
}

export async function listCustomLinks(affiliateAccountId: string) {
  const links = await prisma.affiliateCustomLink.findMany({
    where: { affiliateAccountId },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
  })
  // Roll up click + conversion counts per link
  const linkIds = links.map(l => l.id)
  const clickGroup = linkIds.length
    ? await prisma.affiliateClick.groupBy({
        by: ['customLinkId'],
        where: { customLinkId: { in: linkIds } },
        _count: { _all: true },
      })
    : []
  const clicksByLink = new Map<string, number>(
    clickGroup.map(g => [g.customLinkId!, g._count._all]),
  )
  return links.map(l => ({
    id: l.id,
    slug: l.slug,
    label: l.label,
    notes: l.notes,
    archived: l.archivedAt != null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    clicks: clicksByLink.get(l.id) ?? 0,
  }))
}

export async function createCustomLink(
  affiliateAccountId: string,
  data: { slug: string; label: string; notes?: string },
) {
  validateSlug(data.slug)
  const slug = data.slug.toLowerCase().trim()
  const label = (data.label ?? '').trim()
  if (!label) throw new Error('label is required')
  if (label.length > 100) throw new Error('label must be 100 characters or fewer')

  // Slug must not collide with any existing referralCode (case-insensitive
  // compare — referralCodes are uppercase hex; slugs are lowercase, so this
  // check exists for paranoia rather than expected collisions).
  const codeCollision = await prisma.affiliateAccount.findUnique({
    where: { referralCode: slug.toUpperCase() },
    select: { id: true },
  })
  if (codeCollision) throw new Error('that slug conflicts with a generated referral code — pick another')

  // And not collide with another partner's slug
  const slugCollision = await prisma.affiliateCustomLink.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (slugCollision) throw new Error('that slug is already taken — pick another')

  return prisma.affiliateCustomLink.create({
    data: { affiliateAccountId, slug, label, notes: data.notes?.trim() || null },
  })
}

export async function updateCustomLink(
  affiliateAccountId: string,
  id: string,
  data: { label?: string; notes?: string | null },
) {
  const existing = await prisma.affiliateCustomLink.findUnique({ where: { id } })
  if (!existing || existing.affiliateAccountId !== affiliateAccountId) {
    throw new Error('not found')
  }
  const patch: { label?: string; notes?: string | null } = {}
  if (data.label !== undefined) {
    const label = data.label.trim()
    if (!label) throw new Error('label cannot be empty')
    if (label.length > 100) throw new Error('label must be 100 characters or fewer')
    patch.label = label
  }
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null
  return prisma.affiliateCustomLink.update({ where: { id }, data: patch })
}

export async function setCustomLinkArchived(
  affiliateAccountId: string,
  id: string,
  archived: boolean,
) {
  const existing = await prisma.affiliateCustomLink.findUnique({ where: { id } })
  if (!existing || existing.affiliateAccountId !== affiliateAccountId) {
    throw new Error('not found')
  }
  return prisma.affiliateCustomLink.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  })
}

export async function deleteCustomLink(affiliateAccountId: string, id: string) {
  const existing = await prisma.affiliateCustomLink.findUnique({ where: { id } })
  if (!existing || existing.affiliateAccountId !== affiliateAccountId) {
    throw new Error('not found')
  }
  // Click rows have customLinkId set null on delete (schema cascade), so
  // historical click counts still roll up to the parent affiliate.
  await prisma.affiliateCustomLink.delete({ where: { id } })
}

// ── Holdback / payout-schedule helpers ───────────────────────────────────────
//
// Policy (decided 2026-05-04 PM):
// - First-subscription commissions get a 30-day hold (covers refund window).
// - Recurring renewal commissions skip the hold (customer already proved out).
// - Payouts run on the 1st and 15th of each month.
// - If 1st/15th lands on Sat/Sun, the payout date moves FORWARD to the next
//   business day (Stripe ACH only runs business days anyway).
//
// FIRST_SUBSCRIPTION conversion types (30-day hold applies):
//   subscription_started, subscription_renewed_v2 (treated as a new sub),
//   one_time_payment, anything not matching the SKIP_HOLD list below.
// SKIP_HOLD types (immediately eligible, no 30-day delay):
//   subscription_renewed
const HOLD_DAYS = 30
const SKIP_HOLD_CONVERSION_TYPES = ['subscription_renewed']

/**
 * For a given conversion, computes when the resulting commission becomes
 * eligible (= 30-day hold ends) and on which date it will actually be paid
 * (= next 1st-or-15th >= eligibility, business-day-adjusted).
 *
 * Pure function — no DB, no time-of-day fuzziness. occurredAt is treated as
 * UTC midnight of that calendar day for hold math.
 */
export function computeEligibilityAndPayoutDate(conversionType: string, occurredAt: Date): {
  eligibleAt: Date
  scheduledPayoutDate: Date
} {
  const skipHold = SKIP_HOLD_CONVERSION_TYPES.includes(conversionType)
  const eligibleAt = skipHold
    ? new Date(occurredAt)
    : new Date(occurredAt.getTime() + HOLD_DAYS * 86400_000)

  const scheduledPayoutDate = computeNextPayoutDate(eligibleAt)
  return { eligibleAt, scheduledPayoutDate }
}

/**
 * Returns the next 1st-or-15th-of-month that's >= fromDate, adjusted FORWARD
 * to the next business day if it lands on a weekend.
 */
export function computeNextPayoutDate(fromDate: Date): Date {
  const candidate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()))
  // Find the next 1st or 15th >= candidate
  while (true) {
    const day = candidate.getUTCDate()
    if (day === 1 || day === 15) break
    if (day < 15) {
      candidate.setUTCDate(15)
      continue
    }
    // day > 15 → jump to the 1st of next month
    candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1)
  }
  // Business-day adjustment: Sat (6) → Mon, Sun (0) → Mon
  const dow = candidate.getUTCDay()
  if (dow === 6) candidate.setUTCDate(candidate.getUTCDate() + 2)
  else if (dow === 0) candidate.setUTCDate(candidate.getUTCDate() + 1)
  return candidate
}

// ── Conversion recording ──────────────────────────────────────────────────────

export async function recordConversion(opts: {
  referralCode: string
  tenantId: string
  subscriptionId?: string
  conversionType: string
  conversionValueCents?: number
}) {
  const settings = await getSettings()
  const account = await prisma.affiliateAccount.findUnique({ where: { referralCode: opts.referralCode } })
  if (!account || account.status !== 'ACTIVE') return null

  const existing = await prisma.affiliateConversion.findFirst({
    where: { affiliateAccountId: account.id, tenantId: opts.tenantId, conversionType: opts.conversionType },
  })
  if (existing) return existing

  const conversion = await prisma.affiliateConversion.create({
    data: {
      affiliateAccountId: account.id,
      tenantId:           opts.tenantId,
      subscriptionId:     opts.subscriptionId,
      conversionType:     opts.conversionType,
      conversionValue:    opts.conversionValueCents ?? null,
      occurredAt:         new Date(),
    },
  })

  let amountMinor = 0
  if (settings.commissionType === 'PERCENTAGE' && opts.conversionValueCents) {
    amountMinor = Math.round(opts.conversionValueCents * settings.commissionRatePct / 100)
  } else if (settings.commissionType === 'FLAT') {
    amountMinor = settings.minPayoutCents
  }

  if (amountMinor > 0) {
    const { eligibleAt, scheduledPayoutDate } = computeEligibilityAndPayoutDate(
      opts.conversionType,
      conversion.occurredAt,
    )
    await prisma.affiliateCommission.create({
      data: {
        affiliateConversionId: conversion.id,
        affiliateAccountId:    account.id,
        tenantId:              opts.tenantId,
        amountMinor,
        currency:              'usd',
        status:                'PENDING',
        eligibleAt,
        scheduledPayoutDate,
      },
    })
    await prisma.affiliateAccount.update({
      where: { id: account.id },
      data:  { totalEarnedCents: { increment: amountMinor } },
    })
  }

  return conversion
}

// ── Referrals (every conversion, paid or not) ────────────────────────────────
//
// The partner sees ALL their referrals here, not just the ones that produced a
// commission. A free-tier signup shows up with conversionType='signup' and a
// commission status of 'NONE'. When that tenant later upgrades to paid, the
// Stripe webhook records a separate row (conversionType='subscription' or
// 'one_time') with the commission attached. Ordered newest-first.
export async function getReferrals(affiliateAccountId: string, limit = 100) {
  const conversions = await prisma.affiliateConversion.findMany({
    where:   { affiliateAccountId },
    orderBy: { occurredAt: 'desc' },
    take:    limit,
    include: {
      tenant: {
        select: {
          id:              true,
          displayName:     true,
          businessProfile: { select: { brandName: true } },
          subscriptions: {
            select:  { plan: { select: { code: true, name: true } }, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take:    1,
          },
        },
      },
      commissions: {
        select:  { id: true, amountMinor: true, currency: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take:    1,
      },
    },
  })
  return conversions.map(c => {
    const sub = c.tenant?.subscriptions?.[0] ?? null
    const com = c.commissions?.[0] ?? null
    return {
      id:               c.id,
      occurredAt:       c.occurredAt,
      conversionType:   c.conversionType,
      conversionValue:  c.conversionValue,
      tenant: {
        id:        c.tenant?.id ?? c.tenantId,
        name:      c.tenant?.businessProfile?.brandName ?? c.tenant?.displayName ?? 'Unknown',
        planCode:  sub?.plan.code ?? 'free',
        planName:  sub?.plan.name  ?? 'Free',
      },
      commissionStatus: com?.status ?? 'NONE',
      commissionCents:  com?.amountMinor ?? 0,
    }
  })
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getAffiliateStats(affiliateAccountId: string) {
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateAccountId } }),
    prisma.affiliateConversion.count({ where: { affiliateAccountId } }),
    prisma.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateAccountId },
      _sum: { amountMinor: true },
      _count: true,
    }),
  ])

  const byStatus = Object.fromEntries(
    commissions.map(r => [r.status, { count: r._count, cents: r._sum.amountMinor ?? 0 }])
  )
  return {
    clicks,
    conversions,
    pendingCents:    byStatus['PENDING']?.cents   ?? 0,
    approvedCents:   byStatus['APPROVED']?.cents  ?? 0,
    holdCents:       byStatus['HOLD']?.cents      ?? 0,
    paidCents:       byStatus['PAID']?.cents      ?? 0,
    reversedCents:   byStatus['REVERSED']?.cents  ?? 0,
    totalEarnedCents: Object.values(byStatus).reduce((s, v) => s + (v as { cents: number }).cents, 0),
  }
}

/**
 * Period-scoped stats for the partner dashboard's "Last N days" panel.
 * Returns the same shape as getAffiliateStats() but only counts events
 * (clicks, conversions, commissions) created within the trailing window.
 *
 * Conversion rate is computed as conversions/clicks; both 0 returns 0.
 */
export async function getPeriodStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.affiliateClick.count({
      where: { affiliateAccountId, createdAt: { gte: since } },
    }),
    prisma.affiliateConversion.count({
      where: { affiliateAccountId, occurredAt: { gte: since } },
    }),
    prisma.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateAccountId, createdAt: { gte: since } },
      _sum: { amountMinor: true },
      _count: true,
    }),
  ])
  const byStatus = Object.fromEntries(
    commissions.map(r => [r.status, { count: r._count, cents: r._sum.amountMinor ?? 0 }])
  )
  return {
    days,
    clicks,
    conversions,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    pendingCents:     byStatus['PENDING']?.cents  ?? 0,
    approvedCents:    byStatus['APPROVED']?.cents ?? 0,
    paidCents:        byStatus['PAID']?.cents     ?? 0,
    totalEarnedCents: Object.values(byStatus).reduce((s, v) => s + (v as { cents: number }).cents, 0),
  }
}

// ── Platform-wide stats (admin dashboard) ────────────────────────────────────
//
// Aggregates everything across ALL partners. Used by the admin /admin/partners
// page to surface KPIs, trends, and top performers in one screen.

export async function getPlatformStats(periodDays = 30) {
  const periodStart = new Date(Date.now() - periodDays * 86400_000)
  const priorPeriodStart = new Date(Date.now() - 2 * periodDays * 86400_000)

  const [
    partnersByStatus,
    clicksAllTime,    clicksPeriod,    clicksPriorPeriod,
    conversionsAllTime, conversionsPeriod, conversionsPriorPeriod,
    revenueAllTime, revenuePeriod,
    commissionsByStatus,
    commissionsPaidPeriod,
    topByEarnings,
  ] = await Promise.all([
    prisma.affiliateAccount.groupBy({ by: ['status'], _count: true }),

    prisma.affiliateClick.count(),
    prisma.affiliateClick.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.affiliateClick.count({ where: { createdAt: { gte: priorPeriodStart, lt: periodStart } } }),

    prisma.affiliateConversion.count(),
    prisma.affiliateConversion.count({ where: { occurredAt: { gte: periodStart } } }),
    prisma.affiliateConversion.count({ where: { occurredAt: { gte: priorPeriodStart, lt: periodStart } } }),

    prisma.affiliateConversion.aggregate({ _sum: { conversionValue: true } }),
    prisma.affiliateConversion.aggregate({
      where: { occurredAt: { gte: periodStart } },
      _sum: { conversionValue: true },
    }),

    prisma.affiliateCommission.groupBy({
      by: ['status'],
      _sum: { amountMinor: true },
      _count: true,
    }),

    prisma.affiliateCommission.aggregate({
      where: { status: 'PAID', paidAt: { gte: periodStart } },
      _sum: { amountMinor: true },
    }),

    prisma.affiliateAccount.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { totalEarnedCents: 'desc' },
      take: 5,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ])

  const partnerCounts = Object.fromEntries(partnersByStatus.map(g => [g.status, g._count]))
  const commCounts   = Object.fromEntries(commissionsByStatus.map(g => [g.status, { count: g._count, cents: g._sum.amountMinor ?? 0 }]))

  function deltaPct(curr: number, prior: number): number | null {
    if (prior === 0 && curr === 0) return null
    if (prior === 0) return null  // avoid Infinity; show as new in UI
    return ((curr - prior) / prior) * 100
  }

  return {
    periodDays,
    partners: {
      total:    Object.values(partnerCounts).reduce((s, n) => s + (n as number), 0),
      active:   partnerCounts['ACTIVE']   ?? 0,
      pending:  partnerCounts['PENDING']  ?? 0,
      paused:   partnerCounts['PAUSED']   ?? 0,
      disabled: partnerCounts['DISABLED'] ?? 0,
    },
    clicks: {
      allTime: clicksAllTime,
      period:  clicksPeriod,
      delta:   deltaPct(clicksPeriod, clicksPriorPeriod),
    },
    conversions: {
      allTime: conversionsAllTime,
      period:  conversionsPeriod,
      delta:   deltaPct(conversionsPeriod, conversionsPriorPeriod),
    },
    conversionRate: {
      allTime: clicksAllTime > 0 ? (conversionsAllTime / clicksAllTime) * 100 : 0,
      period:  clicksPeriod  > 0 ? (conversionsPeriod  / clicksPeriod ) * 100 : 0,
    },
    revenueAttributedCents: {
      allTime: revenueAllTime._sum.conversionValue ?? 0,
      period:  revenuePeriod._sum.conversionValue  ?? 0,
    },
    commissions: {
      pendingCents:   commCounts['PENDING']?.cents  ?? 0,
      approvedCents:  commCounts['APPROVED']?.cents ?? 0,
      holdCents:      commCounts['HOLD']?.cents     ?? 0,
      paidCents:      commCounts['PAID']?.cents     ?? 0,
      reversedCents:  commCounts['REVERSED']?.cents ?? 0,
      paidPeriodCents: commissionsPaidPeriod._sum.amountMinor ?? 0,
    },
    topPartners: topByEarnings.map(p => ({
      id:   p.id,
      name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || p.user.email,
      email: p.user.email,
      referralCode:    p.referralCode,
      totalEarnedCents: p.totalEarnedCents,
      totalPaidCents:   p.totalPaidCents,
    })),
  }
}

export async function getPlatformDailyStats(days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const [clicks, conversions] = await Promise.all([
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS n
      FROM "AffiliateClick"
      WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT DATE_TRUNC('day', "occurredAt") AS day, COUNT(*) AS n
      FROM "AffiliateConversion"
      WHERE "occurredAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
  ])
  return {
    clicks:      clicks.map(r => ({ day: r.day.toISOString().slice(0, 10), value: Number(r.n) })),
    conversions: conversions.map(r => ({ day: r.day.toISOString().slice(0, 10), value: Number(r.n) })),
  }
}

// ── Per-partner admin actions (rotate code, delete) ──────────────────────────

export async function regeneratePartnerCode(id: string) {
  const newCode = await uniqueCode()
  return prisma.affiliateAccount.update({
    where: { id },
    data: { referralCode: newCode },
  })
}

export async function deletePartner(
  id: string,
  opts: { actorUserId?: string; reason?: string } = {},
) {
  // Full erasure — when an admin deletes a partner, every piece of their
  // contact + identity data is wiped, NOT just the AffiliateAccount row.
  // Steps in order:
  //   1. Tear down the Stripe Connect Express account (best-effort — if Stripe
  //      rejects we still wipe local data so PII doesn't linger here).
  //   2. Delete the underlying User record. Schema cascade rules then
  //      automatically wipe:
  //        - AffiliateAccount → AffiliateClick / Conversion / Commission /
  //          PayoutRequest / CustomLink
  //        - TenantMember (any tenant memberships the partner had)
  //        - PushSubscription
  //        - RefreshToken
  //        - ImpersonationSession (started by this user, if any)
  //      Audit logs they appear in have actorUserId SET NULL (record stays,
  //      identity is anonymized — correct compliance pattern).
  //      Prompts they authored have createdByUserId SET NULL similarly.
  //   3. Write an audit log of the deletion itself, intentionally without the
  //      deleted user's email or personal data — purpose of the operation is
  //      erasure.
  const account = await prisma.affiliateAccount.findUnique({
    where:   { id },
    include: { user: { select: { id: true } } },
  })
  if (!account) {
    // Already gone — idempotent
    return { deleted: false, reason: 'not_found' as const }
  }

  // Step 1 — Stripe Connect account teardown
  let stripeDeleteError: string | undefined
  if (account.stripeConnectAccountId) {
    try {
      const stripe = getStripe()
      await stripe.accounts.del(account.stripeConnectAccountId)
    } catch (err) {
      stripeDeleteError = (err as Error).message
      console.error(`[deletePartner] Stripe accounts.del failed for ${account.stripeConnectAccountId}: ${stripeDeleteError}`)
      // Non-fatal — continue with local erasure
    }
  }

  // Step 2 — hard-delete the User. All cascade chains fire.
  await prisma.user.delete({ where: { id: account.userId } })

  // Step 3 — audit
  const { writeAuditLog } = await import('../lib/audit.js')
  await writeAuditLog({
    actorType:    'ADMIN',
    actorUserId:  opts.actorUserId,
    action:       'partner.deleted',
    targetType:   'AffiliateAccount',
    targetId:     id,
    metadataJson: {
      affiliateAccountId:     id,
      stripeConnectAccountId: account.stripeConnectAccountId,
      stripeDeleteError,
      reason:                 opts.reason,
      // Intentionally NOT recording email / name / etc. — purpose is erasure.
    },
  })

  return { deleted: true, stripeAccountDeleted: !!account.stripeConnectAccountId && !stripeDeleteError, stripeDeleteError }
}

export async function getDailyClickStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const rows = await prisma.$queryRaw<{ day: string; clicks: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS clicks
    FROM "AffiliateClick"
    WHERE "affiliateAccountId" = ${affiliateAccountId}
      AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return rows.map(r => ({ day: (r.day as unknown as Date).toISOString().slice(0, 10), clicks: Number(r.clicks) }))
}

export async function getDailyConversionStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const rows = await prisma.$queryRaw<{ day: string; conversions: bigint }[]>`
    SELECT DATE_TRUNC('day', "occurredAt") AS day, COUNT(*) AS conversions
    FROM "AffiliateConversion"
    WHERE "affiliateAccountId" = ${affiliateAccountId}
      AND "occurredAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return rows.map(r => ({ day: (r.day as unknown as Date).toISOString().slice(0, 10), conversions: Number(r.conversions) }))
}

// ── Commission management ─────────────────────────────────────────────────────

export async function getCommissions(affiliateAccountId: string, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where: { affiliateAccountId },
      include: { affiliateConversion: { select: { conversionType: true, conversionValue: true, occurredAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateCommission.count({ where: { affiliateAccountId } }),
  ])
  return { items, total }
}

export async function approveCommission(id: string) {
  return prisma.affiliateCommission.update({
    where: { id },
    data:  { status: 'APPROVED', approvedAt: new Date() },
  })
}

export async function holdCommission(id: string) {
  return prisma.affiliateCommission.update({ where: { id }, data: { status: 'HOLD' } })
}

export async function reverseCommission(id: string) {
  const c = await prisma.affiliateCommission.update({ where: { id }, data: { status: 'REVERSED' } })
  await prisma.affiliateAccount.update({
    where: { id: c.affiliateAccountId },
    data:  { totalEarnedCents: { decrement: c.amountMinor } },
  })
  return c
}

export async function markCommissionPaid(id: string, payoutRef: string) {
  const c = await prisma.affiliateCommission.update({
    where: { id },
    data:  { status: 'PAID', paidAt: new Date(), payoutRef },
  })
  await prisma.affiliateAccount.update({
    where: { id: c.affiliateAccountId },
    data:  { totalPaidCents: { increment: c.amountMinor } },
  })
  return c
}

export async function bulkApproveCommissions(ids: string[]) {
  return prisma.affiliateCommission.updateMany({
    where: { id: { in: ids }, status: 'PENDING' },
    data:  { status: 'APPROVED', approvedAt: new Date() },
  })
}

// ── Payout requests ───────────────────────────────────────────────────────────

export async function requestPayout(userId: string) {
  const settings = await getSettings()
  const account = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (!account) throw new AppError('NOT_FOUND', 'No partner account found for this user', 404)
  if (account.status !== 'ACTIVE') throw new Error('Account not active')

  const agg = await prisma.affiliateCommission.aggregate({
    where: { affiliateAccountId: account.id, status: 'APPROVED' },
    _sum:  { amountMinor: true },
  })
  const available = agg._sum.amountMinor ?? 0
  if (available < settings.minPayoutCents) {
    throw new Error(
      `Minimum payout is $${(settings.minPayoutCents / 100).toFixed(2)}. ` +
      `Available: $${(available / 100).toFixed(2)}`
    )
  }

  const [request] = await prisma.$transaction([
    prisma.affiliatePayoutRequest.create({
      data: {
        id:                 crypto.randomUUID(),
        affiliateAccountId: account.id,
        amountCents:        available,
        currency:           'usd',
        status:             'PENDING',
      },
    }),
    prisma.affiliateCommission.updateMany({
      where: { affiliateAccountId: account.id, status: 'APPROVED' },
      data:  { status: 'HOLD' },
    }),
    prisma.affiliateAccount.update({
      where: { id: account.id },
      data:  { payoutRequestedAt: new Date() },
    }),
  ])
  return request
}

export async function getPayoutRequests(affiliateAccountId: string) {
  return prisma.affiliatePayoutRequest.findMany({
    where:   { affiliateAccountId },
    orderBy: { requestedAt: 'desc' },
  })
}

export async function processPayoutRequest(id: string, payoutRef: string, notes?: string) {
  const req = await prisma.affiliatePayoutRequest.update({
    where: { id },
    data:  { status: 'PROCESSED', processedAt: new Date(), payoutRef, notes },
  })
  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateAccountId: req.affiliateAccountId, status: 'HOLD' },
  })
  for (const c of commissions) {
    await prisma.affiliateCommission.update({
      where: { id: c.id },
      data:  { status: 'PAID', paidAt: new Date(), payoutRef },
    })
  }
  await prisma.affiliateAccount.update({
    where: { id: req.affiliateAccountId },
    data:  { totalPaidCents: { increment: req.amountCents } },
  })
  return req
}

// ── Admin lists ───────────────────────────────────────────────────────────────

export async function listAffiliates(opts: { status?: string; search?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status) where['status'] = opts.status
  if (opts.search) {
    where['user'] = {
      OR: [
        { email:     { contains: opts.search, mode: 'insensitive' } },
        { firstName: { contains: opts.search, mode: 'insensitive' } },
        { lastName:  { contains: opts.search, mode: 'insensitive' } },
      ],
    }
  }
  const [items, total] = await Promise.all([
    prisma.affiliateAccount.findMany({
      where,
      include: {
        user:   { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { clicks: true, conversions: true, commissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliateAccount.count({ where }),
  ])
  return { items, total }
}

export async function listAdminPayoutRequests(opts: { status?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status) where['status'] = opts.status
  const [items, total] = await Promise.all([
    prisma.affiliatePayoutRequest.findMany({
      where,
      include: {
        affiliateAccount: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { requestedAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliatePayoutRequest.count({ where }),
  ])
  return { items, total }
}

export async function listAdminCommissions(opts: { status?: string; affiliateId?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status)      where['status']             = opts.status
  if (opts.affiliateId) where['affiliateAccountId'] = opts.affiliateId
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      include: {
        affiliateAccount: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        affiliateConversion: { select: { conversionType: true, conversionValue: true, occurredAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliateCommission.count({ where }),
  ])
  return { items, total }
}

export async function getRecentClicks(affiliateAccountId: string, limit = 20) {
  return prisma.affiliateClick.findMany({
    where:   { affiliateAccountId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}
