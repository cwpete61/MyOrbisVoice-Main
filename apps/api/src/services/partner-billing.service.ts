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
 * Create a monthly Subscription for a partner-owned phone number. Fired by
 * the admin approval flow once the Twilio purchase + subaccount move are
 * complete. If this throws, the caller MUST rollback the Twilio purchase to
 * keep state atomic.
 *
 * payment_behavior: 'error_if_incomplete' makes Stripe attempt the first
 * payment immediately. Failed card → throws here, caller rolls back. This is
 * the safest mode for our use case (no "subscription exists but isn't paying"
 * states to clean up later).
 */
export async function createPartnerNumberSubscription(
  partnerId: string,
  phoneNumberId: string,
  tier: PartnerNumberTier,
): Promise<{ subscriptionId: string }> {
  const stripe = getStripe()
  const { stripeCustomerId } = await ensurePartnerStripeCustomer(partnerId)
  const { priceId } = await ensurePartnerNumberPriceForTier(tier)

  // Verify customer has a usable default payment method — else Stripe will
  // throw a confusing "no default payment method" error.
  const cardStatus = await getPartnerPaymentMethodStatus(partnerId)
  if (!cardStatus.hasCard) {
    throw new AppError('FAILED_PRECONDITION', 'Partner has no card on file. Ask partner to add a card before approving.', 412)
  }

  const subscription = await stripe.subscriptions.create(
    {
      customer: stripeCustomerId,
      items:    [{ price: priceId }],
      payment_behavior: 'error_if_incomplete',
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
 * End-to-end provisioning for a partner number request. Encapsulates the
 * 3-step atomic flow:
 *   1. Buy the number on the master Twilio account
 *   2. Move it to the partner's subaccount
 *   3. Create a Stripe Subscription (first charge runs immediately)
 *
 * If any step fails, earlier steps are rolled back so we never leave the
 * partner with a Twilio number they aren't paying for (or a subscription
 * pointing at a number that doesn't exist). Returns the updated row.
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

  const sub = await ensurePartnerSubaccount(row.partnerId)
  const masterClient = await getPlatformTwilioClient()

  // Step 1 — buy on master.
  let purchased
  try {
    purchased = await masterClient.incomingPhoneNumbers.create({
      phoneNumber:  row.e164Number,
      friendlyName: row.displayLabel ?? `Partner ${row.partnerId.slice(0, 8)} — ${row.e164Number}`,
    })
  } catch (e) {
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
      isAvail ? 'Number no longer available on Twilio. Re-search and pick another.' : `Twilio purchase failed: ${msg}`,
      isAvail ? 404 : 500,
    )
  }

  // Step 2 — move to partner subaccount.
  try {
    await masterClient.incomingPhoneNumbers(purchased.sid).update({ accountSid: sub.subaccountSid })
  } catch (e) {
    try { await masterClient.incomingPhoneNumbers(purchased.sid).remove() } catch {}
    throw new AppError('INTERNAL_ERROR', `Failed to move number to partner subaccount: ${(e as Error).message}`, 500)
  }

  // Step 3 — Stripe Subscription. payment_behavior='error_if_incomplete' so we
  // know the first charge cleared before we mark PURCHASED. On failure we
  // release the Twilio number to keep state atomic.
  let subscriptionId: string
  try {
    const result = await createPartnerNumberSubscription(row.partnerId, row.id, row.partnerCapabilityTier)
    subscriptionId = result.subscriptionId
  } catch (e) {
    try { await masterClient.incomingPhoneNumbers(purchased.sid).remove() } catch {}
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

  const updated = await prisma.phoneNumber.update({
    where: { id: row.id },
    data:  {
      purchaseStatus:       'PURCHASED',
      twilioNumberSid:      purchased.sid,
      twilioSubaccountSid:  sub.subaccountSid,
      stripeSubscriptionId: subscriptionId,
      approvedAt:           new Date(),
      approvedByUserId:     args.actorUserId,
      isInboundEnabled:     true,
      isOutboundEnabled:    row.partnerCapabilityTier !== 'TOLLFREE',
      isSmsEnabled:         false,
    },
  })

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
