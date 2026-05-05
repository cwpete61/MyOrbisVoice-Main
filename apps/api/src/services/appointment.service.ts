import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { getAuthenticatedGoogleClient, sendGmailEmail } from './google.service.js'
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

export async function searchAvailability(tenantId: string, params: SlotSearchParams): Promise<{
  slots: TimeSlot[]
  alternateSlots: TimeSlot[]
}> {
  const client = await getAuthenticatedGoogleClient(tenantId)
  const calendar = google.calendar({ version: 'v3', auth: client })

  const timeMin = new Date(params.preferredStartRange.from)
  const timeMax = new Date(params.preferredStartRange.to)

  // Fetch existing events in the range
  const eventsResp = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  const busyBlocks = (eventsResp.data.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      start: new Date(e.start?.dateTime ?? e.start?.date ?? '').getTime(),
      end: new Date(e.end?.dateTime ?? e.end?.date ?? '').getTime(),
    }))
    .filter(b => !Number.isNaN(b.start) && !Number.isNaN(b.end))

  const durationMs = params.durationMinutes * 60 * 1000
  const incrementMs = DEFAULT_SLOT_INCREMENT_MINUTES * 60 * 1000

  const slots: TimeSlot[] = []
  const alternateSlots: TimeSlot[] = []

  let cursor = timeMin.getTime()
  while (cursor + durationMs <= timeMax.getTime()) {
    const slotEnd = cursor + durationMs
    const isBusy = busyBlocks.some(b => cursor < b.end && slotEnd > b.start)
    const slot: TimeSlot = {
      startAt: new Date(cursor).toISOString(),
      endAt: new Date(slotEnd).toISOString(),
      available: !isBusy,
    }
    if (!isBusy) {
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
}) {
  const client = await getAuthenticatedGoogleClient(tenantId)
  const calendar = google.calendar({ version: 'v3', auth: client })

  // Check for conflicts
  const eventsResp = await calendar.events.list({
    calendarId: 'primary',
    timeMin: data.startAt,
    timeMax: data.endAt,
    singleEvents: true,
  })
  const conflicts = (eventsResp.data.items ?? []).filter(e => e.status !== 'cancelled')
  if (conflicts.length > 0) {
    throw new AppError('CONFLICT', 'The requested time slot is no longer available', 409)
  }

  // Create Google Calendar event
  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: data.appointmentType ?? 'Appointment',
      location: data.location,
      description: data.notes,
      start: { dateTime: data.startAt, timeZone: data.timezone },
      end: { dateTime: data.endAt, timeZone: data.timezone },
      attendees: data.attendeeEmail ? [{ email: data.attendeeEmail }] : [],
      reminders: { useDefault: true },
    },
    sendUpdates: 'all',
  })

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      contactId: data.contactId,
      conversationId: data.conversationId,
      status: 'CONFIRMED',
      appointmentType: data.appointmentType,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      timezone: data.timezone,
      providerEventId: event.data.id ?? undefined,
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
    metadataJson: { googleEventId: event.data.id },
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

  await sendGmailEmail(tenantId, {
    to:      opts.to,
    subject: `${apptLabel} confirmed — ${dateStr}`,
    body:    html,
    isHtml:  true,
  })
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

export async function cancelAppointment(tenantId: string, userId: string, appointmentId: string) {
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
    actorType: 'USER',
    actorUserId: userId,
    action: 'appointment.canceled',
    targetType: 'Appointment',
    targetId: appointmentId,
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
