/**
 * Email campaign worker — drips RUNNING campaign recipients respecting
 * per-partner policy (daily cap + send window + drip interval) and the
 * suppression list.
 *
 * Phase F.4 (Batch 2). Designed for a single-instance setInterval tick from
 * the api startup. If we move to multi-instance later, switch to a Redis lock
 * or a true job queue (BullMQ). For one node + ~hundreds of recipients per
 * day it's overkill — Postgres rows + interval is fine.
 *
 * Tick behavior (every WORKER_INTERVAL_MS):
 *   1. Auto-transition SCHEDULED → RUNNING when scheduledAt is past.
 *   2. For each RUNNING campaign, ask the policy: can we send right now?
 *      - bulk enabled? not suspended?
 *      - inside send window in partner-local time?
 *      - inside daily cap?
 *      - drip interval elapsed since last send?
 *   3. If yes, pick ONE PENDING recipient, re-check suppression, send.
 *   4. After every send: update recipient + campaign counters.
 *   5. If campaign drained: mark COMPLETED.
 *
 * One recipient per tick keeps things simple. With WORKER_INTERVAL_MS=15s
 * and dripIntervalSecs=60 we'll average ~4 sends/minute per campaign,
 * capped by the partner's daily limit. Plenty for the 10-15-at-a-clip
 * scenario the user described.
 */
import { prisma } from '../lib/prisma.js'
import { sendEmail } from './email.service.js'
import { checkSuppression } from './email-suppression.service.js'
import { getPartnerPolicy, evaluatePartnerReputation } from './email-bulk-policy.service.js'

const WORKER_INTERVAL_MS = 15_000  // tick every 15s
let timer: NodeJS.Timeout | null = null
let ticking = false                // skip overlapping ticks

export function startCampaignWorker(): void {
  if (timer) return
  console.log(`[campaign-worker] starting, tick = ${WORKER_INTERVAL_MS}ms`)
  timer = setInterval(() => { void runTick() }, WORKER_INTERVAL_MS)
}

export function stopCampaignWorker(): void {
  if (timer) { clearInterval(timer); timer = null }
}

export async function runTick(): Promise<void> {
  if (ticking) return  // previous tick still running, skip this one
  ticking = true
  try {
    // 1. Auto-transition SCHEDULED → RUNNING.
    const now = new Date()
    await prisma.emailCampaign.updateMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      data:  { status: 'RUNNING', startedAt: now },
    })

    // 2. Find RUNNING campaigns with at least one PENDING recipient.
    const running = await prisma.emailCampaign.findMany({
      where: { status: 'RUNNING' },
      select: {
        id: true, partnerId: true, tenantId: true, subject: true, bodyText: true,
        bodyHtml: true, fromName: true, totalRecipients: true, sentCount: true,
        bouncedCount: true, complainedCount: true, skippedCount: true,
      },
      take: 25,  // sanity cap per tick
    })

    for (const camp of running) {
      try {
        await drainOne(camp)
      } catch (err) {
        console.warn(`[campaign-worker] campaign ${camp.id} drain error:`, (err as Error).message)
      }
    }
  } finally {
    ticking = false
  }
}

type RunningCampaign = {
  id: string
  partnerId: string | null
  tenantId: string
  subject: string
  bodyText: string
  bodyHtml: string | null
  fromName: string | null
  totalRecipients: number
  sentCount: number
  bouncedCount: number
  complainedCount: number
  skippedCount: number
}

async function drainOne(camp: RunningCampaign): Promise<void> {
  // Partner-scoped policy gate. Tenant campaigns don't have caps yet — they
  // run as fast as the worker tick allows.
  if (camp.partnerId) {
    const policy = await getPartnerPolicy(camp.partnerId)
    if (!policy) return
    if (!policy.bulkEnabled || policy.suspended) {
      // Bulk got disabled mid-run. Auto-pause.
      await prisma.emailCampaign.update({
        where: { id: camp.id },
        data:  {
          status: 'PAUSED',
          pausedReason: policy.suspended ? `partner_suspended:${policy.suspendedReason}` : 'bulk_disabled',
        },
      })
      return
    }
    // Send-window check uses partner-local hour so a 9-5 window means
    // 9-5 *for the partner*, not the server. Timezone resolves through:
    // AffiliateAccount.bookingTimezone → User.preferredTimezone →
    // America/New_York (same chain as bookingTimezone uses).
    const partnerTz = await resolvePartnerTimezone(camp.partnerId)
    const hour = getHourInTimezone(partnerTz)
    const inWindow = policy.sendWindowStartHour <= policy.sendWindowEndHour
      ? hour >= policy.sendWindowStartHour && hour < policy.sendWindowEndHour
      : hour >= policy.sendWindowStartHour || hour < policy.sendWindowEndHour
    if (!inWindow) return  // outside window — try again next tick

    // Daily cap check uses server-day boundary (UTC). Close enough for
    // a soft cap; the user impact is bounded by drip + window anyway.
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const sentToday = await prisma.messageLog.count({
      where: {
        partnerId: camp.partnerId,
        channel:   'EMAIL',
        direction: 'OUTBOUND',
        sentAt:    { gte: startOfDay },
      },
    })
    if (sentToday >= policy.dailyCap) return  // cap hit — spillover to next day

    // Drip interval check — has policy.dripIntervalSecs elapsed since last send?
    const lastSend = await prisma.messageLog.findFirst({
      where:   { partnerId: camp.partnerId, channel: 'EMAIL', direction: 'OUTBOUND' },
      orderBy: { sentAt: 'desc' },
      select:  { sentAt: true },
    })
    if (lastSend?.sentAt) {
      const elapsedMs = Date.now() - lastSend.sentAt.getTime()
      if (elapsedMs < policy.dripIntervalSecs * 1000) return
    }
  }

  // 3. Pick ONE PENDING recipient.
  const recipient = await prisma.emailCampaignRecipient.findFirst({
    where:   { campaignId: camp.id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
  if (!recipient) {
    // No more pending → mark COMPLETED.
    await prisma.emailCampaign.update({
      where: { id: camp.id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
    return
  }

  // Re-check suppression at send-time (someone may have unsubscribed between
  // queue + drain — common in long-running campaigns).
  const supp = await checkSuppression({
    email:     recipient.email,
    kind:      'marketing',
    tenantId:  camp.tenantId,
    partnerId: camp.partnerId,
  })
  if (supp.suppressed) {
    await prisma.emailCampaignRecipient.update({
      where: { id: recipient.id },
      data:  { status: 'SKIPPED', errorReason: `suppressed:${supp.scope}:${supp.reason}` },
    })
    await prisma.emailCampaign.update({
      where: { id: camp.id },
      data:  { skippedCount: { increment: 1 } },
    })
    return
  }

  // 4. Build the from header.
  let fromAddr = camp.fromName
  if (!fromAddr && camp.partnerId) {
    // Partner default: <slug>@myorbisresults.com
    const partner = await prisma.affiliateAccount.findFirst({
      where:  { id: camp.partnerId },
      select: { slug: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    })
    if (partner?.slug) {
      const displayName = partner.displayName
        ?? [partner.user?.firstName, partner.user?.lastName].filter(Boolean).join(' ')
        ?? 'MyOrbisResults'
      fromAddr = `${displayName} <${partner.slug}@myorbisresults.com>`
    }
  }
  fromAddr = fromAddr ?? 'noreply@myorbisresults.com'

  // 5. Wrap plain text as HTML for the html part (mirrors the CRM compose).
  const html = camp.bodyHtml ?? `<div style="font-family:sans-serif;max-width:640px;color:#222;line-height:1.55;white-space:pre-wrap">${
    camp.bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }</div>`

  // 6. Send.
  const result = await sendEmail({
    to:        recipient.email,
    subject:   camp.subject,
    html,
    text:      camp.bodyText,
    from:      fromAddr,
    kind:      'marketing',
    tenantId:  camp.tenantId,
    partnerId: camp.partnerId,
  })

  // 7. Update recipient + campaign counters + log.
  if (result.sent) {
    const log = await prisma.messageLog.create({
      data: {
        tenantId:          camp.tenantId,
        partnerId:         camp.partnerId,
        contactId:         recipient.contactId,
        channel:           'EMAIL',
        direction:         'OUTBOUND',
        sender:            fromAddr,
        recipient:         recipient.email,
        subject:           camp.subject,
        bodyText:          camp.bodyText,
        deliveryStatus:    'sent',
        sentAt:            new Date(),
        providerMessageId: result.providerMessageId ?? null,
      },
      select: { id: true },
    })
    await prisma.emailCampaignRecipient.update({
      where: { id: recipient.id },
      data:  { status: 'SENT', sentAt: new Date(), messageLogId: log.id },
    })
    await prisma.emailCampaign.update({
      where: { id: camp.id },
      data:  { sentCount: { increment: 1 } },
    })
  } else if (result.skipped === 'suppressed') {
    await prisma.emailCampaignRecipient.update({
      where: { id: recipient.id },
      data:  { status: 'SKIPPED', errorReason: result.reason ?? 'suppressed' },
    })
    await prisma.emailCampaign.update({
      where: { id: camp.id },
      data:  { skippedCount: { increment: 1 } },
    })
  } else {
    await prisma.emailCampaignRecipient.update({
      where: { id: recipient.id },
      data:  { status: 'FAILED', errorReason: result.reason ?? result.skipped },
    })
    await prisma.emailCampaign.update({
      where: { id: camp.id },
      data:  { skippedCount: { increment: 1 } },
    })
  }

  // 8. After every send, re-evaluate the partner's reputation. Cheap, gated
  // internally by dedupe window so it won't spam notifications.
  if (camp.partnerId) {
    void evaluatePartnerReputation(camp.partnerId).catch(() => null)
  }
}

// ── Timezone helpers ────────────────────────────────────────────────────────
// Resolution chain: AffiliateAccount.bookingTimezone → User.preferredTimezone
// → America/New_York. Same chain `bookingTimezone` doc-comment promises for
// appointment booking, kept consistent so partner-local time means the same
// thing across all surfaces.

async function resolvePartnerTimezone(partnerId: string | null): Promise<string> {
  if (!partnerId) return 'America/New_York'
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: { bookingTimezone: true, user: { select: { preferredTimezone: true } } },
  })
  return partner?.bookingTimezone
    ?? partner?.user?.preferredTimezone
    ?? 'America/New_York'
}

/** Hour of day (0-23) in the given IANA timezone. Uses Intl.DateTimeFormat so
 *  we don't need a timezone library — Node 18+ ships with full ICU data. */
function getHourInTimezone(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour:     'numeric',
    hour12:   false,
  }).formatToParts(new Date())
  const hourPart = parts.find(p => p.type === 'hour')?.value ?? '0'
  // Intl can return "24" for midnight in some locales — normalize.
  const n = parseInt(hourPart, 10)
  return n === 24 ? 0 : n
}
