import { prisma } from '../lib/prisma.js'
import { getStripe } from '../lib/stripe.js'
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
  metadata?: Record<string, string> | null
  subscription?: string | { id: string } | null
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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.APP_BASE_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${env.APP_BASE_URL}/billing?status=cancelled`,
    metadata: { tenantId, planCode },
    subscription_data: { metadata: { tenantId, planCode } },
  })

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
  const env = getEnv()
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError('INTERNAL_ERROR', 'Webhook secret not configured', 500)

  const stripe = getStripe()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: { object: any } }

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw new AppError('BAD_REQUEST', 'Invalid webhook signature', 400)
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as StripeCheckoutSession)
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
    default:
      break
  }
}

async function handleCheckoutCompleted(session: StripeCheckoutSession) {
  const tenantId = session.metadata?.tenantId
  const planCode = session.metadata?.planCode
  if (!tenantId || !planCode) return

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
  if (!tenantId) return

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: stripeSub.id },
    data: { status: 'CANCELED', canceledAt: new Date() },
  })

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
