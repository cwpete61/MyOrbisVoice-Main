import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { getAuthenticatedGoogleClient, sendGmailEmail } from './google.service.js'
import { sendEmail } from './email.service.js'
import { scheduleAppointmentReminders, cancelAppointmentReminders } from './reminder.service.js'
import { resolveBookingIdentity, BOOKING_BRAND } from './booking-identity.service.js'
import { DEMO_PHONE_E164 } from './demo-session.service.js'
import { sendToTenant } from './push.service.js'
import type { Prisma } from '@prisma/client'

/** Push the agent when Orby books a showing. Delivers to every subscribed
 *  device (Web Push today, the native app later reuses the same send). Safe
 *  no-op when push isn't configured. */
async function notifyAgentShowingBooked(
  tenantId: string,
  a: { contactId: string | null; startAt: string; timezone: string; location: string | null },
): Promise<void> {
  const contact = a.contactId
    ? await prisma.contact.findUnique({ where: { id: a.contactId }, select: { firstName: true, lastName: true } })
    : null
  const who = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || 'A buyer'
  let when = a.startAt
  try {
    when = new Date(a.startAt).toLocaleString('en-US', {
      timeZone: a.timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { /* fall back to raw ISO */ }
  await sendToTenant(tenantId, {
    title: 'Showing booked',
    body:  `${who} — ${when}${a.location ? ` · ${a.location}` : ''}. Orby caught it — go close.`,
    url:   '/agents/cockpit',
  })
}

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

// `breakStart` + `breakEnd` define an optional mid-day closed window (lunch /
// staff break). Both must be set or both unset. When set, slots that overlap
// [breakStart, breakEnd) are rejected the same way out-of-window slots are.
type DayHours = { open?: string; close?: string; closed?: boolean; breakStart?: string; breakEnd?: string }
type BusinessHoursMap = Record<string, DayHours>

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function timeOfDayInTz(ms: number, timezone: string): string {
  const s = new Date(ms).toLocaleTimeString('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
    timeZone: timezone,
  })
  // The en-US locale + ICU on the production Node image renders midnight as
  // "24:00" (and 00:30 as "24:30") instead of "00:00" / "00:30". This breaks
  // the hours filter because "24:00" >= "09:00" is true lexicographically, so
  // overnight slots silently pass the working-hours check. Normalize here so
  // the rest of the file always sees 00–23. Same fix the formatSlotForAgent /
  // tzOffsetMinutes helpers already apply on their own '24' branches.
  return s.replace(/^24:/, '00:')
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
// "HH:MM" → minutes since midnight. Returns NaN on malformed input so callers
// can defensively reject. Used by isWithinBusinessHours so day-window checks
// use proper integer math instead of lexicographic string compares (the latter
// silently passed slots that crossed midnight on the same calendar day, e.g.
// a 11:53pm Mon slot whose end at 00:23 Tue would compare as < "17:00").
function hhmmToMinutes(s: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  if (!m) return NaN
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10)
}

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

  // Use minute math so we can correctly detect midnight-wrap slots and
  // out-of-window starts. A slot whose end wraps past midnight gets an end
  // time that's numerically smaller than its start — reject those outright
  // because business hours don't wrap.
  const startMin = hhmmToMinutes(timeOfDayInTz(slotStartMs, timezone))
  const endMin   = hhmmToMinutes(timeOfDayInTz(slotEndMs,   timezone))
  const openMin  = hhmmToMinutes(dayHours.open)
  const closeMin = hhmmToMinutes(dayHours.close)
  if ([startMin, endMin, openMin, closeMin].some(Number.isNaN)) return false
  if (endMin <= startMin) return false                      // midnight wrap
  if (startMin < openMin || endMin > closeMin) return false // out of window

  // Reject slots that overlap the break window [breakStart, breakEnd).
  // Half-open on the right so a slot that ENDS exactly at breakStart is fine,
  // and a slot that STARTS exactly at breakEnd is fine — same convention as
  // the busy-block check above.
  if (dayHours.breakStart && dayHours.breakEnd) {
    const breakStartMin = hhmmToMinutes(dayHours.breakStart)
    const breakEndMin   = hhmmToMinutes(dayHours.breakEnd)
    if (!Number.isNaN(breakStartMin) && !Number.isNaN(breakEndMin)) {
      if (startMin < breakEndMin && endMin > breakStartMin) return false
    }
  }
  return true
}

// Both partner (E.3) and tenant (E.5) store working hours with short day keys:
//   { mon: { open: "09:00", close: "17:00" }, tue: {...}, sun: null }
// The rest of this file (isWithinBusinessHours, etc.) uses full-name keys, so
// this helper normalizes incoming JSON to the BusinessHoursMap shape.
const SHORT_TO_LONG_DAY: Record<string, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
}
function shortHoursToBusinessHoursMap(raw: unknown): BusinessHoursMap | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const out: BusinessHoursMap = {}
  let any = false
  for (const [short, long] of Object.entries(SHORT_TO_LONG_DAY)) {
    if (!(short in src)) continue
    const v = src[short]
    if (v === null) { out[long] = { closed: true }; any = true; continue }
    if (v && typeof v === 'object') {
      const obj = v as { open?: unknown; close?: unknown; breakStart?: unknown; breakEnd?: unknown }
      if (typeof obj.open === 'string' && typeof obj.close === 'string') {
        const next: DayHours = { open: obj.open, close: obj.close }
        // Carry the break window through if both ends are present + well-formed.
        // The sanitizer in partner/tenant.service.ts already validated ordering;
        // here we just trust strings and skip if missing/malformed.
        if (typeof obj.breakStart === 'string' && typeof obj.breakEnd === 'string') {
          next.breakStart = obj.breakStart
          next.breakEnd   = obj.breakEnd
        }
        out[long] = next
        any = true
      }
    }
  }
  return any ? out : null
}

export async function searchAvailability(
  tenantId: string,
  params: SlotSearchParams,
  /** Phase E.2 — when set, free/busy is computed against the partner's
   *  calendar. Phase E.3 — partner's own bookingHoursJson + slot/notice/
   *  advance/buffer prefs are applied here too, overriding tenant defaults. */
  partnerId?: string,
  /** Phase E.6 — when the caller is the public booking page (E.4) instead of
   *  the agent, ask for `all` slots so the date picker can paint a full-day
   *  grid. Default keeps the agent's existing curated "first 5 + 3 alternates"
   *  contract so the voice script doesn't drown the caller in options. */
  opts?: { primaryMax?: number; alternateMax?: number },
): Promise<{ slots: TimeSlot[]; alternateSlots: TimeSlot[] }> {
  const primaryMax   = opts?.primaryMax   ?? 5
  const alternateMax = opts?.alternateMax ?? 3
  // Resolve Google client + target calendar + booking constraints. When
  // partnerId is set, every constraint comes from the partner's row; when
  // not, the tenant's BusinessProfile + caller params drive the search.
  let client
  let calendarTarget: string = 'primary'
  let businessHours: BusinessHoursMap | null = null
  let effectiveDurationMin = params.durationMinutes
  let minNoticeMs = 0
  let maxAdvanceMs = Number.POSITIVE_INFINITY
  let bufferBeforeMs = 0
  let bufferAfterMs  = 0
  let effectiveTimezone = params.timezone

  if (partnerId) {
    const { getAuthenticatedGoogleClientForPartner } = await import('./google.service.js')
    client = await getAuthenticatedGoogleClientForPartner(partnerId)
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      select: {
        calendarId:             true,
        bookingHoursJson:       true,
        bookingSlotDurationMin: true,
        bookingMinNoticeMin:    true,
        bookingMaxAdvanceDays:  true,
        bookingBufferBeforeMin: true,
        bookingBufferAfterMin:  true,
        bookingTimezone:        true,
      },
    })
    calendarTarget        = partner?.calendarId ?? 'primary'
    businessHours         = shortHoursToBusinessHoursMap(partner?.bookingHoursJson)
    // params.durationMinutes is always set by callers, but if a caller passes
    // 0/undefined we fall back to the partner's configured default.
    if (!effectiveDurationMin || effectiveDurationMin <= 0) {
      effectiveDurationMin = partner?.bookingSlotDurationMin ?? 30
    }
    minNoticeMs    = (partner?.bookingMinNoticeMin    ?? 0)  * 60 * 1000
    maxAdvanceMs   = (partner?.bookingMaxAdvanceDays  ?? 60) * 24 * 60 * 60 * 1000
    bufferBeforeMs = (partner?.bookingBufferBeforeMin ?? 0)  * 60 * 1000
    bufferAfterMs  = (partner?.bookingBufferAfterMin  ?? 0)  * 60 * 1000
    if (partner?.bookingTimezone) effectiveTimezone = partner.bookingTimezone
  } else {
    // Phase E.5 — pull working hours + booking prefs first (no calendar needed).
    const profile = await prisma.businessProfile.findUnique({
      where:  { tenantId },
      select: {
        businessHoursJson:      true,
        bookingSlotDurationMin: true,
        bookingMinNoticeMin:    true,
        bookingMaxAdvanceDays:  true,
        bookingBufferBeforeMin: true,
        bookingBufferAfterMin:  true,
      },
    })
    businessHours = shortHoursToBusinessHoursMap(profile?.businessHoursJson)
    if (!effectiveDurationMin || effectiveDurationMin <= 0) {
      effectiveDurationMin = profile?.bookingSlotDurationMin ?? 30
    }
    minNoticeMs    = (profile?.bookingMinNoticeMin    ?? 0)  * 60 * 1000
    maxAdvanceMs   = (profile?.bookingMaxAdvanceDays  ?? 60) * 24 * 60 * 60 * 1000
    bufferBeforeMs = (profile?.bookingBufferBeforeMin ?? 0)  * 60 * 1000
    bufferAfterMs  = (profile?.bookingBufferAfterMin  ?? 0)  * 60 * 1000
    // Calendar is BEST-EFFORT. Demo tenants (never connect Google) and real
    // agents who haven't connected yet get SIMULATED availability — every
    // business-hours slot is offered as free — instead of a hard failure. This
    // is why Orby no longer says "there's a problem with the calendar": with no
    // calendar we just don't have busy blocks to subtract.
    const demoT = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { isDemo: true } })
    if (!demoT?.isDemo) {
      try { client = await getAuthenticatedGoogleClient(tenantId) } catch { client = null }
    }
  }

  const calendar = client ? google.calendar({ version: 'v3', auth: client }) : null

  // Clamp the caller's requested window with min-notice and max-advance so
  // the partner's "no same-minute" / "max 60 days out" rules win even if the
  // agent asks for anything broader.
  const nowMs = Date.now()
  const reqMin = new Date(params.preferredStartRange.from).getTime()
  const reqMax = new Date(params.preferredStartRange.to).getTime()
  const windowStart = Math.max(reqMin, nowMs + minNoticeMs)
  const windowEnd   = Math.min(reqMax, nowMs + maxAdvanceMs)
  const timeMin = new Date(windowStart)
  const timeMax = new Date(windowEnd)

  if (windowEnd <= windowStart) {
    // The partner's notice/advance window excludes the entire requested range.
    return { slots: [], alternateSlots: [] }
  }

  // No calendar → no busy blocks → every in-hours slot is offered as free.
  let busyBlocks: { start: number; end: number }[] = []
  if (calendar) {
    const eventsResp = await calendar.events.list({
      calendarId: calendarTarget,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    busyBlocks = (eventsResp.data.items ?? [])
      .filter(e => e.status !== 'cancelled')
      .map(e => ({
        // Buffers extend each busy block on both sides so the partner gets
        // breathing room between back-to-back appointments.
        start: new Date(e.start?.dateTime ?? e.start?.date ?? '').getTime() - bufferBeforeMs,
        end:   new Date(e.end?.dateTime   ?? e.end?.date   ?? '').getTime() + bufferAfterMs,
      }))
      .filter(b => !Number.isNaN(b.start) && !Number.isNaN(b.end))
  }

  const durationMs  = effectiveDurationMin * 60 * 1000
  const incrementMs = DEFAULT_SLOT_INCREMENT_MINUTES * 60 * 1000

  const slots:          TimeSlot[] = []
  const alternateSlots: TimeSlot[] = []

  let cursor = timeMin.getTime()

  // Snap cursor UP to the next wall-clock increment boundary in the business
  // timezone so pills always read as :00 / :30 etc. Without this, an effective
  // start of 15:53 (now + 60-min notice while it's 14:53) bleeds an offset
  // through every pill on the day. Snap is tz-aware so DST + offset shifts
  // don't drift the grid.
  {
    const wallMinStr = timeOfDayInTz(cursor, effectiveTimezone).split(':')[1] ?? '0'
    const wallMin    = parseInt(wallMinStr, 10)
    const remainder  = wallMin % DEFAULT_SLOT_INCREMENT_MINUTES
    if (remainder !== 0) {
      cursor += (DEFAULT_SLOT_INCREMENT_MINUTES - remainder) * 60 * 1000
    }
    // Also zero out seconds/ms — incoming `now` carries them through which
    // would re-introduce a :MM:SS offset on the pills.
    cursor = cursor - (cursor % 60000)
  }
  while (cursor + durationMs <= timeMax.getTime()) {
    const slotEnd = cursor + durationMs
    const isBusy  = busyBlocks.some(b => cursor < b.end && slotEnd > b.start)
    const inHours = isWithinBusinessHours(cursor, slotEnd, businessHours, effectiveTimezone)

    if (!isBusy && inHours) {
      const slot: TimeSlot = {
        startAt:   new Date(cursor).toISOString(),
        endAt:     new Date(slotEnd).toISOString(),
        available: true,
      }
      if (slots.length < primaryMax) {
        slots.push(slot)
      } else if (alternateSlots.length < alternateMax) {
        alternateSlots.push(slot)
      } else {
        // Both caps hit — short-circuit to avoid scanning the rest of the day
        // for slots we'd just discard. The booking page (E.4) passes a high
        // cap so it gets the full day; the agent path keeps the curated set.
        break
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
  /** Set when the customer ticked the SMS-consent checkbox on the public
   *  booking page — A2P opt-in proof for appointment-reminder texts. */
  smsConsentAt?: Date
}) {
  // Idempotency guard. Gemini Live sometimes emits book_appointment TWICE for
  // the same slot in one session (observed on a real call: two appointment rows
  // + two confirmation emails for one booking). If a live appointment for the
  // same tenant + exact start time + same conversation (or contact) was created
  // in the last 10 minutes, return THAT one instead of booking a duplicate —
  // this short-circuits before the calendar hit and the confirmation email, so
  // the second tool-call is a no-op that echoes the first appointment's id.
  const dedupeOr: Array<Record<string, string>> = []
  if (data.conversationId) dedupeOr.push({ conversationId: data.conversationId })
  if (data.contactId)      dedupeOr.push({ contactId: data.contactId })
  if (dedupeOr.length) {
    const dupe = await prisma.appointment.findFirst({
      where: {
        tenantId,
        startAt:   new Date(data.startAt),
        status:    { notIn: ['CANCELED', 'FAILED'] },
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        OR:        dedupeOr,
      },
      orderBy: { createdAt: 'asc' },
    })
    if (dupe) {
      console.warn(`[appointment] duplicate book_appointment ignored — returning existing ${dupe.id} (tenant=${tenantId}, start=${data.startAt})`)
      return dupe
    }
  }

  // Try the full Google-Calendar-integrated path. When partnerId is set we
  // use the partner's calendar; otherwise the tenant's. Both fall back to
  // PENDING DB-only on Google-unavailable errors — the agent's caller still
  // gets a confirmation email via platform SMTP and a human reconciles.
  // Demo simulation. The demo Orby widget lets a sandbox visitor "book"
  // during a session; we create the DB row + send a confirmation email so
  // Orby can say "check your email for confirmation", but we NEVER touch a
  // real calendar. Gate on isDemo AND no partnerId: partner-page bookings
  // (/book/<slug>) run under the demo tenant too but MUST hit the partner's
  // real calendar, so they are excluded from simulation.
  const tenantDemo = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { isDemo: true },
  })
  const demoSim = !!tenantDemo?.isDemo && !data.partnerId

  let providerEventId: string | undefined
  let status: 'PENDING' | 'CONFIRMED' = 'CONFIRMED'

  // Demo bookings skip the entire Google path (no real calendar hit) and
  // stay CONFIRMED so the sandbox feels real.
  if (!demoSim) try {
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
      smsConsentAt: data.smsConsentAt,
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

  // Push the agent the second Orby books — the moment the app exists for.
  // Fire-and-forget: delivers to any subscribed device (Web Push today; the
  // native app reuses the same send). No-ops safely when push isn't configured.
  void notifyAgentShowingBooked(tenantId, {
    contactId: data.contactId ?? null,
    startAt:   data.startAt,
    timezone:  data.timezone,
    location:  data.location ?? null,
  }).catch((e) => console.warn('[appointment] booking push failed:', (e as Error).message))

  // Best-effort: send a branded confirmation email from the tenant's own
  // Gmail account, separate from Google Calendar's automatic invite. The
  // calendar invite gets the meeting on the contact's calendar; this email
  // is the human-tone touch ("we're looking forward to seeing you").
  if (data.attendeeEmail) {
    sendAppointmentConfirmationEmail(tenantId, {
      to:               data.attendeeEmail,
      contactId:        data.contactId ?? null,
      appointmentType:  data.appointmentType,
      startAt:          data.startAt,
      endAt:            data.endAt,
      timezone:         data.timezone,
      location:         data.location,
      notes:            data.notes,
      partnerId:        data.partnerId ?? null,
      demo:             demoSim,
    }).catch(err => console.warn('[appointment] confirmation email failed:', (err as Error).message))
  }

  // Tenant-owner notification: fires regardless of whether the visitor gave
  // an email. Sends to the tenant's registrationEmail so the owner sees every
  // new booking. Critical for the demo tenant (where Crawford is the owner and
  // needs to know when Orby books a demo on a partner page) and useful for any
  // production tenant that wants a backstop besides the calendar invite.
  // Skipped for demo bookings — the real owner (Crawford) shouldn't be pinged
  // for every sandbox play-booking.
  if (!demoSim) sendTenantOwnerBookingNotification(tenantId, {
    appointmentId:    appointment.id,
    appointmentType:  data.appointmentType,
    startAt:          data.startAt,
    endAt:            data.endAt,
    timezone:         data.timezone,
    attendeeEmail:    data.attendeeEmail,
    contactId:        data.contactId,
    notes:            data.notes,
    status,  // PENDING (no calendar) → "call back to confirm"; CONFIRMED → on calendar
  }).catch(err => console.warn('[appointment] owner notification failed:', (err as Error).message))

  // Phase E.10 — partner-routed bookings also notify the partner directly
  // (gated by AffiliateAccount.notifyAppointmentsEnabled). Different audience
  // from the tenant-owner notification above: the partner doesn't see the
  // OrbisVoice admin tenant inbox, so they need their own ping.
  // Phase F.1 + F.3 — auto-transition the contact to "Booked Appointment".
  // Scope follows the appointment: partner-routed bookings move the partner
  // CRM stage; tenant-side bookings move the tenant CRM stage.
  // Demo bookings DO run this — it's a pure in-DB pipeline stage move (no
  // external side effect), so a sandbox booking shows in the CRM pipeline as
  // well as on the Appointments page, "as if the calendar were connected."
  if (data.contactId) {
    const contactIdResolved = data.contactId
    const scope = data.partnerId
      ? { kind: 'partner' as const, partnerId: data.partnerId, hostingTenantId: tenantId }
      : { kind: 'tenant' as const, tenantId }
    import('./crm.service.js')
      .then(m => m.onAppointmentCreated(scope, contactIdResolved))
      .catch(err => console.warn('[appointment] CRM auto-transition failed:', (err as Error).message))
  }

  if (data.partnerId) {
    sendPartnerBookingNotification(data.partnerId, {
      appointmentId:    appointment.id,
      appointmentType:  data.appointmentType,
      startAt:          data.startAt,
      endAt:            data.endAt,
      timezone:         data.timezone,
      attendeeEmail:    data.attendeeEmail,
      contactId:        data.contactId,
      notes:            data.notes,
    }).catch(err => console.warn('[appointment] partner notification failed:', (err as Error).message))
  }

  // Phase E.6 — schedule reminders. Reads tenant config (offsets + channel
  // toggles) from BusinessProfile; defaults are 24h + 1h before, both
  // channels. Falls back to the legacy campaign-driven path below ONLY if
  // the tenant has an active appointment-scheduled campaign — keeps any
  // existing custom workflows working.
  // Demo bookings schedule no real reminder jobs — the sandbox resets anyway.
  if (data.contactId && !demoSim) {
    const contact = await prisma.contact.findUnique({
      where:  { id: data.contactId },
      select: { email: true, phoneE164: true },
    })
    scheduleAppointmentReminders({
      tenantId,
      appointmentId: appointment.id,
      contactId:     data.contactId,
      startAt:       new Date(data.startAt),
      contactEmail:  contact?.email     ?? null,
      contactPhone:  contact?.phoneE164 ?? null,
    }).catch(err => console.warn('[appointment] reminder scheduling failed:', (err as Error).message))

    // Keep the legacy campaign enrollment path so tenants who built custom
    // campaign flows (e.g. multi-touch reminder series) aren't broken.
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

/** "19294977803" → "(929) 497-7803"; returns null for empty, raw for non-US. */
function formatUsPhone(p: string | null | undefined): string | null {
  if (!p) return null
  const d = p.replace(/\D/g, '')
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : p
}

async function sendAppointmentConfirmationEmail(tenantId: string, opts: {
  to:              string
  /** Contact the booking is for — used to greet the client by name. */
  contactId?:      string | null
  appointmentType?: string
  startAt:         string
  endAt:           string
  timezone:        string
  location?:       string
  notes?:          string
  /** Set for partner-routed bookings — switches the email to the partner's
   *  identity (their name, their Orby agent, MyOrbisVoice brand). */
  partnerId?:      string | null
  /** Demo-sandbox booking — label the email as a simulation and send via
   *  platform SMTP (the demo tenant has no Gmail). */
  demo?:           boolean
}) {
  const identity     = await resolveBookingIdentity(tenantId, opts.partnerId ?? null)
  const businessName = identity.bookingWithName
  const apptLabel    = opts.appointmentType || 'Appointment'
  const start        = new Date(opts.startAt)
  const end          = new Date(opts.endAt)
  const dateStr      = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr      = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const endTimeStr   = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const subject      = `${opts.demo ? '[Demo] ' : ''}${apptLabel} confirmed — ${dateStr}`

  // Best-effort enrichment for a fuller confirmation: greet the client by name,
  // name the human agent + brokerage, and give a tap-to-call agent phone. Each
  // piece renders only when present so real tenants without DNA/phone still get
  // a clean email.
  const [contact, dna] = await Promise.all([
    opts.contactId
      ? prisma.contact.findUnique({ where: { id: opts.contactId }, select: { firstName: true } }).catch(() => null)
      : Promise.resolve(null),
    prisma.businessDNA.findFirst({ where: { tenantId, isActive: true }, select: { identityJson: true } }).catch(() => null),
  ])
  const clientFirst = contact?.firstName?.trim() || ''
  const dnaIdent    = (dna?.identityJson ?? {}) as Record<string, unknown>
  // DNA businessName holds the human agent line, e.g. "John Brown · Austin Realtors".
  const agentLine   = (typeof dnaIdent['businessName'] === 'string' && dnaIdent['businessName'].trim()) || businessName
  const agentFirst  = agentLine.split(/[·,|]/)[0]!.trim() || agentLine

  // Agent phone = the Twilio line the caller reaches the agent on — NOT
  // tenant.publicPhone (which can be a personal/contact number and, in the
  // demo, was actually the caller's own cell). Partner bookings use the
  // partner's own phone; the demo uses the shared demo line; a real tenant
  // uses its assigned Twilio number (prefer the outbound-capable one — that's
  // the number that dials clients).
  let agentPhoneRaw: string | null = identity.contactPhone
  if (!agentPhoneRaw) {
    if (opts.demo) {
      agentPhoneRaw = DEMO_PHONE_E164
    } else {
      const pn = await prisma.phoneNumber.findFirst({
        where:   { tenantId },
        orderBy: [{ isOutboundEnabled: 'desc' }, { isInboundEnabled: 'desc' }, { createdAt: 'asc' }],
        select:  { e164Number: true },
      }).catch(() => null)
      agentPhoneRaw = pn?.e164Number ?? null
    }
  }
  const agentPhone  = formatUsPhone(agentPhoneRaw)
  const agentPhoneTel = agentPhoneRaw ? agentPhoneRaw.replace(/[^\d+]/g, '') : null
  const isShowing   = /showing|tour|open house|property/i.test(`${apptLabel} ${opts.notes ?? ''}`)

  // Footer names the host. Partner bookings additionally credit the partner's
  // Orby agent and the MyOrbisVoice platform so the recipient knows exactly
  // who they booked with and that every follow-up comes from the same place.
  const contactLine = identity.contactEmail || identity.contactPhone
    ? `Need to change something? Contact ${businessName}` +
      (identity.contactEmail ? ` at <a href="mailto:${identity.contactEmail}" style="color:#1a9898">${identity.contactEmail}</a>` : '') +
      (identity.contactPhone ? `${identity.contactEmail ? ' or ' : ' at '}${identity.contactPhone}` : '') + '.'
    : 'Reply to this email if you need to change anything.'
  const footer = identity.isPartner
    ? `<p style="color:#666;font-size:13px;margin:24px 0 4px">Booked by ${identity.agentName}, ${businessName}'s AI assistant.</p>
       <p style="color:#888;font-size:13px;margin:0 0 4px">${contactLine}</p>
       <p style="color:#aaa;font-size:12px;margin:8px 0 0">Powered by ${BOOKING_BRAND}</p>`
    : `<p style="color:#888;font-size:13px;margin:24px 0 0">${contactLine}</p>`

  const demoBanner = opts.demo
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;border-radius:8px;padding:10px 12px;margin:0 0 20px">
         🧪 <strong>Demo confirmation.</strong> This is a simulated booking from a MyOrbisAgents demo — no real appointment was scheduled and nothing was added to a calendar.
       </div>`
    : ''
  const calendarLine = opts.demo
    ? `<p style="color:#666;font-size:14px;margin:0 0 8px">In a live account, this would also land on your Google Calendar automatically.</p>`
    : `<p style="color:#666;font-size:14px;margin:0 0 8px">You'll also see this on your calendar — Google has added it automatically.</p>`
  const row = (label: string, value: string) =>
    `<tr><td style="padding:9px 0;color:#888;width:130px;vertical-align:top;font-size:14px">${label}</td><td style="color:#222;font-size:14px">${value}</td></tr>`

  const rows = [
    opts.location ? row(isShowing ? 'Property' : 'Location', `<strong>${opts.location}</strong>`) : '',
    row('Date', `<strong>${dateStr}</strong>`),
    row('Time', `${timeStr} – ${endTimeStr}`),
    row('Your agent', agentLine),
    agentPhone ? row('Agent phone', agentPhoneTel ? `<a href="tel:${agentPhoneTel}" style="color:#1a9898;text-decoration:none">${agentPhone}</a>` : agentPhone) : '',
    opts.notes ? row('Notes', opts.notes) : '',
  ].filter(Boolean).join('')

  // A short "what happens next" line, tailored for a showing when we can tell.
  const nextStep = isShowing
    ? `<p style="color:#444;font-size:14px;line-height:1.5;margin:0 0 16px">${agentFirst} will meet you at the property at the time above. Please arrive a few minutes early${agentPhone ? `, and call or text ${agentFirst} at <a href="tel:${agentPhoneTel}" style="color:#1a9898;text-decoration:none">${agentPhone}</a> if you're running late or need directions` : ''}.</p>`
    : `<p style="color:#444;font-size:14px;line-height:1.5;margin:0 0 16px">${agentFirst} is looking forward to connecting with you${agentPhone ? `. Reach ${agentFirst} directly at <a href="tel:${agentPhoneTel}" style="color:#1a9898;text-decoration:none">${agentPhone}</a> with any questions` : ''}.</p>`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      ${demoBanner}
      <h2 style="color:#1a9898;margin:0 0 6px">${apptLabel} confirmed${clientFirst ? `, ${clientFirst}` : ''} ✅</h2>
      <p style="color:#555;margin:0 0 20px">You're booked with <strong>${agentLine}</strong>. Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 18px;border-top:1px solid #eee;border-bottom:1px solid #eee">
        ${rows}
      </table>
      ${nextStep}
      ${calendarLine}
      ${footer}
    </div>
  `.trim()

  // Demo bookings send straight via platform SMTP (the demo tenant has no
  // Gmail) with a MyOrbisAgents-branded From, so the sandbox visitor reliably
  // gets the "check your email" confirmation.
  if (opts.demo) {
    // Send from the parent @myorbisresults.com domain — it's verified on Brevo
    // (proper SPF/DKIM, reliably inboxes at Gmail). @myorbisvoice.com has no
    // working hosted provider today: Postmark rejects the unverified From and
    // the Resend key is invalid, so both fall back to local Postfix which Gmail
    // spams. Display name stays "MyOrbisAgents (Demo)" so the caller sees the
    // right brand. Revisit once a valid Resend key / verified myorbisvoice.com
    // sender is in place.
    await sendEmail({
      to:      opts.to,
      subject,
      html,
      from:    `"MyOrbisAgents (Demo)" <notify@myorbisresults.com>`,
    })
    await prisma.messageLog.create({
      data: {
        tenantId,
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
    return
  }

  // Partner-routed bookings send straight via platform SMTP with a partner-
  // branded From display name — the tenant Gmail belongs to the platform demo
  // tenant that merely hosts the row, so sending from it would be misleading.
  if (identity.isPartner) {
    await sendEmail({
      to:        opts.to,
      subject,
      html,
      from:      `"${businessName} via ${BOOKING_BRAND}" <notify@myorbisvoice.com>`,
      partnerId: opts.partnerId ?? null,
    })
    await prisma.messageLog.create({
      data: {
        tenantId,
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
    return
  }

  try {
    await sendGmailEmail(tenantId, { to: opts.to, subject, body: html, isHtml: true })
  } catch (gmailErr) {
    // Fall back to platform SMTP (self-hosted Postfix). Used by any tenant
    // without a Gmail integration. The confirmation still reaches the visitor;
    // we lose only the per-tenant From-address branding.
    await sendEmail({ to: opts.to, subject, html })
    await prisma.messageLog.create({
      data: {
        tenantId,
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

// Demo-only change notice (cancel / reschedule) — a simulated email so the
// sandbox visitor sees a real confirmation land in their inbox. Always via
// platform SMTP with a MyOrbisAgents (Demo) From. Never used in production.
async function sendAppointmentChangeEmailDemo(tenantId: string, opts: {
  to:               string
  appointmentType?: string
  startAt:          string
  timezone:         string
  change:           'canceled' | 'updated'
}) {
  const apptLabel = opts.appointmentType || 'Appointment'
  const start     = new Date(opts.startAt)
  const dateStr   = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr   = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const verb      = opts.change === 'canceled' ? 'canceled' : 'updated'
  const subject   = `[Demo] ${apptLabel} ${verb} — ${dateStr}`
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;border-radius:8px;padding:10px 12px;margin:0 0 20px">
        🧪 <strong>Demo notice.</strong> Simulated change from a MyOrbisAgents demo — no real appointment or calendar was affected.
      </div>
      <h2 style="color:#1a9898;margin:0 0 8px">${apptLabel} ${verb}</h2>
      <p style="color:#555;margin:0 0 20px">Your ${apptLabel.toLowerCase()} for <strong>${dateStr}</strong> at ${timeStr} has been ${verb}.</p>
      <p style="color:#aaa;font-size:12px;margin:8px 0 0">Powered by ${BOOKING_BRAND}</p>
    </div>
  `.trim()
  // @myorbisresults.com → Brevo (the only verified/inboxing path today). See
  // the note in sendAppointmentConfirmationEmail's demo branch.
  await sendEmail({ to: opts.to, subject, html, from: `"MyOrbisAgents (Demo)" <notify@myorbisresults.com>` })
  await prisma.messageLog.create({
    data: {
      tenantId, channel: 'EMAIL', direction: 'OUTBOUND', sender: 'platform-smtp',
      recipient: opts.to, subject, bodyText: html.replace(/<[^>]+>/g, ''),
      deliveryStatus: 'sent', sentAt: new Date(),
    },
  }).catch(() => { /* non-fatal */ })
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
  /** PENDING = calendar not connected, so the time is tentative and the agent
   *  must call the prospect back to confirm. CONFIRMED = it's on the calendar. */
  status?:          'PENDING' | 'CONFIRMED'
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

  // When there's no connected calendar the booking is PENDING — Orby captured
  // the request but it is NOT on a calendar, so the agent must confirm.
  const needsConfirm = opts.status === 'PENDING'
  const confirmBanner = needsConfirm
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:14px;border-radius:8px;padding:12px 14px;margin:0 0 20px">
         ⚠ <strong>Action needed — call the prospect back to confirm.</strong> Your Google Calendar isn't connected, so this time is a request, not a locked slot. Reach out${attendeePhone ? ` at ${attendeePhone}` : ''}${opts.attendeeEmail ? ` or ${opts.attendeeEmail}` : ''} to confirm, then add it to your calendar. (Connect your calendar in Integrations to book these automatically.)
       </div>`
    : ''
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <h2 style="color:#1a9898;margin:0 0 8px">${needsConfirm ? 'Showing requested' : 'New booking'} on ${tenant.displayName ?? 'your account'}</h2>
      ${confirmBanner}
      <p style="color:#555;margin:0 0 20px">${needsConfirm ? 'Orby collected a showing request through the agent.' : 'An appointment was just booked through the agent.'}</p>
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

/**
 * Phase E.10 — partner-routed bookings notify the partner directly. Gated by
 * AffiliateAccount.notifyAppointmentsEnabled (true by default; partners opt
 * out via /partner-portal/profile). Sent to the partner's User.email (their
 * personal inbox where they actually read mail — not the slug@myorbisresults
 * forwarding alias). Uses platform SMTP since the partner has no tenant.
 */
async function sendPartnerBookingNotification(partnerId: string, opts: {
  appointmentId:    string
  appointmentType?: string
  startAt:          string
  endAt:            string
  timezone:         string
  attendeeEmail?:   string
  contactId?:       string
  notes?:           string
}) {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: {
      notifyAppointmentsEnabled: true,
      displayName:               true,
      user:                      { select: { email: true, firstName: true } },
    },
  })
  if (!partner) return
  if (!partner.notifyAppointmentsEnabled) return
  if (!partner.user.email) return

  let attendeeName: string | null = null
  let attendeePhone: string | null = null
  if (opts.contactId) {
    const c = await prisma.contact.findUnique({
      where:  { id: opts.contactId },
      select: { fullName: true, firstName: true, lastName: true, phoneE164: true },
    })
    attendeeName  = c?.fullName ?? ([c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || null)
    attendeePhone = c?.phoneE164 ?? null
  }

  const start    = new Date(opts.startAt)
  const dateStr  = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: opts.timezone })
  const timeStr  = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone, timeZoneName: 'short' })
  const apptLabel = opts.appointmentType || 'Appointment'
  const greeting  = partner.user.firstName ? `Hi ${partner.user.firstName},` : 'Hi,'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <h2 style="color:#1a9898;margin:0 0 8px">New booking on your calendar</h2>
      <p style="color:#555;margin:0 0 20px">${greeting} Orby just booked an appointment on your landing page.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:8px 0;color:#888;width:120px;vertical-align:top">Type</td><td style="color:#222"><strong>${apptLabel}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#888;vertical-align:top">When</td><td style="color:#222"><strong>${dateStr}</strong><br>${timeStr}</td></tr>
        ${attendeeName  ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Name</td><td style="color:#222">${attendeeName}</td></tr>` : ''}
        ${opts.attendeeEmail ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Email</td><td style="color:#222">${opts.attendeeEmail}</td></tr>` : ''}
        ${attendeePhone ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Phone</td><td style="color:#222">${attendeePhone}</td></tr>` : ''}
        ${opts.notes    ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top">Notes</td><td style="color:#222">${opts.notes}</td></tr>` : ''}
      </table>
      <p style="color:#666;font-size:14px;margin:0 0 8px">It's already on your Google Calendar. Open <a href="https://app.myorbisvoice.com/partner-portal/calendar" style="color:#1a9898">your partner portal calendar</a> to see everything in one view.</p>
      <p style="color:#888;font-size:12px;margin:24px 0 0">Want to turn these emails off? Go to <a href="https://app.myorbisvoice.com/partner-portal/profile" style="color:#1a9898">Profile → Notifications</a>.</p>
    </div>
  `.trim()

  await sendEmail({
    to:      partner.user.email,
    subject: `New booking: ${apptLabel} — ${dateStr}`,
    html,
  })

  // MessageLog skipped here — that table is tenant-scoped (tenantId NOT NULL)
  // and partner notifications don't have a tenant context. AuditLog covers
  // the platform-side observability we need.
  await writeAuditLog({
    actorType:    'SYSTEM',
    action:       'partner.booking_notification.sent',
    targetType:   'AffiliateAccount',
    targetId:     partnerId,
    metadataJson: { appointmentId: opts.appointmentId, recipientEmail: partner.user.email },
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

  // Phase E.6 — re-schedule reminders against the new startAt. The upsert in
  // scheduleAppointmentReminders resets status=PENDING + sentAt=null on rows
  // that match the (appointmentId, channel, offsetMin) unique key, so any
  // 24h reminder that already fired for the OLD date will re-fire for the
  // NEW date if it's still in the future. Skip silently when there's no
  // contact attached (e.g. ad-hoc admin-created appointments).
  if (appt.contactId) {
    const contact = await prisma.contact.findUnique({
      where:  { id: appt.contactId },
      select: { email: true, phoneE164: true },
    })
    scheduleAppointmentReminders({
      tenantId,
      appointmentId: appointmentId,
      contactId:     appt.contactId,
      startAt:       new Date(data.startAt),
      contactEmail:  contact?.email     ?? null,
      contactPhone:  contact?.phoneE164 ?? null,
    }).catch(err => console.warn('[appointment] reschedule reminder update failed:', (err as Error).message))
  }

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

  // Demo simulation — send a labeled "cancellation confirmed" email so a
  // sandbox visitor who cancels during the demo can be told "check your email".
  // No calendar was ever touched (demo rows have no providerEventId).
  const tenantDemo = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { isDemo: true },
  })
  if (tenantDemo?.isDemo && appt.contactId) {
    prisma.contact.findUnique({ where: { id: appt.contactId }, select: { email: true } })
      .then(c => {
        if (c?.email) return sendAppointmentChangeEmailDemo(tenantId, {
          to:              c.email,
          appointmentType: appt.appointmentType ?? undefined,
          startAt:         appt.startAt.toISOString(),
          timezone:        appt.timezone,
          change:          'canceled',
        })
      })
      .catch(err => console.warn('[appointment] demo cancel email failed:', (err as Error).message))
  }

  // Phase E.6 — cancel any pending reminders so we don't text the customer
  // "your appointment is tomorrow!" after they already cancelled. Best-effort:
  // a stale reminder firing is embarrassing but recoverable, so failures don't
  // block the cancel response.
  cancelAppointmentReminders(appointmentId).catch(err =>
    console.warn('[appointment] reminder cancel failed:', (err as Error).message),
  )

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
    prisma.appointment.findMany({
      where, take: limit, skip: offset, orderBy: { startAt: 'desc' },
      // Phase E.6 — include a compact reminder summary so the appointments
      // list can show "2 pending / 0 sent / 0 failed" without a second
      // round-trip. Reminders are bounded (≤8 per appointment) so this is cheap.
      include: { reminders: { select: { status: true, scheduledAt: true, channel: true } } },
    }),
    prisma.appointment.count({ where }),
  ])

  // Flatten reminders into a small summary per appointment. The raw reminders
  // array is dropped from the response to keep the wire format tight.
  const enriched = appointments.map(appt => {
    const r = appt.reminders
    const pending = r.filter(x => x.status === 'PENDING').length
    const sent    = r.filter(x => x.status === 'SENT').length
    const failed  = r.filter(x => x.status === 'FAILED').length
    const cancelled = r.filter(x => x.status === 'CANCELLED').length
    // Soonest pending row (the next one that will actually fire).
    const nextPending = r
      .filter(x => x.status === 'PENDING')
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0]
    const { reminders: _drop, ...rest } = appt
    return {
      ...rest,
      reminderSummary: {
        pending, sent, failed, cancelled,
        nextScheduledAt: nextPending?.scheduledAt.toISOString() ?? null,
        nextChannel:     nextPending?.channel ?? null,
      },
    }
  })

  return { appointments: enriched, total, limit, offset }
}
