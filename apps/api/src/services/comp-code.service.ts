/**
 * Comp-code service — generate single-use Stripe promotion codes that grant
 * 100%-off access to a specific plan tier.
 *
 * Architecture:
 *   - 4 tier-scoped Coupons live in Stripe Dashboard (BASIC, PRO, PREMIER,
 *     ENTERPRISE). Each is `100% off forever` and `applies_to` only that
 *     plan's product. Each is tagged with `metadata.tier = <TIER>` so we can
 *     find it via API. See docs/runbook-comp-codes-setup.md for one-time setup.
 *   - Admin clicks "Generate" in /admin/comp-codes → we create a fresh
 *     single-use Promotion Code attached to the matching coupon.
 *   - Recipient redeems the code at Stripe Checkout. Stripe enforces tier
 *     scope (a Premier code cannot be redeemed against an Enterprise plan)
 *     and single-use limit. Our existing checkout.session.completed handler
 *     fires normally on the resulting $0 subscription and grants entitlements.
 *
 * Stripe is the source of truth — no parallel DB table. We list/create/
 * deactivate via Stripe's promotion-code API, with metadata carrying the
 * recipient/purpose/auditing fields.
 */

import { AppError } from '@voiceautomation/shared'
import { getStripe } from '../lib/stripe.js'
import { prisma } from '../lib/prisma.js'

/** Map tier enum (used in Stripe coupon metadata) → Plan.code (DB row). */
const TIER_TO_PLAN_CODE: Record<'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE', string> = {
  BASIC:      'basic_monthly',
  PRO:        'pro_monthly',
  PREMIER:    'premier_monthly',
  ENTERPRISE: 'enterprise_monthly',
}

/**
 * Build the "magic" Stripe checkout URL that lands the recipient on a fully
 * pre-filled checkout — plan loaded, email populated, comp code applied.
 * Recipient just clicks Subscribe.
 *
 * Returns null if the plan has no stripeBuyLinkUrl configured (admin needs
 * to create the Payment Link in Stripe and store its URL on the Plan row).
 */
async function buildCheckoutUrl(
  tier:           'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE',
  recipientEmail: string,
  code:           string,
): Promise<string | null> {
  const plan = await prisma.plan.findUnique({
    where:  { code: TIER_TO_PLAN_CODE[tier] },
    select: { stripeBuyLinkUrl: true },
  })
  if (!plan?.stripeBuyLinkUrl) return null
  const params = new URLSearchParams()
  params.set('prefilled_email', recipientEmail)
  params.set('prefilled_promo_code', code)
  return `${plan.stripeBuyLinkUrl}?${params.toString()}`
}

/** Returns the Stripe client if STRIPE_SECRET_KEY is configured, else null.
 *  Lets read endpoints (config-status, list) degrade to empty/false rather
 *  than 500 when Stripe isn't set up yet. */
function tryGetStripe(): ReturnType<typeof getStripe> | null {
  try {
    return getStripe()
  } catch {
    return null
  }
}

// Local minimal types for the Stripe objects we touch — keeps us decoupled
// from the Stripe SDK's namespace shape which has shifted between versions.
interface StripeCoupon {
  id:        string
  valid:     boolean
  metadata:  Record<string, string> | null
}

interface StripePromotionCode {
  id:               string
  code:             string
  active:           boolean
  times_redeemed:   number
  max_redemptions:  number | null
  created:          number
  promotion:        { type: 'coupon'; coupon: string | { id: string } | null }
  metadata:         Record<string, string> | null
}

export type CompCodeTier = 'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE'
export const COMP_TIERS: readonly CompCodeTier[] = ['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE']

export interface CompCodeListItem {
  id:               string         // Stripe promotion code ID (promo_...)
  code:             string         // The redeemable string (e.g. PREMIER-X9F2QM)
  tier:             CompCodeTier
  recipientName:    string
  recipientEmail:   string
  purpose:          string
  generatedBy:      string         // userId of the admin who generated it
  generatedAt:      string         // ISO timestamp
  active:           boolean        // true = still redeemable
  timesRedeemed:    number
  maxRedemptions:   number
  redeemed:         boolean        // shorthand: timesRedeemed >= maxRedemptions
  /** Magic checkout URL with email + promo code pre-filled. Null if the
   *  Plan row has no stripeBuyLinkUrl configured. */
  checkoutUrl:      string | null
}

// In-memory cache of tier → coupon ID. 60s TTL. Stripe is the source of
// truth; cache exists to avoid round-trips on every list/generate call.
// Re-checked on cache miss or admin coupon change.
const COUPON_CACHE = new Map<CompCodeTier, { id: string; cachedAt: number }>()
const CACHE_TTL_MS = 60_000

/**
 * Look up the Stripe coupon ID for a tier by listing coupons and finding
 * one with `metadata.tier === <tier>` AND `valid === true`. Returns null
 * if not configured (admin needs to create the coupon in Stripe Dashboard).
 */
export async function getCouponIdForTier(tier: CompCodeTier): Promise<string | null> {
  const cached = COUPON_CACHE.get(tier)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.id

  const stripe = tryGetStripe()
  if (!stripe) return null

  // Stripe API: coupons.list returns up to 100 by default; we expect 4 comp
  // coupons + maybe a few promotional ones — well under the limit.
  const list = await stripe.coupons.list({ limit: 100 })
  const coupon = (list.data as unknown as StripeCoupon[]).find(c => c.metadata?.['tier'] === tier && c.valid)
  if (!coupon) {
    COUPON_CACHE.delete(tier)
    return null
  }
  COUPON_CACHE.set(tier, { id: coupon.id, cachedAt: Date.now() })
  return coupon.id
}

/** Tier configured-status report — used by admin UI to grey out tiers
 *  whose coupon hasn't been set up yet. */
export async function getConfigStatus(): Promise<Record<CompCodeTier, boolean>> {
  const result: Record<string, boolean> = {}
  for (const tier of COMP_TIERS) {
    result[tier] = (await getCouponIdForTier(tier)) !== null
  }
  return result as Record<CompCodeTier, boolean>
}

/**
 * Generate a human-readable, single-use code for a tier.
 * Format: `{TIER}-{6 unambiguous alphanumeric chars}`
 *
 * The alphabet excludes 0/O and 1/I/l to avoid transcription mistakes when
 * the recipient reads or types the code from an email.
 */
function generateCodeString(tier: CompCodeTier): string {
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  }
  return `${tier}-${suffix}`
}

interface GenerateInput {
  tier:           CompCodeTier
  recipientName:  string
  recipientEmail: string
  purpose?:       string
  generatedBy:    string  // admin user ID
}

export async function generateCompCode(input: GenerateInput): Promise<CompCodeListItem> {
  if (!COMP_TIERS.includes(input.tier)) {
    throw new AppError('VALIDATION_ERROR', `Invalid tier: ${input.tier}`, 422)
  }

  const stripe = tryGetStripe()
  if (!stripe) {
    throw new AppError('BAD_REQUEST', 'Stripe is not configured. Set STRIPE_SECRET_KEY in Admin → System Settings before generating comp codes.', 400)
  }

  const couponId = await getCouponIdForTier(input.tier)
  if (!couponId) {
    throw new AppError(
      'BAD_REQUEST',
      `No comp coupon configured for tier ${input.tier}. See docs/runbook-comp-codes-setup.md to create the coupon in Stripe Dashboard.`,
      400,
    )
  }
  const code = generateCodeString(input.tier)
  const generatedAt = new Date().toISOString()

  // Retry once on rare 409 (collision) since the random suffix has 31^6
  // entropy (~887 million) — collision realistically never happens, but if
  // it does, just regenerate.
  let promo
  try {
    promo = await stripe.promotionCodes.create({
      promotion:       { type: 'coupon', coupon: couponId },
      code,
      max_redemptions: 1,
      active:          true,
      metadata: {
        tier:           input.tier,
        recipientName:  input.recipientName,
        recipientEmail: input.recipientEmail,
        purpose:        input.purpose ?? '',
        generatedBy:    input.generatedBy,
        generatedAt,
      },
    })
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    // Stripe returns "code_already_exists" if the code string is taken
    if (e?.code === 'code_already_exists') {
      const retryCode = generateCodeString(input.tier)
      promo = await stripe.promotionCodes.create({
        promotion:       { type: 'coupon', coupon: couponId },
        code:            retryCode,
        max_redemptions: 1,
        active:          true,
        metadata: {
          tier:           input.tier,
          recipientName:  input.recipientName,
          recipientEmail: input.recipientEmail,
          purpose:        input.purpose ?? '',
          generatedBy:    input.generatedBy,
          generatedAt,
        },
      })
    } else {
      throw err
    }
  }

  const formatted = formatCompCode(promo as unknown as RawPromo)
  formatted.checkoutUrl = await buildCheckoutUrl(input.tier, input.recipientEmail, formatted.code)
  return formatted
}

interface RawPromo {
  id:               string
  code:             string
  active:           boolean
  times_redeemed:   number
  max_redemptions:  number | null
  created:          number
  promotion:        { type: 'coupon'; coupon: string | { id: string } | null }
  metadata:         Record<string, string> | null
}

function formatCompCode(promo: RawPromo): CompCodeListItem {
  const tier = (promo.metadata?.['tier'] ?? 'BASIC') as CompCodeTier
  const max  = promo.max_redemptions ?? 1
  return {
    id:             promo.id,
    code:           promo.code,
    tier,
    recipientName:  promo.metadata?.['recipientName']  ?? '',
    recipientEmail: promo.metadata?.['recipientEmail'] ?? '',
    purpose:        promo.metadata?.['purpose']        ?? '',
    generatedBy:    promo.metadata?.['generatedBy']    ?? '',
    generatedAt:    promo.metadata?.['generatedAt']    ?? new Date(promo.created * 1000).toISOString(),
    active:         promo.active && promo.times_redeemed < max,
    timesRedeemed:  promo.times_redeemed,
    maxRedemptions: max,
    redeemed:       promo.times_redeemed >= max,
    checkoutUrl:    null,  // populated by callers that need it (one DB read per call to buildCheckoutUrl)
  }
}

export async function listCompCodes(filters?: { tier?: CompCodeTier }): Promise<CompCodeListItem[]> {
  const stripe = tryGetStripe()
  if (!stripe) return []

  // Resolve our 4 comp coupon IDs so we can filter to just our managed codes
  // (Stripe may have other promotion codes in the account for marketing
  // discounts; we only show comp-code admin a list of OUR codes.)
  const ourCouponIds = new Set<string>()
  for (const tier of COMP_TIERS) {
    const id = await getCouponIdForTier(tier)
    if (id) ourCouponIds.add(id)
  }
  if (ourCouponIds.size === 0) return []

  // Stripe's promotionCodes.list doesn't filter by coupon-list, so list and
  // filter client-side. 100 is the API maximum per page; if we ever exceed
  // 100 active comp codes per call we'll need to paginate.
  const all = await stripe.promotionCodes.list({ limit: 100 })
  const ours = (all.data as unknown as StripePromotionCode[]).filter(p => {
    const c = p.promotion?.coupon
    if (!c) return false
    const couponId = typeof c === 'string' ? c : c.id
    return ourCouponIds.has(couponId)
  })

  const formatted = ours.map(p => formatCompCode(p as unknown as RawPromo))

  // Resolve buyLinkUrl per tier ONCE, then build the magic checkout URL for
  // each comp code without an extra DB hit per row.
  const tierBuyLinks = new Map<CompCodeTier, string | null>()
  for (const tier of COMP_TIERS) {
    const plan = await prisma.plan.findUnique({
      where:  { code: TIER_TO_PLAN_CODE[tier] },
      select: { stripeBuyLinkUrl: true },
    })
    tierBuyLinks.set(tier, plan?.stripeBuyLinkUrl ?? null)
  }
  for (const item of formatted) {
    const buyUrl = tierBuyLinks.get(item.tier)
    if (!buyUrl) continue
    const params = new URLSearchParams({
      prefilled_email:      item.recipientEmail,
      prefilled_promo_code: item.code,
    })
    item.checkoutUrl = `${buyUrl}?${params.toString()}`
  }

  if (filters?.tier) return formatted.filter(c => c.tier === filters.tier)
  return formatted
}

/**
 * Deactivate an unredeemed comp code. Stripe doesn't truly delete promotion
 * codes — flipping `active: false` permanently kills it. Cannot be reversed.
 *
 * Refuses to deactivate codes that have already been redeemed (would be a
 * no-op) and codes that aren't ours (safety check via metadata.tier).
 */
export async function disableCompCode(promotionCodeId: string): Promise<CompCodeListItem> {
  const stripe = tryGetStripe()
  if (!stripe) {
    throw new AppError('BAD_REQUEST', 'Stripe is not configured. Cannot disable comp codes.', 400)
  }
  const existing = await stripe.promotionCodes.retrieve(promotionCodeId)

  const tier = existing.metadata?.['tier'] as CompCodeTier | undefined
  if (!tier || !COMP_TIERS.includes(tier)) {
    throw new AppError('NOT_FOUND', 'Promotion code is not a managed comp code', 404)
  }

  const max = existing.max_redemptions ?? 1
  if (existing.times_redeemed >= max) {
    throw new AppError('CONFLICT', 'Cannot disable a code that has already been redeemed', 409)
  }

  const updated = await stripe.promotionCodes.update(promotionCodeId, { active: false })
  return formatCompCode(updated as unknown as RawPromo)
}
