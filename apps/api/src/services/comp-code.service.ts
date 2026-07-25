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

/** Map tier enum (used in Stripe coupon metadata) → Plan.code (DB row).
 *  BASIC/PRO/PREMIER/ENTERPRISE are the MyOrbisVoice tiers; SOLO_CAPTURE /
 *  SOLO_POWER are the MyOrbisAgents (real-estate) packages. Each tier's coupon
 *  is scoped in Stripe to only its plan's product, so a code for one tier
 *  cannot be redeemed against another. */
const TIER_TO_PLAN_CODE: Record<CompCodeTier, string> = {
  BASIC:        'basic_monthly',
  PRO:          'pro_monthly',
  PREMIER:      'premier_monthly',
  ENTERPRISE:   'enterprise_monthly',
  SOLO_CAPTURE: 'solo_capture',
  SOLO_POWER:   'solo_power',
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
  tier:           CompCodeTier,
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

export type CompCodeTier = 'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE' | 'SOLO_CAPTURE' | 'SOLO_POWER'
export const COMP_TIERS: readonly CompCodeTier[] = ['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE', 'SOLO_CAPTURE', 'SOLO_POWER']
/** The MyOrbisVoice comp tiers (shown on api.myorbisvoice.com admin). */
export const VOICE_COMP_TIERS: readonly CompCodeTier[] = ['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE']
/** The MyOrbisAgents comp tiers (shown on api.myorbisagents.com admin). */
export const AGENT_COMP_TIERS: readonly CompCodeTier[] = ['SOLO_CAPTURE', 'SOLO_POWER']

export interface CompCodeListItem {
  id:               string         // Stripe promotion code ID (promo_...)
  code:             string         // The redeemable string (e.g. PREMIER-X9F2QM)
  tier:             CompCodeTier
  /** 'comp' = 100%-off comp code (pre-made tier coupon). 'discount' = partial
   *  off (percent or amount), coupon created on the fly. */
  kind:             'comp' | 'discount'
  /** Human label for a discount, e.g. "20% off · 3 months" or "$10 off · once".
   *  Null for comp codes. */
  discountLabel:    string | null
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

export interface GenerateDiscountInput {
  tier:            CompCodeTier
  discountType:    'PERCENT' | 'AMOUNT'
  value:           number   // percent (1-99) or dollars
  duration:        'once' | 'repeating' | 'forever'
  durationMonths?: number   // required when duration = 'repeating'
  recipientName:   string
  recipientEmail:  string
  purpose?:        string
  maxRedemptions?: number   // default 1
  generatedBy:     string
}

/**
 * Generate a partial-discount promotion code (% or $ off, single-use by default).
 * Unlike comp codes (pre-made 100%-off tier coupons), this creates the coupon on
 * the fly with the admin's chosen amount + duration, scoped to the tier's plan
 * product. Tagged metadata.kind='discount' so it shows on the comp-codes admin.
 */
export async function generateDiscountCode(input: GenerateDiscountInput): Promise<CompCodeListItem> {
  if (!COMP_TIERS.includes(input.tier)) throw new AppError('VALIDATION_ERROR', `Invalid tier: ${input.tier}`, 422)
  if (input.discountType === 'PERCENT' && (input.value <= 0 || input.value >= 100)) {
    throw new AppError('VALIDATION_ERROR', 'Percent discount must be between 1 and 99', 422)
  }
  if (input.discountType === 'AMOUNT' && (!Number.isFinite(input.value) || input.value <= 0 || input.value > 100000)) {
    throw new AppError('VALIDATION_ERROR', 'Amount discount must be between $0 and $100,000', 422)
  }
  if (input.duration === 'repeating' && (!input.durationMonths || input.durationMonths < 1)) {
    throw new AppError('VALIDATION_ERROR', 'A repeating discount needs a month count (≥ 1)', 422)
  }

  const stripe = tryGetStripe()
  if (!stripe) {
    throw new AppError('BAD_REQUEST', 'Stripe is not configured. Set STRIPE_SECRET_KEY in Admin → System Settings first.', 400)
  }

  // Scope the coupon to this tier's plan product (resolve product from its price)
  // so a discount for one plan can't be redeemed against another.
  const plan = await prisma.plan.findUnique({ where: { code: TIER_TO_PLAN_CODE[input.tier] }, select: { stripePriceId: true } })
  let appliesTo: { products: string[] } | undefined
  if (plan?.stripePriceId) {
    try {
      const price = await stripe.prices.retrieve(plan.stripePriceId)
      const prod = typeof price.product === 'string' ? price.product : (price.product as { id?: string })?.id
      if (prod) appliesTo = { products: [prod] }
    } catch { /* leave unscoped if the product can't be resolved */ }
  }

  const coupon = await stripe.coupons.create({
    ...(input.discountType === 'PERCENT'
      ? { percent_off: input.value }
      : { amount_off: Math.round(input.value * 100), currency: 'usd' }),
    duration: input.duration,
    ...(input.duration === 'repeating' ? { duration_in_months: input.durationMonths } : {}),
    ...(appliesTo ? { applies_to: appliesTo } : {}),
    name: `${input.discountType === 'AMOUNT' ? '$' + input.value : input.value + '%'} off ${input.tier}`,
    metadata: { kind: 'discount', tier: input.tier },
  })

  const generatedAt = new Date().toISOString()
  const meta: Record<string, string> = {
    kind:           'discount',
    tier:           input.tier,
    discountType:   input.discountType,
    value:          String(input.value),
    duration:       input.duration,
    durationMonths: input.durationMonths ? String(input.durationMonths) : '',
    recipientName:  input.recipientName,
    recipientEmail: input.recipientEmail,
    purpose:        input.purpose ?? '',
    generatedBy:    input.generatedBy,
    generatedAt,
  }

  let code = generateCodeString(input.tier)
  let promo
  try {
    promo = await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: coupon.id }, code, max_redemptions: input.maxRedemptions ?? 1, active: true, metadata: meta })
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'code_already_exists') {
      code = generateCodeString(input.tier)
      promo = await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: coupon.id }, code, max_redemptions: input.maxRedemptions ?? 1, active: true, metadata: meta })
    } else throw err
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

/** Build a "20% off · 3 months" style label from discount metadata. */
function discountLabelFromMeta(m: Record<string, string> | null): string | null {
  if (!m || m['kind'] !== 'discount') return null
  const amount = m['discountType'] === 'AMOUNT' ? `$${m['value']} off` : `${m['value']}% off`
  const dur = m['duration'] === 'repeating' ? `${m['durationMonths']} months`
    : m['duration'] === 'forever' ? 'forever'
    : 'first payment'
  return `${amount} · ${dur}`
}

function formatCompCode(promo: RawPromo): CompCodeListItem {
  const tier = (promo.metadata?.['tier'] ?? 'BASIC') as CompCodeTier
  const max  = promo.max_redemptions ?? 1
  const kind = promo.metadata?.['kind'] === 'discount' ? 'discount' : 'comp'
  return {
    id:             promo.id,
    code:           promo.code,
    tier,
    kind,
    discountLabel:  discountLabelFromMeta(promo.metadata),
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
    // Discount codes we created carry metadata.kind='discount' (their coupons
    // are one-off, not in ourCouponIds), so match those by metadata too.
    if (p.metadata?.['kind'] === 'discount' && p.metadata?.['generatedBy']) return true
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
