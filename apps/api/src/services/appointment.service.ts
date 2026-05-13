import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { getAuthenticatedGoogleClient, sendGmailEmail } from './google.service.js'
import { sendEmail } from './email.service.js'
import type { Prisma } from '@prisma/client'

const DEFAULT_SLOT_INCREMENT_MINUTES = 30

interface SlotSearchParams {
  appointmentType?: string
  preferredStartRange: { from: string; to: string }
  timezone: string
  durationMinutes: number
}

interface TimeSlot {
  startAt: string
  endAt: string
  available: boolean
}

type DayHours = { open?: string; close?: string; closed?: boolean }
type BusinessHoursMap = Record<string, DayHours>

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function timeOfDayInTz(ms: number, timezone: string): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
    timeZone: timezone,
  })
}

function dayNameInTz(ms: number, timezone: string): string {
  return new Date(ms).toLocaleDateString('en-US', {
    weekday:  'long',
    timeZone: timezone,
  }).toLowerCase()
}

/**
 * Compute the offset in minutes between a wall-clock interpretation in the
 * given timezone and UTC. Positive when local is ahead of UTC. DST-aware
 * because the calculation is done against `date` directly.
 */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  // Reconstruct the local wall-clock as if it were UTC, then diff against
  // the actual UTC ms — gives offset minutes. `hour: '2-digit'` returns "24"
  // at midnight in some locales; normalise to "00".
  const hour = map['hour'] === '24' ? '00' : map['hour']
  const localAsUtc = Date.UTC(
    Number(map['year']), Number(map['month']) - 1, Number(map['day']),
    Number(hour), Number(map['minute']), Number(map['second']),
  )
  return Math.round((localAsUtc - date.getTime()) / 60000)
}

/**
 * Build the agent-facing label + local ISO for a slot. The label is what
 * the agent reads aloud to the caller ("9:30 AM EDT, Thursday, May 7"),
 * which the model can speak verbatim without doing timezone math itself.
 * The localIso is what the agent passes back into book_appointment so the
 * booking time matches what the caller heard.
 */
export function formatSlotForAgent(utcMs: number, timeZone: string): { label: string; startLocalIso: string } {
  const date = new Date(utcMs)

  const time = date.toLocaleTimeString('en-US', {
    hour:         'numeric',
    minute:       '2-digit',
    timeZone,
    timeZoneName: 'short',
  })
  const day = date.toLocaleDateString('en-US', {
    weekday:  'long',
    month:    'long',
    day:      'numeric',
    timeZone,
  })
  const label = `${time}, ${day}`

  // Build YYYY-MM-DDTHH:MM:SS in the target tz, then append ±HH:MM offset
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    hour12: false,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const hour = map['hour'] === '24' ? '00' : map['hour']
  const wall = `${map['year']}-${map['month']}-${map['day']}T${hour}:${map['minute']}:${map['second']}`

  const offsetMin = tzOffsetMinutes(date, timeZone)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs  = Math.abs(offsetMin)
  const hh   = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm   = String(abs % 60).padStart(2, '0')
  const startLocalIso = `${wall}${sign}${hh}:${mm}`

  return { label, startLocalIso }
}

/**
 * Resolve the effective timezone for a tenant — caller-provided value if
 * usable, otherwise tenant default, otherwise UTC. Used so search results
 * always come back framed in the business's timezone, never raw UTC, even
 * when the agent didn't pass a timezone.
 */
export async function resolveTenantTimezone(tenantId: string, callerTz?: string): Promise<string> {
  if (callerTz && callerTz !== 'UTC' && callerTz.length > 0) return callerTz
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { timezone: true },
  })
  return tenant?.timezone || 'UTC'
}

/**
 * Slot must start AND end inside the business's open hours for the slot's
 * weekday in the tenant's timezone. Closed days reject everything. If
 * `businessHoursJson` is null or has no entry for the day, the slot is
 * accepted (no constraint configured = "we're open"). This stops 9 AM
 * search requests from offering 9 PM slots when nothing is on the
 * calendar that evening — the original bug from the 2026-05-07 test call.
 */
function isWithinBusinessHours(
  slotStartMs: number,
  slotEndMs:   number,
  hours:       BusinessHoursMap | null,
  timezone:    string,
): boolean {
  if (!hours) return true
  const dayName = dayNameInTz(slotStartMs, timezone)
  const dayHours = hours[dayName]
  if (!dayHours) return true
  if (dayHours.closed) return false
  if (!dayHours.open || !dayHours.close) return true

  const startTime = timeOfDayInTz(slotStartMs, timezone)
  const endTime   = timeOfDayInTz(slotEndMs,   timezone)
  return startTime >= dayHours.open && endTime <= dayHours.close
}

export async function searchAvailability(
  tenantId: string,
  params: SlotSearchParams,
  /** Phase E.2 — when set, free/busy is computed against the partner's
   *  calendar instead of the tenant's. Business-hours constraints still
   *  read from the tenant's BusinessProfile (the partner doesn't have
   *  their own working-hours config yet — that lands in E.3). */
  partnerId?: string,
): Promise<{ slots: TimeSlot[]; alternateSlots: TimeSlot[] }> {
  // Pull business hours once per call so we can filter slots to opening
  // hours only. Defensive parse — anything that doesn't look like the
  // expected day-keyed object becomes null (= no constraint applied).
  const profile = await prisma.businessProfile.findUnique({
    where:  { tenantId },
    select: { businessHoursJson: true },
  })
  const rawHours = profile?.businessHoursJson as Record<string, unknown> | null
  let businessHours: BusinessHoursMap | null = null
  if (rawHours && typeof rawHours === 'object') {
    const parsed: BusinessHoursMap = {}
    let any = false
    for (const day of DAY_NAMES) {
      const v = rawHours[day]
      if (v && typeof v === 'object') {
        parsed[day] = v as DayHours
        any = true
      }
    }
    businessHours = any ? parsed : null
  }

  // Resolve Google client + target calendar — partner's when partnerId given,
  // tenant's otherwise. Both paths land in the same downstream slot algorithm.
  let client
  let calendarTarget: string = 'primary'
  if (partnerId) {
    const { getAuthenticatedGoogleClientForPartner } = await import('./google.service.js')
    client = await getAuthenticatedGoogleClientForPartner(partnerId)
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      select: { calendarId: true },
    })
    calendarTarget = partner?.calendarId ?? 'primary'
  } else {
    client = await getAuthenticatedGoogleClient(tenantId)
  }
  const calendar = google.calendar({ version: 'v3', auth: client })

  const timeMin = new Date(params.preferredStartRange.from)
  const timeMax = new Date(params.preferredStartRange.to)

  const eventsResp = await calendar.events.list({
    calendarId: calendarTarget,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  const busyBlocks = (eventsResp.data.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      start: new Date(e.start?.dateTime ?? e.start?.date ?? '').getTime(),
      end:   new Date(e.end?.dateTime   ?? e.end?.date   ?? '').getTime(),
    }))
    .filter(b => !Number.isNaN(b.start) && !Number.isNaN(b.end))

  const durationMs  = params.durationMinutes * 60 * 1000
  const incrementMs = DEFAULT_SLOT_INCREMENT_MINUTES * 60 * 1000

  const slots:          TimeSlot[] = []
  const alternateSlots: TimeSlot[] = []

  let cursor = timeMin.getTime()
  while (cursor + durationMs <= timeMax.getTime()) {
    const slotEnd = cursor + durationMs
    const isBusy  = busyBlocks.some(b => cursor < b.end && slotEnd > b.start)
    const inHours = isWithinBusinessHours(cursor, slotEnd, businessHours, params.timezone)

    if (!isBusy && inHours) {
      const slot: TimeSlot = {
        startAt:   new Date(cursor).toISOString(),
        endAt:     new Date(slotEnd).toISOString(),
        available: true,
      }
      if (slots.length < 5) {
        slots.push(slot)
      } else if (alternateSlots.length < 3) {
        alternateSlots.push(slot)
      }
    }
    cursor += incrementMs
  }

  return { slots, alternateSlots }
}

export async function createAppointment(tenantId: string, userId: string | null, data: {
  contactId?: string
  conversationId?: string
  appointmentType?: string
  startAt: string
  endAt: string
  timezone: string
  location?: string
  notes?: string
  attendeeEmail?: string
  /**
   * Phase E.2 — when set, this booking is for a partner-page widget call.
   * The Google Calendar event is created on the PARTNER's calendar (using
   * the partner's own OAuth token from IntegrationConnection) instead of
   * the tenant's. The DB row still belongs to `tenantId` (the platform
   * demo tenant) for admin visibility, but partnerId is persisted so the
   * partner-portal calendar view can filter/badge their own bookings.
   */
  partnerId?: string
}) {
  // Try the full Google-Calendar-integrated path. When partnerId is set we
  // use the partner's calendar; otherwise the tenant's. Both fall back to
  // PENDING DB-only on Google-unavailable errors — the agent's caller still
  // gets a confirmation email via platform SMTP and a human reconciles.
  let providerEventId: string | undefined
  let status: 'PENDING' | 'CONFIRMED' = 'CONFIRMED'

  try {
    // Resolve which Google client + target calendar to use. Partner-scoped
    // booking wins when partnerId is provided.
    let client
    let calendarTarget: string = 'primary'
    if (data.partnerId) {
      const { getAuthenticatedGoogleClientForPartner } = await import('./google.service.js')
      client = await getAuthenticatedGoogleClientForPartner(data.partnerId)
      const partner = await prisma.affiliateAccount.findUnique({
        where:  { id: data.partnerId },
        select: { calendarId: true },
      })
      calendarTarget = partner?.calendarId ?? 'primary'
    } else {
      client = await getAuthenticatedGoogleClient(tenantId)
    }
    const calendar = google.calendar({ version: 'v3', auth: client })

    // Check for conflicts on the target calendar
    const eventsResp = await calendar.events.list({
      calendarId: calendarTarget,
      timeMin: data.startAt,
      timeMax: data.endAt,
      singleEvents: true,
    })
    const conflicts = (eventsResp.data.items ?? []).filter(e => e.status !== 'cancelled')
    if (conflicts.length > 0) {
      throw new AppError('CONFLICT', 'The requested time slot is no longer available', 409)
    }

    // Create Google Calendar event. extendedProperties.private.source tags
    // events that came from the agent so the partner-portal Calendar view
    // (Phase E.1) can render them with the "Booked by Orby" badge.
    const event = await calendar.events.insert({
      calendarId: calendarTarget,
      requestBody: {
        summary: data.appointmentType ?? 'Appointment',
        location: data.location,
        description: data.notes,
        start: { dateTime: data.startAt, timeZone: data.timezone },
        end: { dateTime: data.endAt, timeZone: data.timezone },
        attendees: data.attendeeEmail ? [{ email: data.attendeeEmail }] : [],
        reminders: { useDefault: true },
        extendedProperties: { private: { source: 'myorbisvoice' } },
      },
      sendUpdates: 'all',
    })
    providerEventId = event.data.id ?? undefined
  } catch (err) {
    const e = err as AppError | Error
    // Re-throw CONFLICT — that's a real "slot taken" signal Orby needs to hear.
    if ((e as AppError).code === 'CONFLICT') throw e
    // For "Google account not connected" / "credentials not found" / network
    // errors talking to Google, degrade to a PENDING DB-only appointment.
    console.warn('[appointment] Google unavailable, creating PENDING DB-only appointment:', e.message)
    status = 'PENDING'
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      contactId: data.contactId,
      conversationId: data.conversationId,
      partnerId: data.partnerId,
      status,
      appointmentType: data.appointmentType,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      timezone: data.timezone,
      providerEventId,
      location: data.location,
      notes: data.notes,
    },
  })

  await writeAuditLog({
    tenantId,
    actorType: userId ? 'USER' : 'SYSTEM',
    actorUserId: userId ?? undefined,
    action: 'appointment.created',
    targetType: 'Appointment',
    targetId: appointment.id,
    metadataJson: { googleEventId: providerEventId, status },
  })

  // Best-effort: send a branded confirmation email from the tenant's own
  // Gmail account, separate from Google Calendar's automatic invite. The
  // calendar invite gets the meeting on the contact's calendar; this email
  // is the human-tone touch ("we're looking forward to seeing you").
  if (data.attendeeEmail) {
    sendAppointmentConfirmationEmail(tenantId, {
      to:               data.attendeeEmail,
      appointmentType:  data.appointmentType,
      startAt:          data.startAt,
      endAt:            data.endAt,
      timezone:         data.timezone,
      location:         data.location,
      notes:            data.notes,
    }).catch(err => console.warn('[appointment] confirmation email failed:', (err as Error).message))
  }

  // Tenant-owner notification: fires regardless of whether the visitor gave
  // an email. Sends to the tenant's registrationEmail so the owner sees every
  // new booking. Critical for the demo tenant (where Crawford is the owner and
  // needs to know when Orby books a demo on a partner page) and useful for any
  // production tenant that wants a backstop besides the calendar invite.
  sendTenantOwnerBookingNotification(tenantId, {
    appointmentId:    appointment.id,
    appointmentType:  data.appointmentType,
    startAt:          data.startAt,
    endAt:            data.endAt,
    timezone:         data.timezone,
    attendeeEmail:    data.attendeeEmail,
    contactId:        data.contactId,
    notes:            data.notes,
  }).catch(err => console.warn('[appointment] owner notification failed:', (err as Error).message))

  // Best-effort: enroll the contact into any active "appointment-reminder"
  // campaign (trigger tag = `appointment-scheduled`). The scheduler fires
  // these enrollments REMINDER_HOURS_BEFORE the appointment startAt.
  if (data.contactId) {
    enrollAppointmentReminder(tenantId, data.contactId, appointment.id, {
      startAt:  data.startAt,
      timezone: data.timezone,
    }).catch(err => console.warn('[appointment] reminder enrollment failed:', (err as Error).message))
  }

  return appointment
}

const REMINDER_HOURS_BEFORE = 24

async function enrollAppointmentReminder(
  tenantId: string,
  contactId: string,
  appointmentId: string,
  appt: { startAt: string; timezone: string },
): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { tenantId, triggerTag: 'appointment-scheduled', isActive: true },
  })
  if (!campaign) return

  const startDate = new Date(appt.startAt)
  const reminderAt = new Date(startDate.getTime() - REMINDER_HOURS_BEFORE * 60 * 60 * 1000)

  // Don't schedule a reminder for an appointment that's already <24h away —
  // the contact would receive a confusing "tomorrow" message for today.
  if (reminderAt.getTime() <= Date.now()) return

  const channels: Array<'VOICE' | 'SMS' | 'EMAIL' | 'WHATSAPP'> = []
  if (campaign.enableVoice)    channels.push('VOICE')
  if (campaign.enableSms)      channels.push('SMS')
  if (campaign.enableEmail)    channels.push('EMAIL')
  if (campaign.enableWhatsapp) channels.push('WHATSAPP')

  if (channels.length === 0) return

  const apptDate = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: appt.timezone })
  const apptTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: appt.timezone, timeZoneName: 'short' })

  await Promise.all(channels.map(channel =>
    prisma.campaignEnrollment.upsert({
      where: { campaignId_contactId_channel: { campaignId: campaign.id, contactId, channel } },
      update: {
        status: 'PENDING',
        triggerTag: 'appointment-scheduled',
        triggeredAt: new Date(),
        scheduledCallAt: reminderAt,
        attemptCount: 0,
        completedAt: null,
        exitReason: null,
        metaJson: { appointmentId, appointmentDate: apptDate, appointmentTime: apptTime },
      },
      create: {
        tenantId,
        campaignId: campaign.id,
        contactId,
        channel,
        triggerTag: 'appointment-scheduled',
        scheduledCallAt: reminderAt,
        status: 'PENDING',
        metaJson: { appointmentId, appointmentDate: apptDate, appointmentTime: apptTime },
      },
    })
  ))
}

async function sendAppointmentConfirmationEmail(tenantId: string, opts: {
  to:              string
  appointmentType?: string
  startAt:         string
  endAt:           string
  timezone:        string
  location?:       string
  notes?:          string
}) {
  const [tenant, profile] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } }),
    prisma.businessProfile.findUnique({ where: { tenantId }, select: { brandName: true, fallbackNotificationEmail: true } }),
  ])
  const businessName = profile?.brandName || tenant?.displayName || 'our team'
  const apptLabel    = opts.appointmentType || 'Appointment'
  const start        = new Date(opts.startAt)
  const dateStr      = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr      = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <h2 style="color:#1a9898;margin:0 0 8px">${apptLabel} confirmed</h2>
      <p style="color:#555;margin:0 0 20px">Thanks for booking with ${businessName}. Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:8px 0;color:#888;width:120px;vertical-align:top">When</td><td style="color:#222"><strong>${dateStr}</strong><br>${timeStr}</td></tr>
        ${opts.location ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Where</td><td style="color:#222">${opts.location}</td></tr>` : ''}
        ${opts.notes    ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Notes</td><td style="color:#222">${opts.notes}</td></tr>`       : ''}
      </table>
      <p style="color:#666;font-size:14px;margin:0 0 8px">You'll also see this on your calendar — Google has added it automatically.</p>
      ${profile?.fallbackNotificationEmail ? `<p style="color:#888;font-size:13px;margin:24px 0 0">Need to change something? Reply to this email or contact us at ${profile.fallbackNotificationEmail}.</p>` : ''}
    </div>
  `.trim()

  try {
    await sendGmailEmail(tenantId, {
      to:      opts.to,
      subject: `${apptLabel} confirmed — ${dateStr}`,
      body:    html,
      isHtml:  true,
    })
  } catch (gmailErr) {
    // Fall back to platform SMTP (self-hosted Postfix). Used by the demo
    // tenant and any tenant without a Gmail integration. The booking
    // confirmation still reaches the visitor; we lose only the per-tenant
    // From-address branding (the platform SMTP From is set via SystemConfig).
    await sendEmail({
      to:      opts.to,
      subject: `${apptLabel} confirmed — ${dateStr}`,
      html,
    })
    await prisma.messageLog.create({
      data: {
        tenantId,
        channel:        'EMAIL',
        direction:      'OUTBOUND',
        sender:         'platform-smtp',
        recipient:      opts.to,
        subject:        `${apptLabel} confirmed — ${dateStr}`,
        bodyText:       html.replace(/<[^>]+>/g, ''),
        deliveryStatus: 'sent',
        sentAt:         new Date(),
      },
    }).catch(() => { /* non-fatal */ })
  }
}

async function sendTenantOwnerBookingNotification(tenantId: string, opts: {
  appointmentId:    string
  appointmentType?: string
  startAt:          string
  endAt:            string
  timezone:         string
  attendeeEmail?:   string
  contactId?:       string
  notes?:           string
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { registrationEmail: true, displayName: true },
  })
  if (!tenant?.registrationEmail) return

  // Pull attendee name + phone off the Contact if we have one. Orby collects
  // them during booking; the gateway tool routes them into the Contact record
  // via findContact() before createAppointment() runs.
  let attendeeName: string | null = null
  let attendeePhone: string | null = null
  if (opts.contactId) {
    const c = await prisma.contact.findUnique({
      where: { id: opts.contactId },
      select: { fullName: true, firstName: true, lastName: true, phoneE164: true, email: true },
    })
    attendeeName = c?.fullName
      ?? ([c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || null)
    attendeePhone = c?.phoneE164 ?? null
  }

  const start   = new Date(opts.startAt)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const apptLabel = opts.appointmentType || 'Appointment'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <h2 style="color:#1a9898;margin:0 0 8px">New booking on ${tenant.displayName ?? 'your account'}</h2>
      <p style="color:#555;margin:0 0 20px">An appointment was just booked through the agent.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:8px 0;color:#888;width:120px;vertical-align:top">Type</td><td style="color:#222"><strong>${apptLabel}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#888;vertical-align:top">When</td><td style="color:#222"><strong>${dateStr}</strong><br>${timeStr}</td></tr>
        ${attendeeName  ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Name</td><td style="color:#222">${attendeeName}</td></tr>` : ''}
        ${opts.attendeeEmail ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Email</td><td style="color:#222">${opts.attendeeEmail}</td></tr>` : ''}
        ${attendeePhone ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Phone</td><td style="color:#222">${attendeePhone}</td></tr>` : ''}
        ${opts.notes    ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Notes</td><td style="color:#222">${opts.notes}</td></tr>` : ''}
      </table>
      <p style="color:#888;font-size:13px;margin:24px 0 0">Appointment ID: <code style="background:#f4f4f4;padding:2px 6px;border-radius:3px">${opts.appointmentId}</code></p>
    </div>
  `.trim()

  await sendEmail({
    to:      tenant.registrationEmail,
    subject: `New booking: ${apptLabel} — ${dateStr}`,
    html,
  })

  await prisma.messageLog.create({
    data: {
      tenantId,
      channel:        'EMAIL',
      direction:      'OUTBOUND',
      sender:         'platform-smtp',
      recipient:      tenant.registrationEmail,
      subject:        `New booking: ${apptLabel} — ${dateStr}`,
      bodyText:       html.replace(/<[^>]+>/g, ''),
      deliveryStatus: 'sent',
      sentAt:         new Date(),
    },
  }).catch(() => { /* non-fatal */ })
}

export async function rescheduleAppointment(tenantId: string, userId: string, appointmentId: string, data: {
  startAt: string
  endAt: string
  timezone: string
}) {
  const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } })
  if (!appt) throw new AppError('NOT_FOUND', 'Appointment not found', 404)

  if (appt.providerEventId) {
    const client = await getAuthenticatedGoogleClient(tenantId)
    const calendar = google.calendar({ version: 'v3', auth: client })
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: appt.providerEventId,
      requestBody: {
        start: { dateTime: data.startAt, timeZone: data.timezone },
        end: { dateTime: data.endAt, timeZone: data.timezone },
      },
      sendUpdates: 'all',
    })
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'RESCHEDULED',
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      timezone: data.timezone,
    },
  })

  await writeAuditLog({
    tenantId,
    actorType: 'USER',
    actorUserId: userId,
    action: 'appointment.rescheduled',
    targetType: 'Appointment',
    targetId: appointmentId,
  })

  return updated
}

export async function cancelAppointment(tenantId: string, userId: string | null, appointmentId: string) {
  const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } })
  if (!appt) throw new AppError('NOT_FOUND', 'Appointment not found', 404)

  if (appt.providerEventId) {
    const client = await getAuthenticatedGoogleClient(tenantId)
    const calendar = google.calendar({ version: 'v3', auth: client })
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: appt.providerEventId,
      sendUpdates: 'all',
    }).catch(() => {})
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELED' },
  })

  await writeAuditLog({
    tenantId,
    actorType:   userId ? 'USER' : 'SYSTEM',
    actorUserId: userId ?? undefined,
    action:      'appointment.canceled',
    targetType:  'Appointment',
    targetId:    appointmentId,
  })

  return updated
}

export async function listAppointments(tenantId: string, query: {
  status?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const where: Prisma.AppointmentWhereInput = { tenantId }
  if (query.status) where.status = query.status as never
  if (query.from) where.startAt = { gte: new Date(query.from) }
  if (query.to) {
    where.startAt = typeof where.startAt === 'object'
      ? { ...(where.startAt as object), lte: new Date(query.to) }
      : { lte: new Date(query.to) }
  }
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({ where, take: limit, skip: offset, orderBy: { startAt: 'desc' } }),
    prisma.appointment.count({ where }),
  ])
  return { appointments, total, limit, offset }
}
