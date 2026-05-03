/**
 * Compute overage charges for a tenant over a given billing period.
 *
 * Reads:
 *   - TenantEntitlement → included quotas + per-unit overage rates
 *   - SystemConfig.overage_markup_percent → platform-wide markup multiplier
 *   - Conversation → voice minutes used (sum of recordingDurationSecs)
 *   - MessageLog → SMS/MMS/WhatsApp counts (OUTBOUND only)
 *
 * Returns a structured breakdown plus a flat array of line items ready to
 * push to Stripe as invoice items.
 */
import { prisma } from '../lib/prisma.js'

export interface OverageLine {
  channel:     'voice' | 'sms' | 'mms' | 'whatsapp'
  units:       number              // overage units (msg or min)
  unitRateCents: number             // post-markup rate per unit
  amountCents: number              // units * unitRateCents
  description: string              // "SMS overage: 50 messages × $0.05 = $2.50"
}

export interface OverageBreakdown {
  periodStart: Date
  periodEnd:   Date
  lines:       OverageLine[]
  totalCents:  number
  markupPct:   number
}

export async function computeOverageForPeriod(
  tenantId:    string,
  periodStart: Date,
  periodEnd:   Date,
): Promise<OverageBreakdown> {
  // Voice minutes — sum recordingDurationSecs over the period, ceil to minutes.
  const voiceAgg = await prisma.conversation.aggregate({
    where: { tenantId, startedAt: { gte: periodStart, lt: periodEnd } },
    _sum:  { recordingDurationSecs: true },
  })
  const minutesUsed = Math.ceil((voiceAgg._sum.recordingDurationSecs ?? 0) / 60)

  // Outbound message counts per channel
  const grouped = await prisma.messageLog.groupBy({
    by:     ['channel'],
    where:  { tenantId, direction: 'OUTBOUND', createdAt: { gte: periodStart, lt: periodEnd } },
    _count: { id: true },
  })
  const sentByChannel = (ch: string) => grouped.find(g => g.channel === ch)?._count.id ?? 0
  const smsSent      = sentByChannel('SMS')
  const mmsSent      = sentByChannel('MMS')
  const whatsappSent = sentByChannel('WHATSAPP')

  // Effective entitlements (snapshot of plan at sub time)
  const ents = await prisma.tenantEntitlement.findMany({
    where:  { tenantId },
    select: { key: true, integerValue: true },
  })
  const intVal = (key: string, fallback = 0) =>
    ents.find(e => e.key === key)?.integerValue ?? fallback

  // Markup multiplier from SystemConfig
  const markupRow = await prisma.systemConfig.findUnique({ where: { key: 'overage_markup_percent' } })
  const markupPct = Number(markupRow?.value ?? 0) || 0
  const m = (cents: number) => Math.round(cents * (1 + markupPct / 100))

  const includedVoice    = intVal('minutes_per_month', 0)
  const includedSms      = intVal('included_sms_per_month', 0)
  const includedMms      = intVal('included_mms_per_month', 0)
  const includedWhatsapp = intVal('included_whatsapp_per_month', 0)

  const voiceRate    = m(intVal('voice_overage_per_minute_cents', 0))
  const smsRate      = m(intVal('sms_overage_per_message_cents', 0))
  const mmsRate      = m(intVal('mms_overage_per_message_cents', 0))
  const whatsappRate = m(intVal('whatsapp_overage_per_message_cents', 0))

  const voiceOver    = Math.max(0, minutesUsed  - includedVoice)
  const smsOver      = Math.max(0, smsSent      - includedSms)
  const mmsOver      = Math.max(0, mmsSent      - includedMms)
  const whatsappOver = Math.max(0, whatsappSent - includedWhatsapp)

  const lines: OverageLine[] = []

  if (voiceOver > 0 && voiceRate > 0) {
    lines.push({
      channel: 'voice',
      units:         voiceOver,
      unitRateCents: voiceRate,
      amountCents:   voiceOver * voiceRate,
      description:   `Voice overage: ${voiceOver} minute${voiceOver === 1 ? '' : 's'} × ${formatCents(voiceRate)} = ${formatCents(voiceOver * voiceRate)}`,
    })
  }
  if (smsOver > 0 && smsRate > 0) {
    lines.push({
      channel: 'sms',
      units:         smsOver,
      unitRateCents: smsRate,
      amountCents:   smsOver * smsRate,
      description:   `SMS overage: ${smsOver} message${smsOver === 1 ? '' : 's'} × ${formatCents(smsRate)} = ${formatCents(smsOver * smsRate)}`,
    })
  }
  if (mmsOver > 0 && mmsRate > 0) {
    lines.push({
      channel: 'mms',
      units:         mmsOver,
      unitRateCents: mmsRate,
      amountCents:   mmsOver * mmsRate,
      description:   `MMS overage: ${mmsOver} message${mmsOver === 1 ? '' : 's'} × ${formatCents(mmsRate)} = ${formatCents(mmsOver * mmsRate)}`,
    })
  }
  if (whatsappOver > 0 && whatsappRate > 0) {
    lines.push({
      channel: 'whatsapp',
      units:         whatsappOver,
      unitRateCents: whatsappRate,
      amountCents:   whatsappOver * whatsappRate,
      description:   `WhatsApp overage: ${whatsappOver} message${whatsappOver === 1 ? '' : 's'} × ${formatCents(whatsappRate)} = ${formatCents(whatsappOver * whatsappRate)}`,
    })
  }

  const totalCents = lines.reduce((sum, l) => sum + l.amountCents, 0)

  return { periodStart, periodEnd, lines, totalCents, markupPct }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
