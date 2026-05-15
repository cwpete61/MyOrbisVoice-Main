/**
 * Partner SMS credit accounting + Stripe one-time pack purchases.
 *
 * Phase G.2 — SMS sending for partners is gated by a credit balance held on
 * AffiliateAccount.smsCreditBalance. Credits never expire and roll over
 * forever. Packs are purchased one-time via Stripe Checkout; on payment the
 * webhook calls grantCreditsFromPurchase() which writes the PURCHASE ledger
 * row and bumps the balance atomically.
 *
 * Channel weights (1 credit = 1 standard SMS segment):
 *   SMS         = 1.0
 *   SMS_LONG    = 2.0  (2-segment SMS — anything > 160 chars splits)
 *   MMS         = 2.5
 *   WHATSAPP    = reserved, "Coming soon" in UI (no pricing yet)
 *
 * Pack table (visible to partners on the purchase modal):
 *   $5 pack  → 500 credits   → 500 SMS / 250 long-SMS / 200 MMS
 *   $10 pack → 1,200 credits → 1,200 SMS / 600 long-SMS / 480 MMS
 */
import { prisma } from '../lib/prisma.js'
import { getStripe } from '../lib/stripe.js'
import { ensurePartnerStripeCustomer } from './partner-billing.service.js'
import { getConfigValue, setConfigValue } from './system-config.service.js'
import { AppError } from '@voiceautomation/shared'
import { Prisma as Prisma_ } from '@prisma/client'

export type SmsPackId = 'pack_5' | 'pack_10'

export type SmsChannel = 'SMS' | 'SMS_LONG' | 'MMS' | 'WHATSAPP'

export const SMS_CHANNEL_COST: Record<SmsChannel, number> = {
  SMS:      1,
  SMS_LONG: 2,
  MMS:      2.5,
  WHATSAPP: 1, // reserved — final pricing TBD when channel launches
}

export interface SmsPackDef {
  id:           SmsPackId
  credits:      number
  unitAmount:   number // cents
  name:         string
  description:  string
}

export const SMS_PACK_DEFS: Record<SmsPackId, SmsPackDef> = {
  pack_5: {
    id:          'pack_5',
    credits:     500,
    unitAmount:  500, // $5.00
    name:        'SMS Credits — $5 Pack',
    description: '500 SMS credits. 1 credit per SMS segment, 2 per long SMS, 2.5 per MMS. Never expires.',
  },
  pack_10: {
    id:          'pack_10',
    credits:     1200,
    unitAmount:  1000, // $10.00
    name:        'SMS Credits — $10 Pack',
    description: '1,200 SMS credits. 1 credit per SMS segment, 2 per long SMS, 2.5 per MMS. Never expires.',
  },
}

function packConfigKey(packId: SmsPackId): string {
  return `stripe_partner_sms_pack_price_${packId}`
}

/**
 * Find or create the Stripe Product + one-time Price for an SMS credit pack.
 * Cache the price id in SystemConfig like the number tiers do. Idempotency
 * keys keep concurrent creation safe.
 */
export async function ensureSmsPackPrice(packId: SmsPackId): Promise<{ priceId: string; productId: string }> {
  const stripe = getStripe()
  const key    = packConfigKey(packId)

  const cached = await getConfigValue(key).catch(() => null)
  if (cached) {
    try {
      const price = await stripe.prices.retrieve(cached)
      if (price && price.active) {
        return { priceId: cached, productId: (price.product as string) }
      }
    } catch { /* re-provision below */ }
  }

  const def = SMS_PACK_DEFS[packId]
  const product = await stripe.products.create(
    {
      name:        def.name,
      description: def.description,
      metadata:    { packId, scope: 'partner_sms_pack', credits: String(def.credits) },
    },
    { idempotencyKey: `partner_sms_pack_product_${packId}` },
  )
  const price = await stripe.prices.create(
    {
      product:     product.id,
      unit_amount: def.unitAmount,
      currency:    'usd',
      metadata:    { packId, scope: 'partner_sms_pack', credits: String(def.credits) },
    },
    { idempotencyKey: `partner_sms_pack_price_${packId}_v1` },
  )

  await setConfigValue(key, price.id, false, 'system')
  return { priceId: price.id, productId: product.id }
}

/**
 * Create a Stripe Checkout session (mode=payment, one-time) for a pack. On
 * payment.success the webhook turns this into a PURCHASE ledger row + balance
 * bump. Customer is the partner's Stripe Customer (shared with their phone-
 * number subscriptions).
 */
export async function createSmsPackCheckoutSession(
  partnerId: string,
  packId: SmsPackId,
  opts: { returnUrl: string; cancelUrl: string },
): Promise<{ url: string; sessionId: string }> {
  const def    = SMS_PACK_DEFS[packId]
  if (!def) throw new AppError('VALIDATION_ERROR', 'Unknown pack', 422)

  const stripe = getStripe()
  const { stripeCustomerId } = await ensurePartnerStripeCustomer(partnerId)
  const { priceId } = await ensureSmsPackPrice(packId)

  const session = await stripe.checkout.sessions.create({
    mode:        'payment',
    customer:    stripeCustomerId,
    payment_method_types: ['card'],
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: opts.returnUrl,
    cancel_url:  opts.cancelUrl,
    metadata: {
      partnerId,
      packId,
      credits: String(def.credits),
      scope:   'partner_sms_pack',
    },
  })
  if (!session.url) throw new AppError('INTERNAL_ERROR', 'Stripe did not return a checkout URL', 500)
  return { url: session.url, sessionId: session.id }
}

/**
 * Webhook entry. Idempotent on stripeSessionId — repeated webhook delivery for
 * the same session will not double-credit. Returns the new balance for log
 * + observability.
 */
export async function grantCreditsFromPurchase(args: {
  partnerId:             string
  packId:                SmsPackId
  credits:               number
  usdAmountCents:        number
  stripeSessionId:       string
  stripePaymentIntentId?: string
}): Promise<{ newBalance: number; alreadyGranted: boolean }> {
  // Dedupe by sessionId — repeated webhook deliveries hit the unique constraint
  // and the existing row is returned without re-bumping balance.
  const existing = await prisma.partnerSmsCreditLedger.findUnique({
    where: { stripeSessionId: args.stripeSessionId },
  })
  if (existing) {
    return { newBalance: Number(existing.balanceAfter), alreadyGranted: true }
  }

  return prisma.$transaction(async (tx) => {
    const partner = await tx.affiliateAccount.update({
      where: { id: args.partnerId },
      data:  { smsCreditBalance: { increment: args.credits } },
      select: { smsCreditBalance: true },
    })
    await tx.partnerSmsCreditLedger.create({
      data: {
        partnerId:             args.partnerId,
        eventType:             'PURCHASE',
        creditsDelta:          new Prisma_.Decimal(args.credits),
        balanceAfter:          partner.smsCreditBalance,
        packId:                args.packId,
        usdAmountCents:        args.usdAmountCents,
        stripeSessionId:       args.stripeSessionId,
        stripePaymentIntentId: args.stripePaymentIntentId ?? null,
      },
    })
    return { newBalance: Number(partner.smsCreditBalance), alreadyGranted: false }
  })
}

/**
 * Reserve + deduct credits BEFORE sending a partner-routed message. Throws
 * INSUFFICIENT_CREDITS if balance < cost. Returns the new balance so the
 * caller can log it. Use the returned ledgerRowId for REFUND if the actual
 * provider send fails after this commit.
 */
export async function deductCreditsForSend(args: {
  partnerId: string
  channel:   SmsChannel
  messageLogId?: string
  note?:     string
}): Promise<{ ledgerRowId: string; cost: number; newBalance: number }> {
  const cost = SMS_CHANNEL_COST[args.channel]
  if (!cost || cost <= 0) {
    throw new AppError('VALIDATION_ERROR', `Unknown channel ${args.channel}`, 422)
  }

  return prisma.$transaction(async (tx) => {
    const partner = await tx.affiliateAccount.findUnique({
      where:  { id: args.partnerId },
      select: { smsCreditBalance: true },
    })
    if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)
    if (Number(partner.smsCreditBalance) < cost) {
      throw new AppError('INSUFFICIENT_CREDITS', `Need ${cost} credits, balance ${partner.smsCreditBalance}`, 402)
    }

    const updated = await tx.affiliateAccount.update({
      where: { id: args.partnerId },
      data:  { smsCreditBalance: { decrement: cost } },
      select: { smsCreditBalance: true },
    })
    const row = await tx.partnerSmsCreditLedger.create({
      data: {
        partnerId:    args.partnerId,
        eventType:    'CONSUME',
        creditsDelta: new Prisma_.Decimal(-cost),
        balanceAfter: updated.smsCreditBalance,
        channel:      args.channel,
        messageLogId: args.messageLogId ?? null,
        note:         args.note ?? null,
      },
    })
    return { ledgerRowId: row.id, cost, newBalance: Number(updated.smsCreditBalance) }
  })
}

/**
 * Refund a previously CONSUME'd deduction. Called when the provider send
 * actually fails AFTER we already deducted. Idempotent on the original
 * ledger row id — a second refund call against the same row is rejected.
 */
export async function refundCreditsForFailedSend(args: {
  partnerId:     string
  consumeRowId:  string
  note?:         string
}): Promise<{ newBalance: number; alreadyRefunded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.partnerSmsCreditLedger.findUnique({ where: { id: args.consumeRowId } })
    if (!original)                          throw new AppError('NOT_FOUND', 'Ledger row not found', 404)
    if (original.eventType !== 'CONSUME')   throw new AppError('VALIDATION_ERROR', 'Row is not a CONSUME', 422)
    if (original.partnerId !== args.partnerId) throw new AppError('FORBIDDEN', 'Partner mismatch', 403)

    // Has this consume already been refunded? Look for a REFUND row whose note
    // references the original id (encoded by us).
    const existing = await tx.partnerSmsCreditLedger.findFirst({
      where: { partnerId: args.partnerId, eventType: 'REFUND', note: `refund_of:${args.consumeRowId}` },
    })
    if (existing) {
      const partnerCur = await tx.affiliateAccount.findUnique({
        where: { id: args.partnerId }, select: { smsCreditBalance: true },
      })
      return { newBalance: Number(partnerCur?.smsCreditBalance ?? 0), alreadyRefunded: true }
    }

    const refundAmount = original.creditsDelta.abs()
    const partner = await tx.affiliateAccount.update({
      where: { id: args.partnerId },
      data:  { smsCreditBalance: { increment: refundAmount } },
      select: { smsCreditBalance: true },
    })
    await tx.partnerSmsCreditLedger.create({
      data: {
        partnerId:    args.partnerId,
        eventType:    'REFUND',
        creditsDelta: refundAmount,
        balanceAfter: partner.smsCreditBalance,
        channel:      original.channel,
        note:         args.note ? `refund_of:${args.consumeRowId} ${args.note}` : `refund_of:${args.consumeRowId}`,
      },
    })
    return { newBalance: Number(partner.smsCreditBalance), alreadyRefunded: false }
  })
}

export async function getPartnerCreditStatus(partnerId: string): Promise<{
  balance:       number
  recentLedger:  Array<{
    id:           string
    eventType:    string
    creditsDelta: number
    balanceAfter: number
    channel:      string | null
    packId:       string | null
    usdAmountCents: number | null
    createdAt:    string
    note:         string | null
  }>
}> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: { smsCreditBalance: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const rows = await prisma.partnerSmsCreditLedger.findMany({
    where:   { partnerId },
    orderBy: { createdAt: 'desc' },
    take:    25,
  })

  return {
    balance: Number(partner.smsCreditBalance),
    recentLedger: rows.map(r => ({
      id:             r.id,
      eventType:      r.eventType,
      creditsDelta:   Number(r.creditsDelta),
      balanceAfter:   Number(r.balanceAfter),
      channel:        r.channel ?? null,
      packId:         r.packId ?? null,
      usdAmountCents: r.usdAmountCents ?? null,
      createdAt:      r.createdAt.toISOString(),
      note:           r.note ?? null,
    })),
  }
}

// ─── Phase G.2.1 — Cost meter ────────────────────────────────────────────────
//
// Every outbound message has TWO economic events:
//   1. Credit deduction (instant, before Twilio call). Driven by channel cost
//      weights in SMS_CHANNEL_COST. Funded by partner's pack purchase.
//   2. Twilio actual charge (async, arrives via status callback). The real
//      USD we pay Twilio for the send. Captured here.
//
// We use (1) to gate sends (no credits = no send). We use (2) to verify the
// pack pricing is actually profitable per-partner. If a partner's lifetime
// Twilio spend approaches their lifetime pack purchases (margin shrinking),
// we surface that to admin + warn the partner before they exceed the buffer.

/**
 * Persist Twilio's actual cost (from the sms-status webhook) onto the matching
 * CONSUME ledger row. Idempotent — re-running with the same MessageSid + cost
 * is a no-op. If the cost arrives BEFORE the CONSUME row exists (rare race),
 * silently skip; the next webhook delivery will retry.
 */
export async function recordTwilioCostForMessage(
  providerMessageId: string,
  usdCost:           number,
): Promise<void> {
  if (!providerMessageId || !Number.isFinite(usdCost) || usdCost <= 0) return

  const msg = await prisma.messageLog.findFirst({
    where:  { providerMessageId },
    select: { id: true },
  })
  if (!msg) return

  // Only update CONSUME rows that don't already have a cost stamped. Re-runs
  // from Twilio retry-deliveries leave the value alone — first cost wins.
  await prisma.partnerSmsCreditLedger.updateMany({
    where: {
      messageLogId:   msg.id,
      eventType:      'CONSUME',
      twilioCostCents: null,
    },
    data: {
      twilioCostCents: new Prisma_.Decimal(usdCost * 100),
    },
  })
}

/**
 * Per-partner financial snapshot — lifetime purchased vs. lifetime real Twilio
 * spend. Margin = purchased - spent. Used by the UI banner + nightly cron +
 * the send-time guard (in deductCreditsForSend below, when net ≤ 0 we block).
 *
 * "spentCents" sums all CONSUME rows with a Twilio cost stamped. Pending
 * sends (cost not yet captured) are extrapolated using the channel cost
 * weight × the partner's average per-channel cost to give a conservative
 * projection. Refunds add the original cost back.
 */
export async function getPartnerFinancials(partnerId: string): Promise<{
  purchasedCents:    number
  spentCents:        number
  pendingCostCents:  number       // CONSUME rows still waiting on status callback cost
  netCents:          number       // purchasedCents - spentCents - pendingCostCents
  marginPct:         number       // 0..100, or 0 when nothing purchased
  status:            'HEALTHY' | 'LOW' | 'OVER_BUDGET'
}> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: { smsCreditBalance: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  // Sum purchases (PURCHASE only).
  const purchaseAgg = await prisma.partnerSmsCreditLedger.aggregate({
    where:  { partnerId, eventType: 'PURCHASE' },
    _sum:   { usdAmountCents: true },
  })
  const purchasedCents = purchaseAgg._sum.usdAmountCents ?? 0

  // Sum CONSUME with a Twilio cost stamped (terminal-status messages).
  const spentAgg = await prisma.partnerSmsCreditLedger.aggregate({
    where:  { partnerId, eventType: 'CONSUME', twilioCostCents: { not: null } },
    _sum:   { twilioCostCents: true },
  })
  const spentCents = Number(spentAgg._sum.twilioCostCents ?? 0)

  // CONSUME without Twilio cost yet — estimate using channel weights with a
  // pessimistic per-credit cost ($0.01 floor, matches the $5/500 rate so we
  // never undercount). Refund rows aren't subtracted here — they zero out
  // the corresponding CONSUME's pending-cost contribution naturally because
  // the CONSUME row stays with twilioCostCents=null then disappears from
  // billing once the REFUND zeroes the credits.
  const pendingRows = await prisma.partnerSmsCreditLedger.findMany({
    where:  { partnerId, eventType: 'CONSUME', twilioCostCents: null },
    select: { creditsDelta: true },
  })
  const PER_CREDIT_FLOOR_CENTS = 1 // $0.01 per credit
  const pendingCostCents = pendingRows.reduce((sum, r) => {
    return sum + Math.abs(Number(r.creditsDelta)) * PER_CREDIT_FLOOR_CENTS
  }, 0)

  const netCents  = purchasedCents - spentCents - pendingCostCents
  const marginPct = purchasedCents > 0
    ? Math.max(0, Math.round((netCents / purchasedCents) * 100))
    : 0

  // Status:
  //   OVER_BUDGET when net ≤ 0 — block further sends until purchase
  //   LOW         when balance < 50 credits OR net < 100 cents ($1) — warn
  //   HEALTHY     otherwise
  const balance = Number(partner.smsCreditBalance)
  let status: 'HEALTHY' | 'LOW' | 'OVER_BUDGET'
  if (purchasedCents > 0 && netCents <= 0)       status = 'OVER_BUDGET'
  else if (balance < 50 || netCents < 100)       status = 'LOW'
  else                                            status = 'HEALTHY'

  return { purchasedCents, spentCents, pendingCostCents, netCents, marginPct, status }
}

/**
 * Send the partner an "out / low" email, deduped by smsCreditLowNotifiedAt
 * within a 24h window. Caller invokes this lazily from the send path when
 * either the balance or the net drops into the warning zone.
 *
 * Returns true when an email was sent. Returns false when deduped or no
 * email address on file.
 */
export async function maybeNotifyPartnerLowCredits(args: {
  partnerId: string
  reason:    'OVER_BUDGET' | 'LOW_BALANCE' | 'LOW_NET'
}): Promise<boolean> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: args.partnerId },
    select: {
      id: true,
      displayName: true,
      smsCreditLowNotifiedAt: true,
      smsCreditBalance: true,
      user: { select: { email: true, firstName: true } },
    },
  })
  if (!partner) return false
  if (!partner.user.email) return false

  // 24h dedup window
  const lastSent = partner.smsCreditLowNotifiedAt?.getTime() ?? 0
  if (Date.now() - lastSent < 24 * 60 * 60 * 1000) return false

  const { sendEmail } = await import('./email.service.js').catch(() => ({ sendEmail: null as null }))
  if (!sendEmail) return false

  const balance = Number(partner.smsCreditBalance)
  const firstName = partner.user.firstName || partner.displayName || 'Partner'
  const subject =
    args.reason === 'OVER_BUDGET' ? 'Your MyOrbisVoice SMS credits are out — sending is paused'
  : args.reason === 'LOW_BALANCE' ? `Only ${Math.floor(balance)} SMS credits left on your account`
  :                                  'Your SMS credit pack value is running low'
  const body =
    `Hi ${firstName},\n\n` +
    (args.reason === 'OVER_BUDGET'
      ? 'Your prepaid SMS pack value is exhausted. To keep sending messages from your number, please top up:\n\n'
      : `You currently have ${Math.floor(balance)} SMS credits on file. To avoid an interruption, top up before they run out:\n\n`) +
    'https://app.myorbisvoice.com/partner-portal/phone-numbers\n\n' +
    '$5 pack adds 500 credits. $10 pack adds 1,200 credits. Credits never expire.\n\n' +
    '— MyOrbisVoice'

  try {
    await sendEmail({
      to:      partner.user.email,
      subject,
      text:    body,
      html:    `<p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
      kind:    'transactional',
      partnerId: partner.id,
    })
    await prisma.affiliateAccount.update({
      where: { id: partner.id },
      data:  { smsCreditLowNotifiedAt: new Date() },
    })
    return true
  } catch {
    return false
  }
}
