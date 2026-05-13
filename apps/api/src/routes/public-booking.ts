import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../lib/async-handler.js'
import { AppError } from '@voiceautomation/shared'
import { getConfigValue } from '../services/system-config.service.js'
import { searchAvailability, createAppointment } from '../services/appointment.service.js'
import { createContact } from '../services/contact.service.js'

const router: IRouter = Router()

/**
 * Phase E.4 — Public prospect booking page.
 *
 * Visitor flow: prospect lands on /book/<slug> (in the SaaS app), the page
 * hydrates from these three endpoints. No auth required — the partner page
 * is itself public.
 *
 *   GET  /api/public/partners/:slug/booking-info
 *   GET  /api/public/partners/:slug/slots?from=&to=
 *   POST /api/public/partners/:slug/bookings
 */

const SHORT_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * Resolve which tenant a partner-driven public booking records under. Partner
 * Appointments still have a tenantId for admin visibility (the Google event
 * lands on the partner's calendar via partnerId). Resolution order:
 *   1. SystemConfig key `partner_booking_tenant_id` (explicit platform pick)
 *   2. First tenant created in the system (single-tenant SaaS fallback)
 */
async function resolvePartnerBookingTenantId(): Promise<string> {
  const configured = await getConfigValue('partner_booking_tenant_id')
  if (configured) return configured
  const first = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
    select:  { id: true },
  })
  if (!first) {
    throw new AppError('NOT_CONFIGURED', 'No platform tenant configured for partner bookings', 503)
  }
  return first.id
}

/** Look up a public-bookable partner by slug. Returns the row + a 404-style
 *  error when the partner is missing, not active, or hasn't connected Google. */
async function getBookablePartner(slug: string) {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { slug },
    select: {
      id:                     true,
      slug:                   true,
      displayName:            true,
      bio:                    true,
      avatarUrl:              true,
      businessName:           true,
      partnerPageActive:      true,
      integrationConnectionId: true,
      bookingHoursJson:       true,
      bookingSlotDurationMin: true,
      bookingMinNoticeMin:    true,
      bookingMaxAdvanceDays:  true,
      bookingTimezone:        true,
      user:                   { select: { firstName: true, lastName: true, preferredTimezone: true } },
    },
  })
  if (!partner || !partner.partnerPageActive) {
    throw new AppError('NOT_FOUND', 'Partner not found', 404)
  }
  return partner
}

// ─── GET /api/public/partners/:slug/booking-info ────────────────────────────
//
// Public partner info + booking constraints. Drives the page header (avatar,
// name, bio) and tells the calendar widget which days are open and what the
// default slot length is. Min-notice + max-advance are surfaced so the date
// picker can disable out-of-range days client-side.

router.get('/public/partners/:slug/booking-info', asyncHandler(async (req, res) => {
  const slug = req.params['slug']
  if (!slug) throw new AppError('BAD_REQUEST', 'slug required', 400)

  const partner = await getBookablePartner(slug)

  // Compose a display name with the same fallback chain the partner page uses
  const fallbackName = `${partner.user.firstName ?? ''} ${partner.user.lastName ?? ''}`.trim()
  const displayName  = partner.displayName ?? (fallbackName || partner.slug || 'Your host')

  // Surface which days have hours configured (without leaking the partner's
  // exact open/close times — the slot search will only return slots inside
  // hours, so the client just needs to know which days to disable).
  const hours = (partner.bookingHoursJson as Record<string, unknown> | null) ?? null
  const openDays: Record<string, boolean> = {}
  for (const day of SHORT_DAYS) {
    openDays[day] = Boolean(hours && hours[day])
  }
  // No hours configured at all → assume every day is bookable (matches the
  // searchAvailability behavior where a null hours map = "no constraint").
  const anyConfigured = Object.values(openDays).some(Boolean)
  if (!anyConfigured) {
    for (const day of SHORT_DAYS) openDays[day] = true
  }

  res.json({
    data: {
      slug:           partner.slug,
      displayName,
      businessName:   partner.businessName,
      bio:            partner.bio,
      avatarUrl:      partner.avatarUrl,
      calendarReady:  Boolean(partner.integrationConnectionId),
      slotDurationMin: partner.bookingSlotDurationMin,
      minNoticeMin:    partner.bookingMinNoticeMin,
      maxAdvanceDays:  partner.bookingMaxAdvanceDays,
      timezone:        partner.bookingTimezone ?? partner.user.preferredTimezone ?? null,
      openDays,
    },
  })
}))

// ─── GET /api/public/partners/:slug/slots ───────────────────────────────────
//
// Returns 30-min-incremented free slots for the given range, narrowed to the
// partner's working hours / notice / advance / buffers (see appointment.service
// E.3 wiring). Range is capped to 14 days to keep response size predictable
// for the date-picker UI; the client paginates by re-requesting.

const slotsQuerySchema = z.object({
  from: z.string().min(1, 'from is required (ISO datetime)'),
  to:   z.string().min(1, 'to is required (ISO datetime)'),
  timezone:    z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(480).optional(),
})

router.get('/public/partners/:slug/slots', asyncHandler(async (req, res) => {
  const slug = req.params['slug']
  if (!slug) throw new AppError('BAD_REQUEST', 'slug required', 400)
  const parsed = slotsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 422)
  }
  const { from, to, timezone, durationMin } = parsed.data

  const partner = await getBookablePartner(slug)
  if (!partner.integrationConnectionId) {
    // Partner hasn't connected Google — can't reliably check their calendar
    // for conflicts, so we can't safely offer slots.
    throw new AppError('CALENDAR_NOT_CONNECTED', 'Partner has not connected their calendar yet', 409)
  }

  const fromMs = new Date(from).getTime()
  const toMs   = new Date(to).getTime()
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new AppError('VALIDATION_ERROR', 'from and to must be valid ISO datetimes', 422)
  }
  if (toMs - fromMs > 14 * 24 * 60 * 60 * 1000) {
    throw new AppError('VALIDATION_ERROR', 'Range cannot exceed 14 days', 422)
  }

  const effectiveTz       = timezone ?? partner.bookingTimezone ?? partner.user.preferredTimezone ?? 'UTC'
  const effectiveDuration = durationMin ?? partner.bookingSlotDurationMin

  // searchAvailability with partnerId routes through partner prefs (E.3) +
  // partner's calendar (E.2). tenantId here is just the recording target —
  // free/busy reads the partner's calendar, not the tenant's.
  const tenantId = await resolvePartnerBookingTenantId()
  const result = await searchAvailability(
    tenantId,
    {
      preferredStartRange: { from, to },
      timezone:            effectiveTz,
      durationMinutes:     effectiveDuration,
    },
    partner.id,
    // Date picker grid — show ALL open slots, not the agent's curated 5+3 set.
    // A 14-hour business day at 30-min increments = max 28 slots, so 100 is a
    // comfortable ceiling that won't truncate even a long shift.
    { primaryMax: 100, alternateMax: 0 },
  )

  // Flatten primary + alternates so the UI gets every available slot in one
  // pass (caller decides whether to show all of them or curate).
  const slots = [...result.slots, ...result.alternateSlots]
  res.json({ data: { slots, timezone: effectiveTz, durationMin: effectiveDuration } })
}))

// ─── POST /api/public/partners/:slug/bookings ───────────────────────────────
//
// Create a confirmed booking. Body is the slot + the prospect's contact info.
// Lands a Google Calendar event on the partner's calendar (via createAppointment
// with partnerId), creates a Contact + Appointment row under the platform
// tenant, and triggers the standard confirmation emails / reminders.

const bookingBodySchema = z.object({
  name:      z.string().min(1, 'name required').max(120),
  email:     z.string().email('email must be a valid email').max(200),
  phone:     z.string().max(40).optional(),
  startAt:   z.string().min(1, 'startAt required (ISO datetime)'),
  endAt:     z.string().min(1, 'endAt required (ISO datetime)'),
  timezone:  z.string().min(1, 'timezone required'),
  notes:     z.string().max(2000).optional(),
  appointmentType: z.string().max(120).optional(),
})

router.post('/public/partners/:slug/bookings', asyncHandler(async (req, res) => {
  const slug = req.params['slug']
  if (!slug) throw new AppError('BAD_REQUEST', 'slug required', 400)
  const parsed = bookingBodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 422)
  }
  const body = parsed.data

  const partner = await getBookablePartner(slug)
  if (!partner.integrationConnectionId) {
    throw new AppError('CALENDAR_NOT_CONNECTED', 'Partner has not connected their calendar yet', 409)
  }

  const tenantId = await resolvePartnerBookingTenantId()

  // Split the visitor's full name into first/last (cheap heuristic — first
  // token is firstName, the rest is lastName). The createContact helper
  // re-joins them into fullName for display.
  const trimmed = body.name.trim()
  const space   = trimmed.indexOf(' ')
  const firstName = space === -1 ? trimmed         : trimmed.slice(0, space)
  const lastName  = space === -1 ? null            : trimmed.slice(space + 1)

  const contact = await createContact(tenantId, {
    firstName,
    lastName: lastName ?? undefined,
    email:    body.email,
    phoneE164: body.phone || undefined,
    source:   'partner-booking-page',
  })

  // Persist a thin Conversation so the partner-portal mailbox / timeline can
  // surface "Booked via public page" alongside agent-driven bookings.
  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      contactId:   contact.id,
      partnerId:   partner.id,
      channelType: 'WIDGET',         // closest existing enum — represents a web-initiated session
      direction:   'INBOUND',
      status:      'COMPLETED',      // form submitted, nothing else to do on this row
      startedAt:   new Date(),
      endedAt:     new Date(),
    },
  })

  let appointment
  try {
    appointment = await createAppointment(tenantId, null, {
      contactId:       contact.id,
      conversationId:  conversation.id,
      appointmentType: body.appointmentType ?? 'Consultation',
      startAt:         body.startAt,
      endAt:           body.endAt,
      timezone:        body.timezone,
      notes:           body.notes,
      attendeeEmail:   body.email,
      partnerId:       partner.id,
    })
  } catch (err) {
    const e = err as AppError | Error
    if ((e as AppError).code === 'CONFLICT') {
      throw new AppError('SLOT_TAKEN', 'That slot was just taken. Please pick another.', 409)
    }
    throw err
  }

  res.status(201).json({
    data: {
      appointmentId: appointment.id,
      status:        appointment.status,
      startAt:       appointment.startAt,
      endAt:         appointment.endAt,
      timezone:      appointment.timezone,
    },
  })
}))

export { router as publicBookingRouter }
