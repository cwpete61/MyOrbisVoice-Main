import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { getPartnerSendingDomain } from './sending-domain.service.js'
import { getPartnerPolicy, setPartnerBulkSuspension } from './email-bulk-policy.service.js'
import { checkSuppression, addSuppression } from './email-suppression.service.js'
import { verifyEmail, isEmailSafeToContact } from './reoon.service.js'
import { sendEmail } from './aws-ses.service.js'
import { escapeHtml, postalAddress } from '../lib/bulk-email-pure.js'

// Cold-email send engine (Bulk Email Phase 2). Sends one compliant cold email
// through a partner's dedicated SES sending domain. Every send runs the full
// pre-send gate: active domain → partner policy → send window → daily cap →
// drip interval → suppression list → Reoon verification. Only then does it
// build the CAN-SPAM-compliant message (unsubscribe link + postal address)
// and hand it to SES. Every attempt is logged as a ColdEmailSend row.
//
// Distinct from the transactional stream (email.service.ts / Postmark): cold
// outreach must never share that reputation.

const FROM_LOCAL_PART = 'outreach' // outreach@<partner-sending-domain>
const API_BASE_URL = (process.env['API_BASE_URL'] || 'https://api.myorbisvoice.com').replace(/\/$/, '')

/** The public unsubscribe URL for a send token. The API endpoint serves both
 *  the visible footer link (GET → confirmation page) and the one-click POST. */
function unsubscribeUrl(token: string): string {
  return `${API_BASE_URL}/api/public/unsubscribe?token=${encodeURIComponent(token)}`
}

// SES configuration set — all cold-email sends route bounce/complaint events
// through this one set's SNS event destination.
const SES_CONFIGURATION_SET = process.env['AWS_SES_CONFIGURATION_SET'] || 'my-first-configuration-set'

export type ColdEmailOutcome = 'SENT' | 'SUPPRESSED' | 'INVALID' | 'BLOCKED' | 'FAILED'

export interface SendColdEmailInput {
  partnerId: string
  to: string
  subject: string
  bodyHtml: string // the partner's message body (e.g. the AI-generated intro)
}

export interface SendColdEmailResult {
  outcome: ColdEmailOutcome
  sendId: string | null
  reason?: string
}

type PartnerInfo = {
  businessName: string | null
  displayName: string | null
  partnerStreet: string | null
  partnerUnit: string | null
  partnerCity: string | null
  partnerState: string | null
  partnerPostalCode: string | null
  user: { email: string } | null
}

/** Append the CAN-SPAM footer: sender identity, postal address, unsubscribe. */
function withFooter(bodyHtml: string, p: PartnerInfo, unsubscribeToken: string): string {
  const unsubUrl = unsubscribeUrl(unsubscribeToken)
  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.6;">
  <p style="margin:0 0 6px;">${escapeHtml(postalAddress(p))}</p>
  <p style="margin:0;"><a href="${unsubUrl}" style="color:#888888;">Unsubscribe</a> — you will not be emailed again.</p>
</div>`
  return `${bodyHtml}\n${footer}`
}

/** Count of emails this partner has actually SENT today (server-local day). */
async function sentToday(partnerId: string): Promise<number> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  return prisma.coldEmailSend.count({
    where: { partnerId, status: 'SENT', sentAt: { gte: dayStart } },
  })
}

/**
 * Send one cold email. Never throws — every path resolves to a logged
 * ColdEmailSend row and a typed result, so callers (a route today, the
 * sequencer later) get a clean outcome to act on.
 */
export async function sendColdEmail(input: SendColdEmailInput): Promise<SendColdEmailResult> {
  const { partnerId } = input
  const to = input.to.trim().toLowerCase()

  // 1. Active sending domain — ACTIVE, or WARMING (capped to the warmup cap).
  const domain = await getPartnerSendingDomain(partnerId)
  if (!domain || (domain.status !== 'ACTIVE' && domain.status !== 'WARMING')) {
    return blocked(partnerId, to, input.subject, 'No active sending domain — finish the domain wizard first')
  }

  // 2. Partner policy — must be bulk-enabled and not suspended.
  const policy = await getPartnerPolicy(partnerId)
  if (!policy) return blocked(partnerId, to, input.subject, 'Partner not found')
  if (!policy.bulkEnabled) return blocked(partnerId, to, input.subject, 'Bulk email is not enabled for this partner')
  if (policy.suspended) {
    return blocked(partnerId, to, input.subject, `Bulk email suspended: ${policy.suspendedReason ?? 'reputation'}`)
  }

  // 3. Send window — current hour must fall inside [start, end).
  const hour = new Date().getHours()
  if (hour < policy.sendWindowStartHour || hour >= policy.sendWindowEndHour) {
    return blocked(partnerId, to, input.subject,
      `Outside the send window (${policy.sendWindowStartHour}:00–${policy.sendWindowEndHour}:00)`)
  }

  // 4. Daily cap — the warmup cap while WARMING, otherwise the policy cap.
  const cap = domain.status === 'WARMING' ? domain.warmupDayCap : policy.dailyCap
  if (await sentToday(partnerId) >= cap) {
    return blocked(partnerId, to, input.subject, `Daily cap reached (${cap}/day)`)
  }

  // 5. Drip — enough time must have passed since the last send.
  const lastSend = await prisma.coldEmailSend.findFirst({
    where: { partnerId, status: 'SENT' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  if (lastSend?.sentAt) {
    const elapsed = (Date.now() - lastSend.sentAt.getTime()) / 1000
    if (elapsed < policy.dripIntervalSecs) {
      return blocked(partnerId, to, input.subject,
        `Drip interval — wait ${Math.ceil(policy.dripIntervalSecs - elapsed)}s`)
    }
  }

  // 6. Suppression list — unsubscribes, bounces, complaints.
  const supp = await checkSuppression({ email: to, partnerId, kind: 'marketing' })
  if (supp.suppressed) {
    return logOutcome(partnerId, domain.id, to, input.subject, 'SUPPRESSED',
      `On the suppression list (${supp.reason}, ${supp.scope})`)
  }

  // 7. Reoon verification — drop addresses that would bounce.
  const { status } = await verifyEmail(to)
  if (!isEmailSafeToContact(status)) {
    return logOutcome(partnerId, domain.id, to, input.subject, 'INVALID',
      `Reoon flagged the address as "${status}"`)
  }

  // 8. Build + send.
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: {
      businessName: true, displayName: true,
      partnerStreet: true, partnerUnit: true, partnerCity: true,
      partnerState: true, partnerPostalCode: true,
      user: { select: { email: true } },
    },
  })
  if (!partner) return blocked(partnerId, to, input.subject, 'Partner not found')

  const token = randomBytes(24).toString('base64url')
  const fromEmail = `${FROM_LOCAL_PART}@${domain.domain}`
  const send = await prisma.coldEmailSend.create({
    data: {
      partnerId,
      sendingDomainId: domain.id,
      toEmail: to,
      fromEmail,
      subject: input.subject,
      status: 'QUEUED',
      unsubscribeToken: token,
    },
  })

  try {
    const html = withFooter(input.bodyHtml, partner, token)
    const { messageId } = await sendEmail({
      from: fromEmail,
      to,
      subject: input.subject,
      html,
      replyTo: partner.user?.email ?? undefined,
      configurationSet: SES_CONFIGURATION_SET,
      // One-click unsubscribe — required by Gmail/Yahoo bulk-sender rules.
      headers: [
        { name: 'List-Unsubscribe', value: `<${unsubscribeUrl(token)}>` },
        { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
      ],
    })
    await prisma.coldEmailSend.update({
      where: { id: send.id },
      data: { status: 'SENT', sesMessageId: messageId, sentAt: new Date() },
    })
    return { outcome: 'SENT', sendId: send.id }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await prisma.coldEmailSend.update({
      where: { id: send.id },
      data: { status: 'FAILED', failureReason: reason },
    })
    return { outcome: 'FAILED', sendId: send.id, reason }
  }
}

/**
 * Honor an unsubscribe from the CAN-SPAM footer link. Looks the recipient up
 * by their per-send token, adds them to the partner-scoped suppression list,
 * and stamps the send. Idempotent — a second click is a clean no-op. Returns
 * ok=false only when the token is unrecognised.
 */
export async function unsubscribeByToken(token: string): Promise<{ ok: boolean; email?: string }> {
  const t = token.trim()
  if (!t) return { ok: false }
  const send = await prisma.coldEmailSend.findUnique({ where: { unsubscribeToken: t } })
  if (!send) return { ok: false }

  await addSuppression({
    email: send.toEmail,
    reason: 'UNSUBSCRIBE',
    partnerId: send.partnerId,
    note: `Cold-email footer unsubscribe (send ${send.id})`,
  })
  if (!send.unsubscribedAt) {
    await prisma.coldEmailSend.update({
      where: { id: send.id },
      data: { unsubscribedAt: new Date() },
    })
  }
  return { ok: true, email: send.toEmail }
}

// ── SES bounce / complaint events ───────────────────────────────────────────

interface SesNotification {
  eventType?: string // set when the event comes from a configuration set
  notificationType?: string // set when it comes from identity-level notifications
  mail?: { messageId?: string }
  bounce?: { bounceType?: string }
  complaint?: unknown
}

/**
 * Process one SES bounce/complaint event (delivered via SNS). Matches it back
 * to a ColdEmailSend by SES message id, marks the send, suppresses the address
 * (hard bounces and complaints are dead everywhere — suppressed globally and
 * partner-scoped), then re-checks the partner's reputation for auto-pause.
 * Unknown / non-ours events are ignored.
 */
export async function recordSesEvent(event: SesNotification): Promise<void> {
  const messageId = event.mail?.messageId
  if (!messageId) return

  const send = await prisma.coldEmailSend.findFirst({
    where: { sesMessageId: messageId },
    select: { id: true, partnerId: true, toEmail: true },
  })
  if (!send) return // not a cold-email send we know about

  const type = event.eventType ?? event.notificationType
  if (type === 'Bounce') {
    // Only permanent (hard) bounces suppress — transient bounces may recover.
    if (event.bounce?.bounceType !== 'Permanent') return
    await prisma.coldEmailSend.update({
      where: { id: send.id },
      data: { status: 'BOUNCED', bouncedAt: new Date() },
    })
    await addSuppression({ email: send.toEmail, reason: 'HARD_BOUNCE' })
    await addSuppression({ email: send.toEmail, reason: 'HARD_BOUNCE', partnerId: send.partnerId })
  } else if (type === 'Complaint') {
    await prisma.coldEmailSend.update({
      where: { id: send.id },
      data: { status: 'COMPLAINED', complainedAt: new Date() },
    })
    await addSuppression({ email: send.toEmail, reason: 'COMPLAINT' })
    await addSuppression({ email: send.toEmail, reason: 'COMPLAINT', partnerId: send.partnerId })
  } else {
    return // Delivery / Send / Open / Click — nothing to act on here
  }

  await maybeAutoPause(send.partnerId)
}

/** Auto-pause a partner whose recent hard-bounce or complaint rate crosses the
 *  policy threshold. Sampled over the policy's evaluation window; a minimum
 *  sample guards against false positives on a brand-new sender. */
async function maybeAutoPause(partnerId: string): Promise<void> {
  const policy = await getPartnerPolicy(partnerId)
  if (!policy || policy.suspended) return

  const recent = await prisma.coldEmailSend.findMany({
    where: { partnerId, status: { in: ['SENT', 'BOUNCED', 'COMPLAINED'] } },
    orderBy: { createdAt: 'desc' },
    take: policy.bulkEvaluationWindow,
    select: { status: true },
  })
  if (recent.length < 20) return // too small a sample to judge

  const bounces = recent.filter(r => r.status === 'BOUNCED').length
  const complaints = recent.filter(r => r.status === 'COMPLAINED').length
  const bounceRate = bounces / recent.length
  const complaintRate = complaints / recent.length

  if (bounceRate >= policy.bounceAutoPauseRate) {
    await setPartnerBulkSuspension({
      partnerId,
      suspended: true,
      reason: `Auto-paused: hard-bounce rate ${(bounceRate * 100).toFixed(1)}% over the last ${recent.length} sends`,
    })
  } else if (complaintRate >= policy.complaintAutoPauseRate) {
    await setPartnerBulkSuspension({
      partnerId,
      suspended: true,
      reason: `Auto-paused: complaint rate ${(complaintRate * 100).toFixed(2)}% over the last ${recent.length} sends`,
    })
  }
}

/** Log a non-sent outcome (SUPPRESSED / INVALID) and return the result. */
async function logOutcome(
  partnerId: string,
  sendingDomainId: string,
  to: string,
  subject: string,
  status: 'SUPPRESSED' | 'INVALID',
  reason: string,
): Promise<SendColdEmailResult> {
  const send = await prisma.coldEmailSend.create({
    data: {
      partnerId, sendingDomainId, toEmail: to, fromEmail: '', subject,
      status, failureReason: reason, unsubscribeToken: randomBytes(24).toString('base64url'),
    },
  })
  return { outcome: status, sendId: send.id, reason }
}

/** Log a BLOCKED outcome — gate failures with no sending domain bound yet. */
async function blocked(
  partnerId: string,
  to: string,
  subject: string,
  reason: string,
): Promise<SendColdEmailResult> {
  const send = await prisma.coldEmailSend.create({
    data: {
      partnerId, sendingDomainId: '', toEmail: to, fromEmail: '', subject,
      status: 'BLOCKED', failureReason: reason,
      unsubscribeToken: randomBytes(24).toString('base64url'),
    },
  })
  return { outcome: 'BLOCKED', sendId: send.id, reason }
}
