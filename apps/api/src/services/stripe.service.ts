import { prisma } from '../lib/prisma.js'
import { getStripe, getWebhookSecrets } from '../lib/stripe.js'
import { getEnv } from '@voiceautomation/config'
import { AppError } from '@voiceautomation/shared'
import { syncEntitlementsFromPlan } from './entitlement.service.js'
import { writeAuditLog } from '../lib/audit.js'

// Minimal shapes we extract from Stripe webhook objects
interface StripeSub {
  id: string
  status: string
  metadata?: Record<string, string> | null
  canceled_at: number | null
  cancel_at_period_end: boolean
  items: { data: Array<{ current_period_start: number; current_period_end: number }> }
}

interface StripeInvoice {
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string } | null
    } | null
  } | null
}

interface StripeCheckoutSession {
  id?: string
  mode?: 'subscription' | 'payment' | 'setup'
  metadata?: Record<string, string> | null
  subscription?: string | { id: string } | null
  payment_intent?: string | { id: string } | null
  amount_total?: number | null
}

interface StripeCharge {
  id: string
  amount: number
  amount_refunded: number
  payment_intent: string | null
  invoice: string | null
}

interface StripeDispute {
  id: string
  charge: string | null
  payment_intent: string | null
  reason: string
  status: string
  amount: number
}

interface StripeConnectAccount {
  id: string
  details_submitted?: boolean
  payouts_enabled?: boolean
  charges_enabled?: boolean
  requirements?: { disabled_reason?: string | null } | null
}

export async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
  const existing = await prisma.stripeCustomerRef.findUnique({ where: { tenantId } })
  if (existing) return existing.stripeCustomerId

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: tenant.registrationEmail ?? undefined,
    name: tenant.displayName,
    metadata: { tenantId },
  })

  await prisma.stripeCustomerRef.create({
    data: { tenantId, stripeCustomerId: customer.id },
  })

  return customer.id
}

export async function createCheckoutSession(
  tenantId: string,
  planCode: string,
): Promise<{ url: string }> {
  const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } })
  if (!plan) throw new AppError('NOT_FOUND', 'Plan not found', 404)
  if (!plan.stripePriceId) throw new AppError('BAD_REQUEST', 'Plan has no Stripe price configured', 400)

  const env = getEnv()
  const stripe = getStripe()
  const customerId = await getOrCreateStripeCustomer(tenantId)

  // Bundled plan = ONE_TIME plan with a non-null stripeRecurringPriceId.
  // Today only LTD uses this: $497 one-time at checkout (lifetime access)
  // PLUS $24.99/mo recurring (token coverage) with a 30-day trial so the
  // recurring doesn't bill until day 31. Customer pays $497 day 1, then
  // $24.99/mo from day 31 until they cancel. Cancelling the recurring
  // does NOT revoke the lifetime entitlements — see customer.subscription
  // .deleted handler below.
  const hasRecurringAddon = plan.interval === 'ONE_TIME' && !!plan.stripeRecurringPriceId
  const isOneTime         = plan.interval === 'ONE_TIME' && !hasRecurringAddon

  const baseSessionConfig = {
    customer: customerId,
    success_url: `${env.APP_BASE_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url:  `${env.APP_BASE_URL}/billing?status=cancelled`,
    metadata:    { tenantId, planCode },
    // Allow customers to enter a Promotion Code at checkout (e.g. comp codes
    // generated from /admin/comp-codes). Comp codes are 100%-off coupons
    // restricted via `applies_to.products` to the matching plan tier — Stripe
    // enforces that scope, so a Premier comp code cannot be redeemed against
    // an Enterprise checkout.
    allow_promotion_codes: true,
    // For $0 subscriptions (after a 100%-off comp code is applied) skip card
    // collection. Stripe only collects a payment method if the final due
    // amount is non-zero. Without this flag, even free subscriptions force a
    // card on file, breaking the comp-code UX.
    payment_method_collection: 'if_required' as const,
  }

  let session
  if (hasRecurringAddon) {
    // LTD-style bundled plan: one-time + recurring with trial
    session = await stripe.checkout.sessions.create({
      ...baseSessionConfig,
      mode: 'subscription',
      line_items: [
        { price: plan.stripePriceId,           quantity: 1 },  // $497 one-time
        { price: plan.stripeRecurringPriceId!, quantity: 1 },  // $24.99/mo
      ],
      subscription_data: {
        metadata:           { tenantId, planCode },
        trial_period_days:  30,
      },
    })
  } else if (isOneTime) {
    // Pure one-time payment (no recurring)
    session = await stripe.checkout.sessions.create({
      ...baseSessionConfig,
      mode: 'payment',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      payment_intent_data: { metadata: { tenantId, planCode } },
    })
  } else {
    // Standard recurring subscription
    session = await stripe.checkout.sessions.create({
      ...baseSessionConfig,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      subscription_data: { metadata: { tenantId, planCode } },
    })
  }

  if (!session.url) throw new AppError('INTERNAL_ERROR', 'Failed to create checkout session', 500)
  return { url: session.url }
}

export async function createPortalSession(tenantId: string): Promise<{ url: string }> {
  const ref = await prisma.stripeCustomerRef.findUnique({ where: { tenantId } })
  if (!ref) throw new AppError('BAD_REQUEST', 'No Stripe customer found for this tenant', 400)

  const env = getEnv()
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: ref.stripeCustomerId,
    return_url: `${env.APP_BASE_URL}/billing`,
  })

  return { url: session.url }
}

export async function getSubscription(tenantId: string) {
  return prisma.subscription.findFirst({
    where: { tenantId },
    include: { plan: { include: { entitlements: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const secrets = getWebhookSecrets()
  if (secrets.length === 0) throw new AppError('INTERNAL_ERROR', 'Webhook secret not configured', 500)

  const stripe = getStripe()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: { object: any } } | null = null

  // Try each configured signing secret. We run two destinations in Stripe
  // (platform-events + Connect-events), each with its own secret. The first
  // secret that verifies wins. If none verify, the request is forged.
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret)
      break
    } catch {
      // Try next secret
    }
  }
  if (!event) throw new AppError('BAD_REQUEST', 'Invalid webhook signature', 400)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as StripeCheckoutSession)
      break
    case 'invoice.created':
      await handleInvoiceCreated(event.data.object as StripeInvoice & { id: string; customer: string | { id: string }; period_start: number; period_end: number })
      break
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as StripeInvoice)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as StripeSub)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as StripeSub)
      break
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as StripeCharge)
      break
    case 'charge.dispute.created':
      await handleChargeDisputeCreated(event.data.object as StripeDispute)
      break
    case 'account.updated':
      await handleConnectAccountUpdated(event.data.object as StripeConnectAccount)
      break
    default:
      break
  }
}

// ── Affiliate-commission impact handlers ─────────────────────────────────────
//
// The full chain we need to walk for refunds + disputes:
//   charge → (invoice or payment_intent) → AffiliateConversion → commissions
// AffiliateConversion.subscriptionId stores either the Stripe subscription ID
// (for recurring) or the payment_intent ID (for one-time / LTD), so we look
// up by both possible IDs and take the first hit.

async function findConversionForCharge(charge: { invoice: string | null; payment_intent: string | null }): Promise<{ id: string } | null> {
  const candidates: string[] = []
  if (charge.payment_intent) candidates.push(charge.payment_intent)

  if (charge.invoice) {
    try {
      const stripe = getStripe()
      const inv = await stripe.invoices.retrieve(charge.invoice) as unknown as {
        parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
        subscription?: string | { id: string } | null
      }
      const subRaw = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? null
      const subId = typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
      if (subId) candidates.push(subId)
    } catch {
      // Invoice retrieval failed — fall back to payment_intent only
    }
  }

  if (candidates.length === 0) return null
  return prisma.affiliateConversion.findFirst({
    where: { subscriptionId: { in: candidates } },
    select: { id: true },
  })
}

async function handleChargeRefunded(charge: StripeCharge) {
  const conversion = await findConversionForCharge(charge)
  if (!conversion) return

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateConversionId: conversion.id, status: { in: ['PENDING', 'APPROVED'] } },
    select: { id: true, status: true, amountMinor: true, affiliateAccountId: true, tenantId: true },
  })

  for (const c of commissions) {
    await prisma.affiliateCommission.update({ where: { id: c.id }, data: { status: 'REVERSED' } })
    if (c.status === 'APPROVED') {
      // APPROVED commissions had already been added to totalEarnedCents;
      // PENDING ones never were. Decrement only what we previously credited.
      await prisma.affiliateAccount.update({
        where: { id: c.affiliateAccountId },
        data:  { totalEarnedCents: { decrement: c.amountMinor } },
      })
    }
  }

  // Already-PAID commissions can't be un-paid here — Stripe transfers are
  // one-way. Surface them in audit log so an admin can handle a manual
  // claw-back or future-payout offset.
  const paidCount = await prisma.affiliateCommission.count({
    where: { affiliateConversionId: conversion.id, status: 'PAID' },
  })

  writeAuditLog({
    actorType: 'SYSTEM',
    action:    'affiliate.commission_reversed_refund',
    metadataJson: {
      chargeId: charge.id,
      paymentIntentId: charge.payment_intent,
      invoiceId: charge.invoice,
      amountRefunded: charge.amount_refunded,
      conversionId: conversion.id,
      reversedCount: commissions.length,
      paidCommissionsRequiringAdminAttention: paidCount,
    },
  }).catch(() => null)
}

async function handleChargeDisputeCreated(dispute: StripeDispute) {
  if (!dispute.charge) return
  // Retrieve the underlying charge so we can run the same lookup the refund
  // handler uses.
  let charge: { invoice: string | null; payment_intent: string | null } | null = null
  try {
    const stripe = getStripe()
    const c = await stripe.charges.retrieve(dispute.charge) as unknown as {
      invoice: string | null
      payment_intent: string | null
    }
    charge = { invoice: c.invoice, payment_intent: c.payment_intent }
  } catch {
    return
  }

  const conversion = await findConversionForCharge(charge)
  if (!conversion) return

  const result = await prisma.affiliateCommission.updateMany({
    where:  { affiliateConversionId: conversion.id, status: { in: ['PENDING', 'APPROVED'] } },
    data:   { status: 'HOLD' },
  })

  writeAuditLog({
    actorType: 'SYSTEM',
    action:    'affiliate.commission_held_dispute',
    metadataJson: {
      disputeId: dispute.id,
      chargeId: dispute.charge,
      reason: dispute.reason,
      status: dispute.status,
      amount: dispute.amount,
      conversionId: conversion.id,
      heldCount: result.count,
    },
  }).catch(() => null)
}

async function handleConnectAccountUpdated(account: StripeConnectAccount) {
  const affiliate = await prisma.affiliateAccount.findUnique({
    where:  { stripeConnectAccountId: account.id },
    select: { id: true },
  })
  if (!affiliate) return

  await prisma.affiliateAccount.update({
    where: { id: affiliate.id },
    data: {
      payoutMethodJson: {
        type:             'stripe_connect_express',
        connected:        true,
        detailsSubmitted: !!account.details_submitted,
        payoutsEnabled:   !!account.payouts_enabled,
        chargesEnabled:   !!account.charges_enabled,
        accountId:        account.id,
        disabledReason:   account.requirements?.disabled_reason ?? null,
        refreshedAt:      new Date().toISOString(),
      } as never,
    },
  })

  writeAuditLog({
    actorType: 'SYSTEM',
    action:    'affiliate.connect_status_synced',
    metadataJson: {
      accountId:        account.id,
      affiliateAccountId: affiliate.id,
      payoutsEnabled:   !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      disabledReason:   account.requirements?.disabled_reason ?? null,
    },
  }).catch(() => null)
}

async function handleCheckoutCompleted(session: StripeCheckoutSession) {
  const tenantId = session.metadata?.tenantId
  const planCode = session.metadata?.planCode
  if (!tenantId || !planCode) return

  // One-time payment (LTD) — no subscription, sync entitlements directly from plan
  if (session.mode === 'payment') {
    const plan = await prisma.plan.findFirst({ where: { code: planCode } })
    if (!plan) return
    const { syncEntitlementsFromPlan } = await import('./entitlement.service.js')
    await syncEntitlementsFromPlan(tenantId, plan.id)
    writeAuditLog({ actorType: 'SYSTEM', action: 'billing.checkout_completed', tenantId, metadataJson: { planCode, mode: 'payment', amountTotal: session.amount_total } }).catch(() => null)

    // Record affiliate conversion (one-time payment counts as a conversion)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, referredByCode: true } })
    if (tenant?.referredByCode) {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? session.id ?? ''
      const { recordConversion } = await import('./affiliate.service.js')
      await recordConversion({
        referralCode:        tenant.referredByCode,
        tenantId,
        subscriptionId:      paymentIntentId,
        conversionType:      'one_time',
        conversionValueCents: session.amount_total ?? 0,
      }).catch(() => {})
    }
    return
  }

  // Recurring subscription path
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as { id: string } | null)?.id ?? null

  if (!subscriptionId) return

  const stripe = getStripe()
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data'] })
  await upsertSubscription(tenantId, planCode, stripeSub as unknown as StripeSub)

  writeAuditLog({ actorType: 'SYSTEM', action: 'billing.checkout_completed', tenantId, metadataJson: { planCode, subscriptionId } }).catch(() => null)

  // Record affiliate conversion if this tenant was referred
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, referredByCode: true } })
  if (tenant?.referredByCode) {
    const amountCents = (stripeSub as unknown as { items: { data: { price: { unit_amount: number } }[] } })
      .items?.data?.[0]?.price?.unit_amount ?? 0
    const { recordConversion } = await import('./affiliate.service.js')
    await recordConversion({
      referralCode:        tenant.referredByCode,
      tenantId,
      subscriptionId,
      conversionType:      'subscription',
      conversionValueCents: amountCents,
    }).catch(() => {})
  }
}

// Stripe creates an invoice in 'draft' status ~1 hour before charging the
// tenant. We hook that moment to push overage line items so they appear on
// the about-to-finalize invoice. Idempotent — we tag each item with a
// metadata key so re-running on the same invoice doesn't double-charge.
async function handleInvoiceCreated(invoice: StripeInvoice & { id: string; customer: string | { id: string }; period_start: number; period_end: number }) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  // Resolve tenant
  const ref = await prisma.stripeCustomerRef.findFirst({ where: { stripeCustomerId: customerId }, select: { tenantId: true } })
  if (!ref) return

  // Compute overage for the period this invoice covers
  const periodStart = new Date(invoice.period_start * 1000)
  const periodEnd   = new Date(invoice.period_end   * 1000)
  const { computeOverageForPeriod } = await import('./overage.service.js')
  const breakdown = await computeOverageForPeriod(ref.tenantId, periodStart, periodEnd)

  if (breakdown.lines.length === 0) {
    writeAuditLog({ actorType: 'SYSTEM', action: 'billing.overage_invoice_skipped', tenantId: ref.tenantId, metadataJson: { invoiceId: invoice.id, reason: 'no overage' } }).catch(() => null)
    return
  }

  // Idempotency: tag each item so re-running on the same invoice is safe.
  // Stripe's API doesn't have an "upsert" for invoice items, so we instead
  // list existing items on the invoice and skip channels we've already
  // posted.
  const stripe = getStripe()
  const existing = await stripe.invoiceItems.list({ customer: customerId, limit: 100 })
  const alreadyTagged = new Set(
    existing.data
      .filter(i => i.invoice === invoice.id && i.metadata?.['overage_invoice_id'] === invoice.id)
      .map(i => i.metadata?.['overage_channel'])
      .filter(Boolean),
  )

  let postedCount = 0
  for (const line of breakdown.lines) {
    if (alreadyTagged.has(line.channel)) continue
    await stripe.invoiceItems.create({
      customer:    customerId,
      invoice:     invoice.id,
      amount:      line.amountCents,
      currency:    'usd',
      description: line.description,
      metadata:    {
        tenant_id:          ref.tenantId,
        overage_invoice_id: invoice.id,
        overage_channel:    line.channel,
        overage_units:      String(line.units),
        markup_pct:         String(breakdown.markupPct),
      },
    })
    postedCount++
  }

  writeAuditLog({
    actorType: 'SYSTEM', action: 'billing.overage_invoice_items_posted',
    tenantId: ref.tenantId,
    metadataJson: { invoiceId: invoice.id, postedCount, totalCents: breakdown.totalCents, channels: breakdown.lines.map(l => l.channel) },
  }).catch(() => null)
}

async function handleInvoicePaid(invoice: StripeInvoice) {
  const subDetails = invoice.parent?.subscription_details
  const subscriptionId = typeof subDetails?.subscription === 'string'
    ? subDetails.subscription
    : (subDetails?.subscription as { id: string } | null)?.id ?? null

  if (!subscriptionId) return

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: 'ACTIVE' },
  })

  const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId }, select: { tenantId: true } })
  writeAuditLog({ actorType: 'SYSTEM', action: 'billing.invoice_paid', tenantId: sub?.tenantId, metadataJson: { subscriptionId, amountPaid: (invoice as any).amount_paid } }).catch(() => null)
}

async function handleSubscriptionUpdated(stripeSub: StripeSub) {
  const tenantId = stripeSub.metadata?.tenantId
  const planCode = stripeSub.metadata?.planCode
  if (!tenantId || !planCode) return
  await upsertSubscription(tenantId, planCode, stripeSub)
  writeAuditLog({ actorType: 'SYSTEM', action: 'billing.subscription_updated', tenantId, metadataJson: { stripeSubscriptionId: stripeSub.id, status: stripeSub.status, planCode } }).catch(() => null)
}

async function handleSubscriptionDeleted(stripeSub: StripeSub) {
  const tenantId = stripeSub.metadata?.tenantId
  const planCode = stripeSub.metadata?.planCode
  if (!tenantId) return

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: stripeSub.id },
    data: { status: 'CANCELED', canceledAt: new Date() },
  })

  // LTD special case: cancelling the recurring ($24.99/mo token coverage)
  // does NOT revoke lifetime access. The customer paid $497 for the
  // lifetime deal — that promise is honored regardless of whether they
  // keep paying for token coverage. Tenant stays on whatever status they
  // had (typically ACTIVE), entitlements stay, AI features stay enabled.
  // Audit-log the event so we can see who's running on platform-absorbed
  // token costs.
  if (planCode === 'ltd') {
    writeAuditLog({
      actorType: 'SYSTEM',
      action:    'billing.ltd_recurring_canceled',
      tenantId,
      metadataJson: {
        stripeSubscriptionId: stripeSub.id,
        note: 'LTD recurring token coverage cancelled. Lifetime access preserved per LTD billing design.',
      },
    }).catch(() => null)
    return
  }

  // Standard path: cancellation downgrades tenant back to TRIAL until they
  // pick a new plan.
  await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'TRIAL' } })
  writeAuditLog({ actorType: 'SYSTEM', action: 'billing.subscription_canceled', tenantId, metadataJson: { stripeSubscriptionId: stripeSub.id } }).catch(() => null)
}

async function upsertSubscription(tenantId: string, planCode: string, stripeSub: StripeSub) {
  const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } })
  if (!plan) return

  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    trialing: 'TRIALING',
    unpaid: 'PAST_DUE',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'CANCELED',
    paused: 'PAST_DUE',
  }
  const status = (statusMap[stripeSub.status] ?? 'INCOMPLETE') as never

  // In Stripe API v2026, period dates live on the subscription item
  const firstItem = stripeSub.items.data[0]
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null
  const canceledAt = stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: stripeSub.id },
    create: {
      tenantId,
      planId: plan.id,
      stripeSubscriptionId: stripeSub.id,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt,
    },
    update: {
      planId: plan.id,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt,
    },
  })

  if (status === 'ACTIVE' || status === 'TRIALING') {
    await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } })
    await syncEntitlementsFromPlan(tenantId, plan.id)
  }
}
