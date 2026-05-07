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
  appointmentType: string | null   // type as passed to book_appointment (e.g. "Demo", "Tech Support")
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
    appointmentType: ctx.appointmentType,
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = replacements[key]
    return (v != null && v !== '') ? v : match
  })
}

async function buildContext(enrollment: EnrollmentWithRels): Promise<DispatchContext> {
  const [profile, tenant, fallbackPhone] = await Promise.all([
    prisma.businessProfile.findFirst({
      where: { tenantId: enrollment.tenantId },
      select: { brandName: true },
    }),
    prisma.tenant.findUnique({
      where: { id: enrollment.tenantId },
      select: { displayName: true, publicPhone: true },
    }),
    // BusinessPhone fallback — if the tenant didn't fill `publicPhone`,
    // use their first inbound-enabled Twilio number so the
    // "call us at {businessPhone}" line in the Booking Confirmation
    // template doesn't end up with the literal placeholder.
    prisma.phoneNumber.findFirst({
      where:   { tenantId: enrollment.tenantId, isInboundEnabled: true },
      select:  { e164Number: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const businessName  = profile?.brandName  || tenant?.displayName || 'our team'
  const businessPhone = tenant?.publicPhone || fallbackPhone?.e164Number || null

  // Pull the enrollment's metaJson for any pre-baked appointment details
  // (set by the appointment-reminder hook before scheduling the
  // enrollment). For tag-driven enrollments (e.g. `booked` from the
  // record_disposition tool), metaJson is empty — so we also look up
  // the contact's most recent CONFIRMED appointment for this tenant
  // and use that. Without this fallback the Booking Confirmation email
  // ships with literal `{appointmentDate}` / `{appointmentTime}` text.
  const meta = (enrollment.metaJson ?? {}) as Record<string, unknown>
  let apptDate = typeof meta['appointmentDate'] === 'string' ? meta['appointmentDate'] : null
  let apptTime = typeof meta['appointmentTime'] === 'string' ? meta['appointmentTime'] : null
  let apptType = typeof meta['appointmentType'] === 'string' ? meta['appointmentType'] : null

  if (!apptDate || !apptTime || !apptType) {
    const recentAppt = await prisma.appointment.findFirst({
      where: {
        tenantId:  enrollment.tenantId,
        contactId: enrollment.contact.id,
        status:    'CONFIRMED',
        // Within the last 24h OR upcoming — covers booking-confirmation
        // (just-booked) and reminder (future) cases. Most recently
        // created wins ties.
        startAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select:  { startAt: true, timezone: true, appointmentType: true },
    })
    if (recentAppt) {
      const tz    = recentAppt.timezone || 'UTC'
      const start = new Date(recentAppt.startAt)
      if (!apptDate) {
        apptDate = start.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
        })
      }
      if (!apptTime) {
        apptTime = start.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short',
        })
      }
      if (!apptType) {
        apptType = recentAppt.appointmentType ?? null
      }
    }
  }

  return {
    contact: enrollment.contact,
    businessName,
    businessPhone,
    appointmentDate: apptDate,
    appointmentTime: apptTime,
    appointmentType: apptType,
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

async function dispatchVoice(enrollment: EnrollmentWithRels): Promise<{ ok: boolean; deferred?: boolean; error?: string }> {
  // Voice dispatch bridges into the existing OutboundCampaign infrastructure:
  //   1. Get-or-create a "bridge" OutboundCampaign whose audienceJson points
  //      back at this tag-driven Campaign (so we don't recreate per call).
  //   2. Insert one OutboundCallAttempt for this contact, with enrollmentId
  //      set so the status webhook can propagate the call outcome back.
  //   3. Call dispatchPendingCalls() — this places the Twilio call and
  //      transitions the attempt PENDING → DIALING.
  //   4. Return deferred=true so the scheduler leaves the enrollment in
  //      IN_PROGRESS until the Twilio status webhook resolves it.
  const phone = enrollment.contact.phoneE164
  if (!phone) return { ok: false, error: 'contact has no phone number' }

  try {
    const bridgeCampaign = await getOrCreateVoiceBridgeCampaign(enrollment.campaign)

    const attempt = await prisma.outboundCallAttempt.create({
      data: {
        tenantId:     enrollment.tenantId,
        campaignId:   bridgeCampaign.id,
        contactId:    enrollment.contactId,
        enrollmentId: enrollment.id,
        status:       'PENDING',
        attemptNumber: enrollment.attemptCount + 1,
      },
    })

    const { dispatchPendingCalls } = await import('../services/outbound.service.js')
    await dispatchPendingCalls(enrollment.tenantId, bridgeCampaign.id)

    // dispatchPendingCalls swallows per-call Twilio errors and marks attempts
    // FAILED with outcomeCode='dispatch_error: <detail>' rather than throwing.
    // Re-read the attempt — if Twilio rejected it synchronously, surface the
    // failure right away (no webhook will arrive). Otherwise the call is in
    // flight and the webhook will resolve the enrollment later.
    const post = await prisma.outboundCallAttempt.findUnique({
      where:  { id: attempt.id },
      select: { status: true, outcomeCode: true, providerCallId: true },
    })
    if (post && post.status === 'FAILED') {
      return { ok: false, error: post.outcomeCode ?? 'dispatch failed' }
    }

    return { ok: true, deferred: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'voice dispatch failed' }
  }
}

/**
 * Lazily creates an OutboundCampaign that mirrors a tag-driven Campaign.
 * The campaign's `description` is set to the tag-driven Campaign's `prompt`
 * so the voice gateway uses the right context for the greeting (the gateway
 * reads `campaign.description` and folds it into the agent's opening prompt).
 *
 * audienceJson stores the bridge marker: { kind, sourceCampaignId } — used
 * to find the bridge campaign on subsequent enrollments without creating
 * duplicates. We store this in audienceJson rather than adding a column
 * because OutboundCampaign already has the field and tag-driven bridges
 * never use it for actual audience data.
 */
async function getOrCreateVoiceBridgeCampaign(sourceCampaign: Campaign): Promise<{ id: string }> {
  // Find an existing bridge for this source campaign (using JSON path query)
  const existing = await prisma.outboundCampaign.findFirst({
    where: {
      tenantId: sourceCampaign.tenantId,
      audienceJson: { path: ['kind'], equals: 'tag_driven_bridge' },
      AND: { audienceJson: { path: ['sourceCampaignId'], equals: sourceCampaign.id } },
    },
    select: { id: true },
  })
  if (existing) return existing

  return prisma.outboundCampaign.create({
    data: {
      tenantId:    sourceCampaign.tenantId,
      name:        `[bridge] ${sourceCampaign.name}`,
      description: sourceCampaign.prompt,
      status:      'RUNNING',
      audienceJson: {
        kind: 'tag_driven_bridge',
        sourceCampaignId: sourceCampaign.id,
      },
    },
    select: { id: true },
  })
}

async function dispatchOne(enrollment: EnrollmentWithRels): Promise<void> {
  // Optimistic claim: only proceed if we're the one who flips PENDING → IN_PROGRESS.
  const claim = await prisma.campaignEnrollment.updateMany({
    where: { id: enrollment.id, status: 'PENDING' },
    data:  { status: 'IN_PROGRESS', lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  })
  if (claim.count === 0) return

  const ctx = await buildContext(enrollment)

  let result: { ok: boolean; deferred?: boolean; error?: string }
  switch (enrollment.channel) {
    case 'EMAIL':    result = await dispatchEmail(enrollment, ctx); break
    case 'SMS':      result = await dispatchSms(enrollment, ctx, 'SMS'); break
    case 'WHATSAPP': result = await dispatchSms(enrollment, ctx, 'WHATSAPP'); break
    case 'VOICE':    result = await dispatchVoice(enrollment); break
    default:         result = { ok: false, error: `unknown channel: ${enrollment.channel}` }
  }

  if (result.ok && result.deferred) {
    // Dispatch was placed but final outcome lives in another lifecycle (e.g.
    // a Twilio status webhook for a voice call). Leave the enrollment in
    // IN_PROGRESS — that lifecycle will mark it COMPLETED or FAILED.
    return
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
