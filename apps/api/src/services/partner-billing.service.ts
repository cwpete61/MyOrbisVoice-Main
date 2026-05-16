/**
 * Partner-side Stripe billing for paid resources (phone numbers, today; more
 * paid features later). All flows here are partner-scoped + isolated from
 * the tenant Stripe customer surface (separate Stripe Customer per partner).
 *
 * Phase G.1.B-2.
 *
 * Cost model recap:
 *   VOICE      → $2/mo  (US local, voice in+out)
 *   VOICE_SMS  → $15/mo (US local, voice + SMS w/ A2P)
 *   TOLLFREE   → $5/mo  (toll-free, voice + SMS)
 *
 * Stripe Products + Prices are auto-provisioned on first use and the IDs
 * cached in SystemConfig so we never burn API calls re-resolving them.
 */
import { prisma } from '../lib/prisma.js'
import { getStripe } from '../lib/stripe.js'
import { getConfigValue, setConfigValue } from './system-config.service.js'
import { ensureMasterOrbyAgent } from './agent.service.js'
import { AppError } from '@voiceautomation/shared'

export type PartnerNumberTier = 'VOICE' | 'VOICE_SMS' | 'TOLLFREE'

const TIER_DEFS: Record<PartnerNumberTier, { name: string; description: string; unitAmount: number }> = {
  VOICE:     { name: 'Partner Phone Number — Voice',       description: 'US local number with inbound + outbound voice. No SMS.',         unitAmount: 200  }, // $2.00
  VOICE_SMS: { name: 'Partner Phone Number — Voice + SMS', description: 'US local number with voice + SMS (A2P brand registration included).', unitAmount: 1500 }, // $15.00
  TOLLFREE:  { name: 'Partner Phone Number — Toll-Free',   description: 'Toll-free number with voice + SMS (separate verification).',     unitAmount: 500  }, // $5.00
}

function configKey(tier: PartnerNumberTier): string {
  return `stripe_partner_number_price_${tier.toLowerCase()}`
}

/**
 * Find or create the Stripe Product + recurring Price for a given tier.
 * IDs are cached in SystemConfig (keyed by tier) so we don't re-create on
 * every call. The cached ID is verified against Stripe once per process
 * lifetime — if Stripe has lost the price (e.g. someone archived it in the
 * dashboard) we re-provision.
 *
 * Safe to call concurrently — Stripe Product/Price creation is idempotent
 * via `idempotencyKey`.
 */
export async function ensurePartnerNumberPriceForTier(tier: PartnerNumberTier): Promise<{ priceId: string; productId: string }> {
  const stripe = getStripe()
  const key = configKey(tier)

  // Check the cache
  const cached = await getConfigValue(key).catch(() => null)
  if (cached) {
    try {
      const price = await stripe.prices.retrieve(cached)
      if (price && price.active) {
        return { priceId: cached, productId: (price.product as string) }
      }
    } catch { /* fall through to re-provision */ }
  }

  // Create Product + Price atomically. Idempotency key uses the tier string
  // so calling twice for the same tier returns the same Stripe objects.
  const def = TIER_DEFS[tier]
  const product = await stripe.products.create(
    {
      name:        def.name,
      description: def.description,
      metadata:    { tier, scope: 'partner_phone_number' },
    },
    { idempotencyKey: `partner_number_product_${tier}` },
  )
  const price = await stripe.prices.create(
    {
      product:     product.id,
      unit_amount: def.unitAmount,
      currency:    'usd',
      recurring:   { interval: 'month' },
      metadata:    { tier, scope: 'partner_phone_number' },
    },
    { idempotencyKey: `partner_number_price_${tier}_v1` },
  )

  // isSecret=false (Price IDs are not secrets), updatedBy='system' (auto-provisioned by code, not a user).
  await setConfigValue(key, price.id, false, 'system')
  return { priceId: price.id, productId: product.id }
}

/**
 * Get or create the partner's Stripe Customer. One Customer per partner —
 * holds saved cards + all the partner's Subscriptions for paid resources.
 */
export async function ensurePartnerStripeCustomer(partnerId: string): Promise<{ stripeCustomerId: string }> {
  const stripe = getStripe()
  const existing = await prisma.partnerStripeCustomerRef.findUnique({ where: { partnerId } })
  if (existing) return { stripeCustomerId: existing.stripeCustomerId }

  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const fullName = partner.displayName
    ?? [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ').trim()
    ?? partner.slug
    ?? 'Partner'

  const customer = await stripe.customers.create(
    {
      email:    partner.user.email,
      name:     fullName,
      metadata: { affiliateAccountId: partner.id, partnerSlug: partner.slug ?? '', scope: 'partner' },
    },
    { idempotencyKey: `partner_customer_${partner.id}` },
  )

  await prisma.partnerStripeCustomerRef.create({
    data: { partnerId, stripeCustomerId: customer.id },
  })

  return { stripeCustomerId: customer.id }
}

/**
 * Create a Stripe Checkout session in setup mode so the partner can save a
 * card to their Customer. Stripe-hosted — no Stripe Elements needed in the
 * web app, no PCI exposure. After completion Stripe redirects back to the
 * partner portal with ?setup=success.
 */
export async function createPartnerSetupSession(
  partnerId: string,
  opts: { returnUrl: string; cancelUrl: string },
): Promise<{ url: string }> {
  const stripe = getStripe()
  const { stripeCustomerId } = await ensurePartnerStripeCustomer(partnerId)

  const session = await stripe.checkout.sessions.create({
    mode:        'setup',
    customer:    stripeCustomerId,
    payment_method_types: ['card'],
    success_url: opts.returnUrl,
    cancel_url:  opts.cancelUrl,
    metadata:    { partnerId, scope: 'partner_card_setup' },
  })
  if (!session.url) throw new AppError('INTERNAL_ERROR', 'Stripe did not return a setup URL', 500)
  return { url: session.url }
}

/**
 * Check whether a partner has a usable card on file. Hits Stripe (not cached)
 * because card state can change at any time via Stripe Dashboard / failures.
 */
export async function getPartnerPaymentMethodStatus(
  partnerId: string,
): Promise<{ hasCard: boolean; brand: string | null; last4: string | null }> {
  const ref = await prisma.partnerStripeCustomerRef.findUnique({ where: { partnerId } })
  if (!ref) return { hasCard: false, brand: null, last4: null }

  const stripe = getStripe()
  // Use Customer's default payment method if set; else fall back to the most
  // recently added card.
  const customer = await stripe.customers.retrieve(ref.stripeCustomerId)
  if (customer.deleted) return { hasCard: false, brand: null, last4: null }

  let pmId: string | null = null
  const defaultPm = (customer.invoice_settings && customer.invoice_settings.default_payment_method) as string | { id: string } | null | undefined
  if (defaultPm) {
    pmId = typeof defaultPm === 'string' ? defaultPm : defaultPm.id
  } else {
    const list = await stripe.paymentMethods.list({ customer: ref.stripeCustomerId, type: 'card', limit: 1 })
    pmId = list.data[0]?.id ?? null
  }
  if (!pmId) return { hasCard: false, brand: null, last4: null }

  const pm = await stripe.paymentMethods.retrieve(pmId)
  return {
    hasCard: true,
    brand:   pm.card?.brand ?? null,
    last4:   pm.card?.last4 ?? null,
  }
}

/**
 * Resolve the card to charge for a partner, and make it chargeable.
 *
 * The "Add card" flow uses Stripe Checkout in setup mode, which ATTACHES a
 * payment method to the Customer but does NOT promote it to the Customer's
 * `invoice_settings.default_payment_method`. A Subscription created without
 * an explicit payment method bills the default — so an attached-but-not-default
 * card fails with "this customer has no attached payment source or default
 * payment method" even though the partner clearly added a card.
 *
 * This helper closes that gap: it finds the usable card (existing default, or
 * the most-recently-attached card), promotes it to the Customer default if it
 * isn't already (so renewals work too), and returns the id so the caller can
 * also pin it directly on `subscriptions.create`.
 *
 * Returns null when the Customer genuinely has no card attached.
 */
export async function resolvePartnerDefaultPaymentMethod(
  partnerId: string,
): Promise<{ paymentMethodId: string; stripeCustomerId: string } | null> {
  const stripe = getStripe()
  const { stripeCustomerId } = await ensurePartnerStripeCustomer(partnerId)

  const customer = await stripe.customers.retrieve(stripeCustomerId)
  if (customer.deleted) return null

  // Already have a default? Use it.
  const defaultPmRaw = customer.invoice_settings?.default_payment_method as
    | string | { id: string } | null | undefined
  let pmId: string | null = defaultPmRaw
    ? (typeof defaultPmRaw === 'string' ? defaultPmRaw : defaultPmRaw.id)
    : null

  // No default — fall back to the most-recently-attached card and promote it.
  if (!pmId) {
    const list = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card', limit: 1 })
    pmId = list.data[0]?.id ?? null
    if (pmId) {
      // Promote to default so this AND future renewal invoices have a PM.
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: pmId },
      })
    }
  }

  if (!pmId) return null
  return { paymentMethodId: pmId, stripeCustomerId }
}

/**
 * Create a monthly Subscription for a partner-owned phone number. Fired by
 * the admin approval flow once the Twilio purchase + subaccount move are
 * complete. If this throws, the caller MUST rollback the Twilio purchase to
 * keep state atomic.
 *
 * payment_behavior: 'error_if_incomplete' makes Stripe attempt the first
 * payment immediately. Failed card → throws here, caller rolls back. This is
 * the safest mode for our use case (no "subscription exists but isn't paying"
 * states to clean up later).
 *
 * The payment method is resolved + pinned explicitly (see
 * resolvePartnerDefaultPaymentMethod) so an attached-but-not-default card
 * still charges — the bug that rejected Richard Edkins's 2026-05-15 attempts.
 */
export async function createPartnerNumberSubscription(
  partnerId: string,
  phoneNumberId: string,
  tier: PartnerNumberTier,
): Promise<{ subscriptionId: string }> {
  const stripe = getStripe()
  const { priceId } = await ensurePartnerNumberPriceForTier(tier)

  // Resolve the card, promote it to customer default, get its id to pin.
  const pm = await resolvePartnerDefaultPaymentMethod(partnerId)
  if (!pm) {
    throw new AppError('FAILED_PRECONDITION', 'Partner has no card on file. Ask partner to add a card before approving.', 412)
  }

  const subscription = await stripe.subscriptions.create(
    {
      customer:               pm.stripeCustomerId,
      items:                  [{ price: priceId }],
      // Pin the resolved card explicitly — never rely solely on the customer
      // default being set (setup-mode Checkout doesn't reliably set it).
      default_payment_method: pm.paymentMethodId,
      payment_behavior:       'error_if_incomplete',
      metadata: {
        partnerId,
        phoneNumberId,
        tier,
        scope: 'partner_phone_number_monthly',
      },
    },
    { idempotencyKey: `partner_number_sub_${phoneNumberId}` },
  )

  return { subscriptionId: subscription.id }
}

/**
 * Roll back a partner number subscription: refund its first paid invoice +
 * cancel the subscription. Used when a Twilio step fails AFTER the Stripe
 * charge already cleared, so the partner is made whole. Best-effort — logs
 * but never throws, so the caller's rollback can finish.
 */
async function refundAndCancelSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe()
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    })
    const inv = sub.latest_invoice
    if (inv && typeof inv === 'object') {
      const pi = (inv as { payment_intent?: string | { id: string } | null }).payment_intent
      const piId = typeof pi === 'string' ? pi : pi?.id
      if (piId) await stripe.refunds.create({ payment_intent: piId })
    }
  } catch (err) {
    console.error(`[refundAndCancelSubscription] refund failed for ${subscriptionId}: ${(err as Error).message}`)
  }
  try {
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (err) {
    if ((err as { code?: string }).code !== 'resource_missing') {
      console.error(`[refundAndCancelSubscription] cancel failed for ${subscriptionId}: ${(err as Error).message}`)
    }
  }
}

/**
 * End-to-end provisioning for a partner number request.
 *
 * ── PAYMENT-FIRST ordering (Phase G.2.4) ──────────────────────────────────
 * The card is charged BEFORE any money is spent at Twilio:
 *   1. Create the Stripe Subscription — first month charged immediately.
 *      Card fails here → $0 Twilio cost, nothing to roll back.
 *   2. Buy the number on the master Twilio account.
 *   3. Move it to the partner's subaccount.
 * If step 2 or 3 fails, the Stripe charge from step 1 is refunded + the
 * subscription canceled, so a Twilio-side failure never leaves the partner
 * charged for nothing.
 *
 * Why this order: card failures are common; Twilio failures are rare. Buying
 * the Twilio number first meant every failed card still cost a real,
 * non-refundable Twilio number fee on the platform's account. Charging first
 * makes a failed card cost exactly $0.
 *
 * Called from:
 *   - Partner self-service request route (auto-approve flow, current default)
 *   - Admin legacy approve route (only matters for old PENDING rows)
 */
export async function provisionPartnerNumber(args: {
  phoneNumberRowId: string
  actorUserId:      string
  actorType:        'USER' | 'ADMIN'
}): Promise<{
  id:                   string
  status:               'PURCHASED'
  twilioNumberSid:      string
  stripeSubscriptionId: string
}> {
  const { ensurePartnerSubaccount } = await import('./twilio-subaccount.service.js')
  const { getPlatformTwilioClient } = await import('./twilio.service.js')
  const { writeAuditLog }           = await import('../lib/audit.js')

  const row = await prisma.phoneNumber.findUnique({ where: { id: args.phoneNumberRowId } })
  if (!row)                              throw new AppError('NOT_FOUND', 'Number request not found', 404)
  if (row.purchaseStatus === 'PURCHASED') throw new AppError('CONFLICT', 'Number already provisioned', 409)
  if (!row.partnerId)                    throw new AppError('VALIDATION_ERROR', 'Row has no partner', 422)
  if (!row.partnerCapabilityTier)        throw new AppError('VALIDATION_ERROR', 'Row has no tier', 422)

  // Pre-flight — partner must have a card on file before we attempt the buy.
  const card = await getPartnerPaymentMethodStatus(row.partnerId)
  if (!card.hasCard) {
    throw new AppError(
      'FAILED_PRECONDITION',
      'No card on file. Add a card via Phone Numbers → Add card, then try again.',
      412,
    )
  }

  // ── Step 1 — CHARGE FIRST ───────────────────────────────────────────────
  // Create the Stripe Subscription (first month charged immediately). If the
  // card fails this throws here — and we have NOT touched Twilio, so the
  // failure costs the platform exactly $0. No rollback needed.
  let subscriptionId: string
  try {
    const result = await createPartnerNumberSubscription(row.partnerId, row.id, row.partnerCapabilityTier)
    subscriptionId = result.subscriptionId
  } catch (e) {
    const msg = (e as Error).message
    await prisma.phoneNumber.update({
      where: { id: row.id },
      data:  {
        purchaseStatus:   'REJECTED',
        rejectionReason:  `Card charge failed: ${msg.length > 180 ? msg.slice(0, 180) : msg}`,
        approvedAt:       new Date(),
        approvedByUserId: args.actorUserId,
      },
    })
    throw new AppError('PAYMENT_REQUIRED', `Card charge failed: ${msg}`, 402)
  }

  // ── Step 2 — buy the number on master Twilio ────────────────────────────
  // Card is now paid. Provision the subaccount + buy the number. If this
  // fails, refund + cancel the subscription from step 1.
  const sub = await ensurePartnerSubaccount(row.partnerId)
  const masterClient = await getPlatformTwilioClient()

  let purchased
  try {
    purchased = await masterClient.incomingPhoneNumbers.create({
      phoneNumber:  row.e164Number,
      friendlyName: row.displayLabel ?? `Partner ${row.partnerId.slice(0, 8)} — ${row.e164Number}`,
    })
  } catch (e) {
    // Twilio buy failed — undo the charge.
    await refundAndCancelSubscription(subscriptionId)
    const msg = (e as Error).message
    await prisma.phoneNumber.update({
      where: { id: row.id },
      data:  {
        purchaseStatus:   'REJECTED',
        rejectionReason:  msg.length > 200 ? msg.slice(0, 200) : msg,
        approvedAt:       new Date(),
        approvedByUserId: args.actorUserId,
      },
    })
    const isAvail = msg.includes('21422') || msg.includes('not available')
    throw new AppError(
      isAvail ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      isAvail
        ? 'Number no longer available on Twilio. Your card was not charged — re-search and pick another.'
        : `Twilio purchase failed: ${msg}`,
      isAvail ? 404 : 500,
    )
  }

  // ── Step 3 — move to partner subaccount ─────────────────────────────────
  try {
    await masterClient.incomingPhoneNumbers(purchased.sid).update({ accountSid: sub.subaccountSid })
  } catch (e) {
    // Release the just-bought number + undo the charge.
    try { await masterClient.incomingPhoneNumbers(purchased.sid).remove() } catch {}
    await refundAndCancelSubscription(subscriptionId)
    await prisma.phoneNumber.update({
      where: { id: row.id },
      data:  {
        purchaseStatus:   'REJECTED',
        rejectionReason:  `Subaccount move failed: ${(e as Error).message}`.slice(0, 200),
        approvedAt:       new Date(),
        approvedByUserId: args.actorUserId,
      },
    })
    throw new AppError('INTERNAL_ERROR', `Failed to move number to partner subaccount: ${(e as Error).message}`, 500)
  }

  // ── Step 3b — wire webhooks on the number ───────────────────────────────
  // Inbound calls route to our voice handler + status callbacks feed the
  // Phase G.3 voice-usage meter. Non-fatal — a webhook miss doesn't justify
  // a rollback; it can be re-applied later.
  try {
    const { getPartnerSubaccountClient } = await import('./twilio-subaccount.service.js')
    const subClient = await getPartnerSubaccountClient(row.partnerId)
    const apiBase   = process.env['API_BASE_URL'] ?? 'https://api.myorbisvoice.com'
    await subClient.incomingPhoneNumbers(purchased.sid).update({
      voiceUrl:             `${apiBase}/api/webhooks/twilio/voice`,
      voiceMethod:          'POST',
      statusCallback:       `${apiBase}/api/webhooks/twilio/status`,
      statusCallbackMethod: 'POST',
      smsUrl:               `${apiBase}/api/webhooks/twilio/sms`,
      smsMethod:            'POST',
    })
  } catch (e) {
    console.error(`[provisionPartnerNumber] webhook config failed for ${purchased.sid}: ${(e as Error).message}`)
  }

  // Attach the number to the platform-controlled master "Orby" agent so it
  // answers immediately instead of ringing dead. Best-effort — if the master
  // agent can't be resolved, the inbound webhook falls back to it anyway.
  const orbyAgentId = await ensureMasterOrbyAgent()
    .then((a) => a.id)
    .catch((e) => { console.error(`[provisionPartnerNumber] master Orby agent unavailable: ${(e as Error).message}`); return null })

  const updated = await prisma.phoneNumber.update({
    where: { id: row.id },
    data:  {
      purchaseStatus:       'PURCHASED',
      twilioNumberSid:      purchased.sid,
      twilioSubaccountSid:  sub.subaccountSid,
      stripeSubscriptionId: subscriptionId,
      agentProfileId:       orbyAgentId,
      approvedAt:           new Date(),
      approvedByUserId:     args.actorUserId,
      isInboundEnabled:     true,
      isOutboundEnabled:    row.partnerCapabilityTier !== 'TOLLFREE',
      isSmsEnabled:         false,
    },
  })

  // One-time backfill — when a partner's number is provisioned, default their
  // public phone to it if they haven't set one. Never overwrites an existing
  // value; the partner can change or remove it on their profile afterward.
  if (row.partnerId) {
    try {
      const partner = await prisma.affiliateAccount.findUnique({
        where:  { id: row.partnerId },
        select: { partnerPhone: true },
      })
      if (partner && !partner.partnerPhone?.trim()) {
        await prisma.affiliateAccount.update({
          where: { id: row.partnerId },
          data:  { partnerPhone: row.e164Number },
        })
      }
    } catch (e) {
      console.error(`[provisionPartnerNumber] partnerPhone backfill failed: ${(e as Error).message}`)
    }
  }

  writeAuditLog({
    actorType:    args.actorType,
    actorUserId:  args.actorUserId,
    action:       args.actorType === 'ADMIN' ? 'admin.partner_number.approved' : 'partner.number.auto_provisioned',
    targetType:   'PhoneNumber',
    targetId:     row.id,
    metadataJson: {
      phoneNumber:    row.e164Number,
      partnerId:      row.partnerId,
      tier:           row.partnerCapabilityTier,
      twilioSid:      purchased.sid,
      subscriptionId,
    },
  }).catch(() => null)

  return {
    id:                   updated.id,
    status:               'PURCHASED',
    twilioNumberSid:      updated.twilioNumberSid!,
    stripeSubscriptionId: updated.stripeSubscriptionId!,
  }
}

/**
 * Cancel the Stripe Subscription for a partner number. Stripe webhook will
 * fire customer.subscription.deleted which the webhook handler turns into
 * a Twilio number release. Idempotent.
 */
export async function cancelPartnerNumberSubscription(phoneNumberId: string): Promise<void> {
  const row = await prisma.phoneNumber.findUnique({
    where:  { id: phoneNumberId },
    select: { stripeSubscriptionId: true },
  })
  if (!row?.stripeSubscriptionId) return
  const stripe = getStripe()
  try {
    await stripe.subscriptions.cancel(row.stripeSubscriptionId)
  } catch (err) {
    // If already canceled or not found, ignore — caller flow should still proceed.
    const code = (err as { code?: string }).code
    if (code === 'resource_missing') return
    throw err
  }
}
