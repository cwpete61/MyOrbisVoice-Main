import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../lib/async-handler.js'
import { AppError } from '@voiceautomation/shared'
import { getConfigValue } from '../services/system-config.service.js'
import { searchAvailability, createAppointment } from '../services/appointment.service.js'
import { createContact } from '../services/contact.service.js'
import { attributeBooking } from '../services/cold-email-campaign.service.js'
import { DEMO_PHONE_E164 } from '../services/demo-session.service.js'
import { createAgentDemoClaimSession } from '../services/agent-demo.service.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'

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
      bookingBufferBeforeMin: true,
      bookingBufferAfterMin:  true,
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

  // Surface per-day hours + break windows so the customer-facing page can
  // mirror the partner's booking-preferences settings (open/close + lunch).
  // `openDays` stays as a derived boolean map for the grid renderer.
  const rawHours = (partner.bookingHoursJson as Record<string, unknown> | null) ?? null
  const hours: Record<string, { open: string; close: string; breakStart?: string; breakEnd?: string } | null> = {}
  const openDays: Record<string, boolean> = {}
  for (const day of SHORT_DAYS) {
    const v = rawHours?.[day]
    if (v && typeof v === 'object') {
      const o = v as { open?: unknown; close?: unknown; breakStart?: unknown; breakEnd?: unknown }
      if (typeof o.open === 'string' && typeof o.close === 'string') {
        const cell: { open: string; close: string; breakStart?: string; breakEnd?: string } = {
          open:  o.open,
          close: o.close,
        }
        if (typeof o.breakStart === 'string' && typeof o.breakEnd === 'string') {
          cell.breakStart = o.breakStart
          cell.breakEnd   = o.breakEnd
        }
        hours[day]    = cell
        openDays[day] = true
        continue
      }
    }
    hours[day]    = null
    openDays[day] = false
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
      bufferBeforeMin: partner.bookingBufferBeforeMin,
      bufferAfterMin:  partner.bookingBufferAfterMin,
      timezone:        partner.bookingTimezone ?? partner.user.preferredTimezone ?? null,
      openDays,
      hours,
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
  smsConsent: z.boolean().optional(),
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
      smsConsentAt:    body.smsConsent ? new Date() : undefined,
    })
  } catch (err) {
    const e = err as AppError | Error
    if ((e as AppError).code === 'CONFLICT') {
      throw new AppError('SLOT_TAKEN', 'That slot was just taken. Please pick another.', 409)
    }
    throw err
  }

  // Bulk Email Phase 5 — if this prospect is a cold-email campaign lead,
  // mark them BOOKED (closes the funnel + stops their sequence). Best-effort:
  // a funnel-attribution failure must never fail a real booking.
  try {
    await attributeBooking(partner.id, body.email)
  } catch (err) {
    console.error('[public-booking] campaign attribution failed:', err)
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

// ─── GET /api/public/agent-demo/:slug ───────────────────────────────────────
// Public data for a MyOrbisAgents custom-demo microsite (/demo/<slug>). No auth
// — the agent opens it from their email. Returns the agent's widget publicKey
// (to embed live Orby), their enriched listings, and the shared call line + PIN.
router.get('/public/agent-demo/:slug', asyncHandler(async (req, res) => {
  const demo = await prisma.agentDemo.findUnique({ where: { micrositeSlug: req.params['slug']! } })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  if (demo.expiresAt && demo.expiresAt.getTime() < Date.now()) {
    throw new AppError('GONE', 'This demo link has expired', 410)
  }
  // Once the demo is claimed the tenant converts in place into a real (paying)
  // account and starts handling real customer calls. Stop serving the public
  // microsite so the slug can't be used to read a live tenant's data.
  if (demo.status === 'CLAIMED') throw new AppError('GONE', 'This demo has been activated', 410)
  const [widget, listings] = await Promise.all([
    prisma.channelConfig.findFirst({
      where:  { tenantId: demo.tenantId, channelType: 'WIDGET' },
      select: { publicKey: true },
    }),
    prisma.listing.findMany({
      where:   { tenantId: demo.tenantId },
      orderBy: { createdAt: 'asc' },
      select:  { id: true, address: true, headline: true, priceUsd: true, beds: true, baths: true,
                 sqft: true, propertyType: true, description: true, highlights: true },
    }),
  ])
  res.json({
    data: {
      agentName:       demo.agentName,
      brokerage:       demo.brokerage,
      market:          demo.market,
      widgetPublicKey: widget?.publicKey ?? '',
      demoPhone:       DEMO_PHONE_E164,
      pin:             demo.pin,
      recommendedTier: demo.recommendedTier,
      status:          demo.status,
      listings,
    },
  })
}))

// ─── GET /api/public/agent-demo/:slug/activity ──────────────────────────────
// No-login feed of what Orby did on the agent's demo tenant: the calls it
// handled, and the showings it booked. The microsite polls this so the agent
// calls Orby and watches their own results appear — no password needed.
router.get('/public/agent-demo/:slug/activity', asyncHandler(async (req, res) => {
  const demo = await prisma.agentDemo.findUnique({
    where: { micrositeSlug: req.params['slug']! },
    select: { tenantId: true, expiresAt: true, status: true, tenant: { select: { isDemo: true } } },
  })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  if (demo.expiresAt && demo.expiresAt.getTime() < Date.now()) throw new AppError('GONE', 'This demo link has expired', 410)
  // Never serve activity for a claimed demo / a tenant that is no longer a demo —
  // it would leak a live paying tenant's real customer PII to anyone with the slug.
  if (demo.status === 'CLAIMED' || demo.tenant?.isDemo === false) {
    throw new AppError('GONE', 'This demo has been activated', 410)
  }
  const tenantId = demo.tenantId

  const [calls, appts] = await Promise.all([
    prisma.conversation.findMany({
      where: { tenantId }, orderBy: { startedAt: 'desc' }, take: 8,
      select: { id: true, startedAt: true, endedAt: true, summaryText: true, contactId: true, recordingRef: true, recordingBunnyPath: true },
    }),
    prisma.appointment.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 8,
      select: { id: true, startAt: true, appointmentType: true, status: true, contact: { select: { firstName: true, lastName: true } } },
    }),
  ])
  const cids = [...new Set(calls.map((c) => c.contactId).filter(Boolean))] as string[]
  const contacts = cids.length
    ? await prisma.contact.findMany({ where: { id: { in: cids } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const nameById = new Map(contacts.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ')]))
  const nm = (o?: { firstName: string | null; lastName: string | null } | null) => [o?.firstName, o?.lastName].filter(Boolean).join(' ')

  res.json({
    data: {
      calls: calls.map((c) => ({
        id: c.id, at: c.startedAt,
        durationSec: c.endedAt ? Math.round((c.endedAt.getTime() - c.startedAt.getTime()) / 1000) : null,
        summary: c.summaryText || null,
        who: (c.contactId && nameById.get(c.contactId)) || null,
        recordingUrl: (c.recordingRef || c.recordingBunnyPath)
          ? `/api/public/agent-demo/${req.params['slug']}/recording/${c.id}`
          : null,
      })),
      bookings: appts.map((a) => ({ id: a.id, at: a.startAt, type: a.appointmentType, status: a.status, who: nm(a.contact) || null })),
    },
  })
}))

// ─── GET /api/public/agent-demo/:slug/recording/:conversationId ─────────────
// No-login playback of a demo call's recording for the microsite audio player.
// Same guard as /activity (not expired, not claimed, still a demo) + verifies
// the conversation belongs to THIS demo's tenant, then proxies from Bunny.
router.get('/public/agent-demo/:slug/recording/:conversationId', asyncHandler(async (req, res) => {
  const demo = await prisma.agentDemo.findUnique({
    where: { micrositeSlug: req.params['slug']! },
    select: { tenantId: true, expiresAt: true, status: true, tenant: { select: { isDemo: true } } },
  })
  if (!demo) throw new AppError('NOT_FOUND', 'Demo not found', 404)
  if (demo.expiresAt && demo.expiresAt.getTime() < Date.now()) throw new AppError('GONE', 'This demo link has expired', 410)
  if (demo.status === 'CLAIMED' || demo.tenant?.isDemo === false) throw new AppError('GONE', 'This demo has been activated', 410)

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params['conversationId']!, tenantId: demo.tenantId },
    select: { recordingBunnyPath: true, recordingRef: true },
  })
  if (!conv?.recordingRef && !conv?.recordingBunnyPath) { res.status(404).json({ error: 'No recording available' }); return }

  if (conv.recordingBunnyPath) {
    const config = await getBunnyConfig()
    if (config) {
      const host = storageHostForRegion(config.storageRegion)
      const upstream = await fetch(`https://${host}/${config.storageZone}/${conv.recordingBunnyPath}`, {
        headers: { AccessKey: config.storagePassword },
      })
      if (!upstream.ok) { res.status(404).json({ error: 'Recording file not found' }); return }
      res.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'audio/mpeg')
      const cl = upstream.headers.get('Content-Length'); if (cl) res.setHeader('Content-Length', cl)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const { Readable } = await import('stream')
      Readable.fromWeb(upstream.body as any).pipe(res)
      return
    }
  }
  if (conv.recordingRef) { res.redirect(302, conv.recordingRef); return }
  res.status(404).json({ error: 'No recording available' })
}))

// ─── GET /api/public/agent-demo/:slug/claim ─────────────────────────────────
// The microsite "Get Orby" CTA. Builds the promo Checkout Session (plan + $250
// setup + 50%-off-12mo coupon) and 303-redirects the agent straight to Stripe.
// ?tier=297|497 overrides the scorer default.
router.get('/public/agent-demo/:slug/claim', asyncHandler(async (req, res) => {
  const tq = req.query['tier']
  const tier = tq === '497' ? '497' : tq === '297' ? '297' : undefined
  const { url } = await createAgentDemoClaimSession(req.params['slug']!, tier)
  res.redirect(303, url)
}))

export { router as publicBookingRouter }
