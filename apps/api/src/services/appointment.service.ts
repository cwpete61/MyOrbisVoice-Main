import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { getAuthenticatedGoogleClient } from './google.service.js'
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
    .filter(b => !isNaN(b.start) && !isNaN(b.end))

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

export async function createAppointment(tenantId: string, userId: string, data: {
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
    actorType: 'USER',
    actorUserId: userId,
    action: 'appointment.created',
    targetType: 'Appointment',
    targetId: appointment.id,
    metadataJson: { googleEventId: event.data.id },
  })

  return appointment
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
