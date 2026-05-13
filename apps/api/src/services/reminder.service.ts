/**
 * Phase E.6 — Appointment reminder service.
 *
 * Decoupled from the campaign system so reminders fire without the tenant
 * having to set up a campaign. Schedule = create AppointmentReminder rows on
 * booking; the reminder-runner job polls PENDING rows where scheduledAt <= now
 * and dispatches via email + SMS.
 *
 * Read pattern:
 *   - createAppointment (appointment.service.ts) calls scheduleAppointmentReminders
 *   - reminder-runner (jobs/reminder-runner.ts) calls dispatchDueReminders
 *
 * Config lives on BusinessProfile (reminderEnabled / reminderOffsetsMin /
 * reminderEmailEnabled / reminderSmsEnabled) and is editable from
 * /dashboard/settings → Booking preferences.
 */
import { prisma } from '../lib/prisma.js'
import { sendEmail } from './email.service.js'
import { sendGmailEmail } from './google.service.js'
import { sendSms } from './sms.service.js'
import type { ReminderChannel } from '@prisma/client'

const REMINDER_BATCH_SIZE = 50

/**
 * Create AppointmentReminder rows for every configured offset × channel that
 * still lies in the future. Idempotent — safe to call twice (the unique key
 * `[appointmentId, channel, offsetMin]` collapses duplicates).
 *
 * Skips silently when:
 *   - reminderEnabled is false
 *   - no offsets configured
 *   - contact has no email AND no phone
 *   - resulting scheduledAt is already in the past
 */
export async function scheduleAppointmentReminders(opts: {
  tenantId:      string
  appointmentId: string
  contactId:     string
  startAt:       Date
  contactEmail:  string | null
  contactPhone:  string | null
}): Promise<{ scheduled: number }> {
  // Phase E.12 — if the appointment is partner-routed (Appointment.partnerId
  // set), the partner's reminder preferences take precedence over the tenant's.
  // Falls back to tenant config when the partner has none or partner reminders
  // are disabled. This lets partners run their own SLA different from the
  // platform default without each partner needing tenant-admin access.
  const appointment = await prisma.appointment.findUnique({
    where:  { id: opts.appointmentId },
    select: { partnerId: true },
  })

  let enabled:       boolean = false
  let offsets:       number[] = []
  let emailEnabled:  boolean = false
  let smsEnabled:    boolean = false

  if (appointment?.partnerId) {
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: appointment.partnerId },
      select: {
        partnerReminderEnabled:      true,
        partnerReminderOffsetsMin:   true,
        partnerReminderEmailEnabled: true,
        partnerReminderSmsEnabled:   true,
      },
    })
    if (partner) {
      enabled      = partner.partnerReminderEnabled
      offsets      = partner.partnerReminderOffsetsMin
      emailEnabled = partner.partnerReminderEmailEnabled
      smsEnabled   = partner.partnerReminderSmsEnabled
    }
  } else {
    const profile = await prisma.businessProfile.findUnique({
      where:  { tenantId: opts.tenantId },
      select: {
        reminderEnabled:      true,
        reminderOffsetsMin:   true,
        reminderEmailEnabled: true,
        reminderSmsEnabled:   true,
      },
    })
    if (profile) {
      enabled      = profile.reminderEnabled
      offsets      = profile.reminderOffsetsMin
      emailEnabled = profile.reminderEmailEnabled
      smsEnabled   = profile.reminderSmsEnabled
    }
  }

  if (!enabled) return { scheduled: 0 }
  if (!offsets || offsets.length === 0) return { scheduled: 0 }

  // Resolve which channels are eligible for this contact. A contact can be
  // reminded by email only, SMS only, or both — never neither.
  const channels: ReminderChannel[] = []
  if (emailEnabled && opts.contactEmail) channels.push('EMAIL')
  if (smsEnabled   && opts.contactPhone) channels.push('SMS')
  if (channels.length === 0) return { scheduled: 0 }

  const now = Date.now()
  const startMs = opts.startAt.getTime()
  let scheduled = 0

  for (const offsetMin of offsets) {
    const scheduledAt = new Date(startMs - offsetMin * 60 * 1000)
    // Skip reminders whose fire-time is already in the past (e.g. a booking
    // made <1h before the appointment when the offset is 60 min).
    if (scheduledAt.getTime() <= now) continue

    for (const channel of channels) {
      try {
        await prisma.appointmentReminder.upsert({
          where: {
            appointmentId_channel_offsetMin: {
              appointmentId: opts.appointmentId,
              channel,
              offsetMin,
            },
          },
          create: {
            tenantId:      opts.tenantId,
            appointmentId: opts.appointmentId,
            contactId:     opts.contactId,
            channel,
            offsetMin,
            scheduledAt,
          },
          // Re-schedule if the appointment got rescheduled (startAt changed).
          // Status returns to PENDING and the runner picks it up next tick.
          update: {
            scheduledAt,
            status:       'PENDING',
            errorReason:  null,
            sentAt:       null,
            attemptCount: 0,
          },
        })
        scheduled++
      } catch (err) {
        console.warn('[reminder] failed to upsert reminder:', (err as Error).message)
      }
    }
  }

  return { scheduled }
}

/**
 * Cancel all pending reminders for an appointment — call when the appointment
 * is cancelled or deleted. Leaves SENT rows in place for audit.
 */
export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId, status: 'PENDING' },
    data:  { status: 'CANCELLED' },
  })
}

/**
 * Reminder-runner entrypoint. Pulls a batch of due PENDING reminders and
 * dispatches each through the appropriate channel. Mark SENT on success and
 * FAILED + errorReason on failure (with a retry counter so the runner can
 * give up after N attempts and stop blocking the queue).
 */
export async function dispatchDueReminders(): Promise<{ dispatched: number; failed: number }> {
  const now = new Date()
  const due = await prisma.appointmentReminder.findMany({
    where: {
      status:      'PENDING',
      scheduledAt: { lte: now },
      attemptCount: { lt: 3 },  // give up after 3 attempts, stay PENDING for manual inspection
    },
    include: {
      appointment: { select: { startAt: true, timezone: true, appointmentType: true, location: true, notes: true, status: true } },
      contact:     { select: { fullName: true, firstName: true, email: true, phoneE164: true } },
      tenant:      { select: { displayName: true } },
    },
    take: REMINDER_BATCH_SIZE,
    orderBy: { scheduledAt: 'asc' },
  })
  if (due.length === 0) return { dispatched: 0, failed: 0 }

  let dispatched = 0
  let failed = 0
  for (const reminder of due) {
    // Skip if appointment was cancelled in the interim — flag the row so
    // we don't keep retrying. Note: AppointmentStatus enum uses the American
    // spelling 'CANCELED' (single L); ReminderStatus uses 'CANCELLED' (double).
    if (reminder.appointment.status === 'CANCELED') {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data:  { status: 'CANCELLED' },
      })
      continue
    }

    try {
      if (reminder.channel === 'EMAIL') {
        await sendReminderEmail({
          tenantId:        reminder.tenantId,
          to:              reminder.contact.email ?? '',
          firstName:       reminder.contact.firstName ?? reminder.contact.fullName ?? null,
          appointmentType: reminder.appointment.appointmentType,
          startAt:         reminder.appointment.startAt,
          timezone:        reminder.appointment.timezone,
          location:        reminder.appointment.location,
          notes:           reminder.appointment.notes,
          offsetMin:       reminder.offsetMin,
        })
      } else {
        await sendReminderSms({
          tenantId:        reminder.tenantId,
          contactId:       reminder.contactId,
          to:              reminder.contact.phoneE164 ?? '',
          firstName:       reminder.contact.firstName ?? null,
          appointmentType: reminder.appointment.appointmentType,
          startAt:         reminder.appointment.startAt,
          timezone:        reminder.appointment.timezone,
          businessName:    reminder.tenant.displayName,
          offsetMin:       reminder.offsetMin,
        })
      }
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data:  { status: 'SENT', sentAt: new Date(), attemptCount: { increment: 1 } },
      })
      dispatched++
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown'
      const nextAttempt = reminder.attemptCount + 1
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data:  {
          status:       nextAttempt >= 3 ? 'FAILED' : 'PENDING',
          errorReason:  msg.slice(0, 500),
          attemptCount: nextAttempt,
        },
      })
      failed++
      console.warn(`[reminder] dispatch failed for ${reminder.id} (attempt ${nextAttempt}):`, msg)
    }
  }
  return { dispatched, failed }
}

// ── Channel-specific send helpers ───────────────────────────────────────────

function formatOffsetHumanReadable(offsetMin: number): string {
  if (offsetMin >= 60 && offsetMin % 60 === 0) {
    const hrs = offsetMin / 60
    if (hrs === 24) return 'tomorrow'
    if (hrs > 24 && hrs % 24 === 0) return `in ${hrs / 24} day${hrs / 24 === 1 ? '' : 's'}`
    return `in ${hrs} hour${hrs === 1 ? '' : 's'}`
  }
  return `in ${offsetMin} minute${offsetMin === 1 ? '' : 's'}`
}

/**
 * Substitute {variable} placeholders in a tenant-authored template. Unknown
 * variables are left as-is (no exception) so a typo in the editor doesn't
 * crash the runner. Variables map to the same set used by the built-in
 * defaults — keep them in sync with the UI help text in /settings.
 */
export function renderReminderTemplate(template: string, vars: Record<string, string | null>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name]
    return typeof v === 'string' ? v : match
  })
}

// Default SMS template — kept here so the customization UI can preview the
// fallback exactly as the runner would render it.
export const DEFAULT_REMINDER_SMS = '{greeting}reminder: your {apptLower} with {businessName} is {whenLabel}, {dateShort} at {timeShort}.'
export const DEFAULT_REMINDER_EMAIL_SUBJECT = 'Reminder: {appointmentType} {whenLabel} — {dateStr}'
export const DEFAULT_REMINDER_EMAIL_INTRO   = '{greeting} this is a quick reminder of your upcoming {apptLower} with {businessName}.'

async function sendReminderEmail(opts: {
  tenantId:        string
  to:              string
  firstName:       string | null
  appointmentType: string | null
  startAt:         Date
  timezone:        string
  location:        string | null
  notes:           string | null
  offsetMin:       number
}) {
  if (!opts.to) throw new Error('No email on contact')

  const [tenant, profile] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: opts.tenantId }, select: { displayName: true } }),
    prisma.businessProfile.findUnique({
      where: { tenantId: opts.tenantId },
      select: {
        brandName: true, fallbackNotificationEmail: true,
        reminderEmailSubject: true, reminderEmailIntro: true,
      },
    }),
  ])
  const businessName = profile?.brandName || tenant?.displayName || 'our team'
  const apptLabel    = opts.appointmentType || 'Appointment'
  const dateStr      = opts.startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr      = opts.startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const whenLabel    = formatOffsetHumanReadable(opts.offsetMin)
  const greeting     = opts.firstName ? `Hi ${opts.firstName},` : 'Hi,'

  // Tenant-authored templates override the built-in defaults when set. The
  // appointment-details table and the platform footer stay constant — the
  // template only governs the subject line and the intro paragraph, so a
  // poorly-edited template can't break the visual layout.
  const vars: Record<string, string> = {
    firstName:        opts.firstName ?? '',
    greeting,
    businessName,
    appointmentType:  apptLabel,
    apptLower:        apptLabel.toLowerCase(),
    whenLabel,
    dateStr,
    timeStr,
    dateShort:        opts.startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: opts.timezone }),
    timeShort:        opts.startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone }),
    location:         opts.location ?? '',
  }
  const subject = renderReminderTemplate(profile?.reminderEmailSubject ?? DEFAULT_REMINDER_EMAIL_SUBJECT, vars)
  const intro   = renderReminderTemplate(profile?.reminderEmailIntro   ?? DEFAULT_REMINDER_EMAIL_INTRO,   vars)

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <h2 style="color:#1a9898;margin:0 0 8px">Reminder: ${apptLabel} ${whenLabel}</h2>
      <p style="color:#555;margin:0 0 20px">${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:8px 0;color:#888;width:120px;vertical-align:top">When</td><td style="color:#222"><strong>${dateStr}</strong><br>${timeStr}</td></tr>
        ${opts.location ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Where</td><td style="color:#222">${opts.location}</td></tr>` : ''}
        ${opts.notes    ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Notes</td><td style="color:#222">${opts.notes}</td></tr>`       : ''}
      </table>
      <p style="color:#666;font-size:14px;margin:0 0 8px">See you then.</p>
      ${profile?.fallbackNotificationEmail ? `<p style="color:#888;font-size:13px;margin:24px 0 0">Need to reschedule? Reply to this email or contact us at ${profile.fallbackNotificationEmail}.</p>` : ''}
    </div>
  `.trim()

  try {
    await sendGmailEmail(opts.tenantId, { to: opts.to, subject, body: html, isHtml: true })
  } catch {
    // Fall back to platform SMTP — same fallback ladder as the confirmation email.
    await sendEmail({ to: opts.to, subject, html })
    await prisma.messageLog.create({
      data: {
        tenantId:       opts.tenantId,
        channel:        'EMAIL',
        direction:      'OUTBOUND',
        sender:         'platform-smtp',
        recipient:      opts.to,
        subject,
        bodyText:       html.replace(/<[^>]+>/g, ''),
        deliveryStatus: 'sent',
        sentAt:         new Date(),
      },
    }).catch(() => { /* non-fatal */ })
  }
}

async function sendReminderSms(opts: {
  tenantId:        string
  contactId:       string
  to:              string
  firstName:       string | null
  appointmentType: string | null
  startAt:         Date
  timezone:        string
  businessName:    string | null
  offsetMin:       number
}) {
  if (!opts.to) throw new Error('No phone on contact')

  const apptLabel  = opts.appointmentType || 'appointment'
  const dateStr    = opts.startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: opts.timezone })
  const timeStr    = opts.startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone })
  const whenLabel  = formatOffsetHumanReadable(opts.offsetMin)
  const business   = opts.businessName ?? 'us'
  const greeting   = opts.firstName ? `Hi ${opts.firstName}, ` : ''

  // Tenant-authored SMS template overrides the default. Variables follow the
  // same set as the email template so users can copy/paste between fields.
  // Keep result short — single segment (≤160 chars) when possible. Sender ID
  // + STOP language are appended automatically by Twilio's 10DLC config.
  const profile = await prisma.businessProfile.findUnique({
    where:  { tenantId: opts.tenantId },
    select: { reminderSmsBody: true },
  })
  const vars: Record<string, string> = {
    firstName:       opts.firstName ?? '',
    greeting,
    businessName:    business,
    appointmentType: apptLabel,
    apptLower:       apptLabel.toLowerCase(),
    whenLabel,
    dateShort:       dateStr,
    timeShort:       timeStr,
    dateStr,
    timeStr,
  }
  const body = renderReminderTemplate(profile?.reminderSmsBody ?? DEFAULT_REMINDER_SMS, vars)

  // Resolve a sending number — required by sendSms. Tenants without any Twilio
  // number can't send SMS reminders; we surface that as a clear error so the
  // reminder row marks FAILED instead of silently dropping.
  const phone = await prisma.phoneNumber.findFirst({
    where:  { tenantId: opts.tenantId },
    select: { e164Number: true },
  })
  if (!phone) throw new Error('No Twilio number configured for this tenant')

  const result = await sendSms({
    tenantId:  opts.tenantId,
    contactId: opts.contactId,
    from:      phone.e164Number,
    to:        opts.to,
    body,
  })
  if (!result.success) throw new Error(result.error ?? 'SMS send failed')
}
