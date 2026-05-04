/**
 * Campaign scheduler — polls CampaignEnrollment for PENDING rows whose
 * scheduledCallAt has elapsed, and dispatches each one via the channel
 * recorded on the enrollment.
 *
 * Channel routing:
 *   VOICE     → enqueue an OutboundCallAttempt (existing outbound system)
 *   SMS       → sendMessage() to contact.phoneE164
 *   EMAIL     → sendGmailEmail() to contact.email
 *   WHATSAPP  → sendMessage() to whatsapp:<contact.phoneE164>
 *
 * Concurrency safety: each enrollment is claimed via an optimistic update
 * (status PENDING → IN_PROGRESS) before dispatch. If the claim returns 0
 * rows, another worker (or a previous tick) already grabbed it and we skip.
 *
 * Failure handling: a failed dispatch increments attemptCount. If the
 * count exceeds maxRetries, the enrollment is marked FAILED. Otherwise
 * it's re-scheduled retryIntervalHours into the future and put back to
 * PENDING for the next poll.
 *
 * The scheduler is intentionally simple — one tick = sequential dispatch
 * of up to BATCH_SIZE rows. We can move to a queue (BullMQ on Redis) once
 * volume justifies it; for now this fits the operational profile and
 * keeps the operational surface tiny.
 */
import { prisma } from '../lib/prisma.js'
import type { CampaignEnrollment, Campaign, Contact } from '@prisma/client'

const POLL_INTERVAL_MS = 60 * 1000
const BATCH_SIZE = 50

interface EnrollmentWithRels extends CampaignEnrollment {
  campaign: Campaign
  contact:  Contact
}

interface DispatchContext {
  contact:        Contact
  businessName:   string
  businessPhone:  string | null
  appointmentDate: string | null   // formatted date (e.g. "Tuesday, May 5")
  appointmentTime: string | null   // formatted time (e.g. "1:30 PM")
}

/**
 * Renders a template by replacing {placeholder} tokens. Unknown tokens
 * are left in place to make missing-context bugs visible rather than
 * silently producing partial messages.
 */
function renderTemplate(template: string, ctx: DispatchContext): string {
  const c = ctx.contact
  const replacements: Record<string, string | null> = {
    firstName:       c.firstName ?? null,
    lastName:        c.lastName ?? null,
    fullName:        c.fullName ?? ([c.firstName, c.lastName].filter(Boolean).join(' ') || null),
    email:           c.email ?? null,
    phone:           c.phoneE164 ?? null,
    businessName:    ctx.businessName,
    businessPhone:   ctx.businessPhone,
    appointmentDate: ctx.appointmentDate,
    appointmentTime: ctx.appointmentTime,
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = replacements[key]
    return (v != null && v !== '') ? v : match
  })
}

async function buildContext(enrollment: EnrollmentWithRels): Promise<DispatchContext> {
  const [profile, tenant] = await Promise.all([
    prisma.businessProfile.findFirst({
      where: { tenantId: enrollment.tenantId },
      select: { brandName: true },
    }),
    prisma.tenant.findUnique({
      where: { id: enrollment.tenantId },
      select: { displayName: true, publicPhone: true },
    }),
  ])
  const businessName = profile?.brandName || tenant?.displayName || 'our team'

  // Pull the enrollment's metaJson for any pre-baked appointment details
  // (set by the appointment-reminder hook before scheduling the enrollment).
  const meta = (enrollment.metaJson ?? {}) as Record<string, unknown>
  const apptDate = typeof meta['appointmentDate'] === 'string' ? meta['appointmentDate'] : null
  const apptTime = typeof meta['appointmentTime'] === 'string' ? meta['appointmentTime'] : null

  return {
    contact: enrollment.contact,
    businessName,
    businessPhone: tenant?.publicPhone ?? null,
    appointmentDate: apptDate,
    appointmentTime: apptTime,
  }
}

async function dispatchEmail(enrollment: EnrollmentWithRels, ctx: DispatchContext): Promise<{ ok: boolean; error?: string }> {
  const c = enrollment.campaign
  const to = enrollment.contact.email
  if (!to) return { ok: false, error: 'contact has no email address' }
  if (!c.emailSubject || !c.emailBody) return { ok: false, error: 'campaign has no email subject or body' }

  const subject = renderTemplate(c.emailSubject, ctx)
  const body    = renderTemplate(c.emailBody, ctx)

  try {
    const { sendGmailEmail } = await import('../services/google.service.js')
    await sendGmailEmail(enrollment.tenantId, {
      to,
      subject,
      body,
      contactId: enrollment.contactId,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'email send failed' }
  }
}

async function dispatchSms(enrollment: EnrollmentWithRels, ctx: DispatchContext, channel: 'SMS' | 'WHATSAPP'): Promise<{ ok: boolean; error?: string }> {
  const c = enrollment.campaign
  const phone = enrollment.contact.phoneE164
  if (!phone) return { ok: false, error: 'contact has no phone number' }

  const template = channel === 'WHATSAPP' ? c.whatsappBody : c.smsBody
  if (!template) return { ok: false, error: `campaign has no ${channel.toLowerCase()} body` }
  const body = renderTemplate(template, ctx)

  // For SMS, send from the platform Twilio number. The subaccount-based
  // sender lives in sms.service.ts:sendMessage() but it requires per-tenant
  // subaccount provisioning that's not yet wired for all tenants. For now,
  // we send via the platform's master account (works the same when A2P
  // is approved or when using a verified toll-free number).
  try {
    const { sendTestMessage } = await import('../services/sms.service.js')
    const { getConfigValue } = await import('../services/system-config.service.js')
    const platformPhone = await getConfigValue('twilio_phone_number')
    if (!platformPhone) return { ok: false, error: 'platform phone number not configured' }

    const to = channel === 'WHATSAPP' ? `whatsapp:${phone}` : phone
    const from = channel === 'WHATSAPP' ? `whatsapp:${platformPhone}` : platformPhone
    const result = await sendTestMessage({ to, from, body, mode: 'live' })
    return result.ok ? { ok: true } : { ok: false, error: result.errorMessage ?? String(result.errorCode) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMS send failed' }
  }
}

async function dispatchVoice(enrollment: EnrollmentWithRels): Promise<{ ok: boolean; error?: string }> {
  // Voice dispatch from tag-driven Campaign is not yet wired to the outbound
  // caller (OutboundCallAttempt belongs to OutboundCampaign — a separate
  // model). For now mark these enrollments FAILED with a clear note so they
  // surface in the UI; the outbound-call wiring is a follow-up task.
  void enrollment
  return { ok: false, error: 'voice dispatch from tag-driven campaigns not yet wired (see scheduler stub)' }
}

async function dispatchOne(enrollment: EnrollmentWithRels): Promise<void> {
  // Optimistic claim: only proceed if we're the one who flips PENDING → IN_PROGRESS.
  const claim = await prisma.campaignEnrollment.updateMany({
    where: { id: enrollment.id, status: 'PENDING' },
    data:  { status: 'IN_PROGRESS', lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  })
  if (claim.count === 0) return

  const ctx = await buildContext(enrollment)

  let result: { ok: boolean; error?: string }
  switch (enrollment.channel) {
    case 'EMAIL':    result = await dispatchEmail(enrollment, ctx); break
    case 'SMS':      result = await dispatchSms(enrollment, ctx, 'SMS'); break
    case 'WHATSAPP': result = await dispatchSms(enrollment, ctx, 'WHATSAPP'); break
    case 'VOICE':    result = await dispatchVoice(enrollment); break
    default:         result = { ok: false, error: `unknown channel: ${enrollment.channel}` }
  }

  if (result.ok) {
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
    return
  }

  // Failure path — retry if attempts remain, else mark FAILED
  const newAttemptCount = enrollment.attemptCount + 1
  if (newAttemptCount >= enrollment.campaign.maxRetries) {
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: 'FAILED', exitReason: result.error?.slice(0, 500) ?? 'dispatch failed', completedAt: new Date() },
    })
  } else {
    const retryAt = new Date(Date.now() + enrollment.campaign.retryIntervalHours * 60 * 60 * 1000)
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: 'PENDING', scheduledCallAt: retryAt },
    })
  }
}

async function runTick(): Promise<void> {
  const now = new Date()
  const due = await prisma.campaignEnrollment.findMany({
    where: {
      status: 'PENDING',
      scheduledCallAt: { lte: now },
    },
    include: { campaign: true, contact: true },
    take: BATCH_SIZE,
    orderBy: { scheduledCallAt: 'asc' },
  })

  if (due.length === 0) return
  console.log(`[campaign-scheduler] dispatching ${due.length} enrollment(s)`)

  // Sequential — keeps Twilio/Gmail rate-friendly and makes failure
  // analysis simpler. If volume grows, switch to a worker pool.
  for (const enrollment of due) {
    try {
      await dispatchOne(enrollment as EnrollmentWithRels)
    } catch (err) {
      console.error(`[campaign-scheduler] dispatch error for ${enrollment.id}:`, err)
    }
  }
}

export function startCampaignScheduler(): ReturnType<typeof setInterval> {
  // Run once at startup so any backlog from a restart fires immediately
  runTick().catch(err => console.error('[campaign-scheduler] startup tick failed:', err))

  return setInterval(() => {
    runTick().catch(err => console.error('[campaign-scheduler] scheduled tick failed:', err))
  }, POLL_INTERVAL_MS)
}
