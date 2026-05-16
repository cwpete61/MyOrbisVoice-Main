/**
 * Partner voice-minute usage meter.
 *
 * Phase G.3 — voice minutes on partner-owned numbers are billed POST-PAID,
 * separate from the $2/mo flat number rental. Each completed call writes one
 * PartnerVoiceUsageLedger row and (idempotently) a Stripe invoice item on the
 * partner's customer. Stripe auto-attaches pending invoice items to the
 * customer's next invoice — which is their monthly number subscription
 * invoice — so usage lands "at the end of the 30-day cycle" with no cron.
 *
 * Rate card (cents per billed minute, minutes rounded UP — Twilio bills us
 * per-minute the same way):
 *   LOCAL     inbound/outbound = 2¢/min
 *   TOLLFREE  inbound/outbound = 3¢/min
 */
import { prisma } from '../lib/prisma.js'
import { getStripe } from '../lib/stripe.js'
import { ensurePartnerStripeCustomer } from './partner-billing.service.js'
import { Prisma } from '@prisma/client'

export type VoiceDirection  = 'INBOUND' | 'OUTBOUND'
export type VoiceNumberType = 'LOCAL' | 'TOLLFREE'

/** Billed rate, cents per minute, keyed by number type. Same rate both
 *  directions per the 2026-05-15 pricing decision. */
export const VOICE_RATE_CENTS_PER_MIN: Record<VoiceNumberType, number> = {
  LOCAL:    2, // $0.02/min inbound + outbound
  TOLLFREE: 3, // $0.03/min
}

/** Toll-free numbers in the US sit in 8xx ranges. Used to classify a number
 *  when the PhoneNumber row doesn't carry an explicit type. */
function classifyNumberType(e164: string, tier: string | null): VoiceNumberType {
  if (tier === 'TOLLFREE') return 'TOLLFREE'
  // +1 8(00|33|44|55|66|77|88) — US/Canada toll-free area codes
  if (/^\+1\s?8(00|33|44|55|66|77|88)/.test(e164)) return 'TOLLFREE'
  return 'LOCAL'
}

/**
 * Record one completed call's billable voice usage. Idempotent on callSid —
 * a repeated Twilio status webhook will not double-bill.
 *
 * Flow:
 *   1. Dedupe on callSid (PartnerVoiceUsageLedger.callSid is @unique).
 *   2. Rate the call: ceil(seconds / 60) minutes × rate-for-number-type.
 *   3. Write the ledger row.
 *   4. Create a Stripe invoice item on the partner's customer — it rides the
 *      next monthly subscription invoice. Best-effort: if Stripe fails the
 *      ledger row still stands and a later reconcile can re-bill.
 *
 * Returns null when the call isn't billable (zero duration, no partner, etc).
 */
export async function recordVoiceUsage(args: {
  callSid:          string
  partnerId:        string
  phoneNumberId:    string
  e164Number:       string
  partnerTier:      string | null
  direction:        VoiceDirection
  durationSeconds:  number
  twilioCostUsd?:   number | null
}): Promise<{ ledgerId: string; amountCents: number; billableMinutes: number } | null> {
  const { callSid, partnerId, phoneNumberId, e164Number, partnerTier, direction } = args
  const durationSeconds = Math.max(0, Math.floor(args.durationSeconds || 0))

  // Zero-duration calls (never answered, instant hangup) are not billed.
  if (durationSeconds <= 0) return null

  // Idempotency — already metered this call.
  const existing = await prisma.partnerVoiceUsageLedger.findUnique({ where: { callSid } })
  if (existing) {
    return {
      ledgerId:        existing.id,
      amountCents:     existing.amountCents,
      billableMinutes: existing.billableMinutes,
    }
  }

  const numberType        = classifyNumberType(e164Number, partnerTier)
  const ratePerMinuteCents = VOICE_RATE_CENTS_PER_MIN[numberType]
  // Twilio bills per-minute rounded up; a connected call is at least 1 minute.
  const billableMinutes   = Math.max(1, Math.ceil(durationSeconds / 60))
  const amountCents       = billableMinutes * ratePerMinuteCents

  const row = await prisma.partnerVoiceUsageLedger.create({
    data: {
      partnerId,
      phoneNumberId,
      callSid,
      direction,
      numberType,
      durationSeconds,
      billableMinutes,
      ratePerMinuteCents,
      amountCents,
      twilioCostCents: args.twilioCostUsd != null
        ? new Prisma.Decimal(args.twilioCostUsd * 100)
        : null,
    },
  })

  // Bill it — pending invoice item, rides the partner's next subscription
  // invoice. Best-effort: a Stripe hiccup leaves billedAt null so a reconcile
  // sweep can pick it up later.
  try {
    const stripe = getStripe()
    const { stripeCustomerId } = await ensurePartnerStripeCustomer(partnerId)
    const item = await stripe.invoiceItems.create(
      {
        customer:    stripeCustomerId,
        amount:      amountCents,
        currency:    'usd',
        description: `Voice ${direction.toLowerCase()} — ${e164Number} — ${billableMinutes} min @ ${ratePerMinuteCents}¢/min`,
        metadata: {
          scope:         'partner_voice_usage',
          partnerId,
          phoneNumberId,
          callSid,
          billableMinutes: String(billableMinutes),
        },
      },
      { idempotencyKey: `partner_voice_usage_${callSid}` },
    )
    await prisma.partnerVoiceUsageLedger.update({
      where: { id: row.id },
      data:  { stripeInvoiceItemId: item.id, billedAt: new Date() },
    })
  } catch (err) {
    console.error(`[voice-usage] Stripe invoice item failed for call ${callSid}: ${(err as Error).message}`)
  }

  return { ledgerId: row.id, amountCents, billableMinutes }
}

/**
 * Current unbilled + current-cycle voice usage summary for a partner. Drives
 * the partner-portal Phone Numbers page "voice usage this cycle" line.
 *
 * "currentCycle" = usage rows since the partner's earliest active number
 * subscription's current period start is overkill to compute here; we use a
 * simple rolling 30-day window which is what the partner sees as their cycle.
 */
export async function getPartnerVoiceUsageSummary(partnerId: string): Promise<{
  cycleAmountCents:   number
  cycleMinutes:       number
  cycleCallCount:     number
  recentCalls: Array<{
    callSid:         string
    direction:       string
    numberType:      string
    billableMinutes: number
    amountCents:     number
    createdAt:       string
  }>
}> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const rows  = await prisma.partnerVoiceUsageLedger.findMany({
    where:   { partnerId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take:    100,
  })

  const cycleAmountCents = rows.reduce((s, r) => s + r.amountCents, 0)
  const cycleMinutes     = rows.reduce((s, r) => s + r.billableMinutes, 0)

  return {
    cycleAmountCents,
    cycleMinutes,
    cycleCallCount: rows.length,
    recentCalls: rows.slice(0, 25).map(r => ({
      callSid:         r.callSid,
      direction:       r.direction,
      numberType:      r.numberType,
      billableMinutes: r.billableMinutes,
      amountCents:     r.amountCents,
      createdAt:       r.createdAt.toISOString(),
    })),
  }
}
