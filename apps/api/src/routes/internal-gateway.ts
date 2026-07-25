import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'
import * as appointmentService from '../services/appointment.service.js'
import * as googleService from '../services/google.service.js'
import * as contactService from '../services/contact.service.js'
import { storeGatewayRecording } from '../services/recording.service.js'
import { sendEmail } from '../services/email.service.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'

/** Escape user/agent-authored text before embedding it in the fallback HTML email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Internal gateway routes — only callable by the voice-gateway service.
 * The gateway invokes these to fulfill Gemini Live tool calls during a live
 * voice session. Auth is a shared secret in the `x-internal-gateway-token`
 * header (configured via GATEWAY_INTERNAL_TOKEN env var). The tenantId comes
 * from the `x-internal-tenant-id` header — the gateway resolves the tenant
 * at session start (from the Twilio number or widget session token), so by
 * the time a tool call fires, the gateway is the authority on which tenant
 * is acting.
 *
 * These endpoints are NOT mounted under the standard auth/RBAC middleware
 * stack — they have their own internal-token middleware below. They are
 * mounted under /api/internal/gateway/* so they are easy to firewall at the
 * edge if we later need to (e.g. only allow from the gateway's IP).
 */

const router: IRouter = Router()

// ---------- middleware ----------

function internalGatewayAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env['GATEWAY_INTERNAL_TOKEN']
  const provided = req.headers['x-internal-gateway-token']

  if (!expected || expected.length < 16) {
    next(new AppError('UNAUTHORIZED', 'Internal gateway token not configured', 401))
    return
  }
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    next(new AppError('UNAUTHORIZED', 'Invalid internal gateway token', 401))
    return
  }
  // constant-time compare to avoid timing oracles
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    next(new AppError('UNAUTHORIZED', 'Invalid internal gateway token', 401))
    return
  }

  const tenantHeader = req.headers['x-internal-tenant-id']
  if (typeof tenantHeader !== 'string' || tenantHeader.length < 8) {
    next(new AppError('VALIDATION_ERROR', 'Missing x-internal-tenant-id header', 422))
    return
  }
  ;(req as any).internalTenantId = tenantHeader
  next()
}

router.use('/internal/gateway', internalGatewayAuth)

// ---------- helpers ----------

// Look up a contact by raw query — phone (normalized to E.164 if possible),
// email substring, or name substring. Used by the agent to find the caller's
// existing record before booking or sending follow-ups.
async function findContact(tenantId: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return null

  // Normalize phone-ish input
  const digitsOnly = trimmed.replace(/[^\d+]/g, '')
  const looksPhone = /^\+?\d{7,}$/.test(digitsOnly)
  if (looksPhone) {
    const e164 = digitsOnly.startsWith('+')
      ? digitsOnly
      : digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`
    const byPhone = await prisma.contact.findFirst({ where: { tenantId, phoneE164: e164 } })
    if (byPhone) return byPhone
  }

  // Email — exact match preferred
  if (trimmed.includes('@')) {
    const byEmail = await prisma.contact.findFirst({
      where: { tenantId, email: { equals: trimmed, mode: 'insensitive' } },
    })
    if (byEmail) return byEmail
  }

  // Fallback — fuzzy across name + email + phone
  return prisma.contact.findFirst({
    where: {
      tenantId,
      OR: [
        { fullName:  { contains: trimmed, mode: 'insensitive' } },
        { firstName: { contains: trimmed, mode: 'insensitive' } },
        { lastName:  { contains: trimmed, mode: 'insensitive' } },
        { email:     { contains: trimmed, mode: 'insensitive' } },
        { phoneE164: { contains: digitsOnly } },
      ],
    },
  })
}

/**
 * Resolves the call's Conversation id + partnerId from whichever identifier
 * the gateway supplied. Widget sessions pass `conversationId`; inbound /
 * outbound phone calls pass `externalCallId` (the Twilio CallSid). Without
 * resolving via externalCallId, partner-scoped tool ops (booking, contact
 * capture, availability) silently fell back to tenant scope on every phone
 * call to a partner's number.
 */
async function resolveGatewayCallContext(
  tenantId: string,
  ids: { conversationId?: string | null; externalCallId?: string | null },
): Promise<{ conversationId: string | undefined; partnerId: string | undefined }> {
  let conv: { id: string; partnerId: string | null } | null = null
  if (ids.conversationId) {
    conv = await prisma.conversation.findFirst({
      where:  { id: ids.conversationId, tenantId },
      select: { id: true, partnerId: true },
    })
  }
  if (!conv && ids.externalCallId) {
    conv = await prisma.conversation.findFirst({
      where:  { externalCallId: ids.externalCallId, tenantId },
      select: { id: true, partnerId: true },
    })
  }
  return { conversationId: conv?.id, partnerId: conv?.partnerId ?? undefined }
}

// ---------- tool: lookup_contact ----------

const lookupSchema = z.object({
  query: z.string().min(1).max(200),
})

router.post('/internal/gateway/tools/lookup-contact', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const { query } = lookupSchema.parse(req.body)
    const contact = await findContact(tenantId, query)
    if (!contact) {
      res.json({ data: { found: false } })
      return
    }
    // Phase E.7 — return prior interactions + CRM facts alongside the match
    // so the agent has cross-session memory the moment it identifies the
    // caller mid-conversation (widget flow). Inbound/outbound paths inject
    // the same data earlier via the system prompt.
    const { getContactHistory, formatContactHistoryForPrompt } = await import('../services/contact-history.service.js')
    const history = await getContactHistory(tenantId, contact.id)
    const historyPrompt = formatContactHistoryForPrompt(history)
    res.json({
      data: {
        found: true,
        contact: {
          id:        contact.id,
          fullName:  contact.fullName,
          firstName: contact.firstName,
          lastName:  contact.lastName,
          email:     contact.email,
          phoneE164: contact.phoneE164,
        },
        history:       history ?? null,         // structured (for callers that want fields)
        historyPrompt: historyPrompt ?? null,   // formatted block for direct prompt injection
      },
    })
  } catch (err) { next(err) }
})

// ---------- tool: save_contact ----------

// Upsert a contact captured live during a call. The agent collects full name,
// phone, and email from every caller, then calls this tool. Match by phone
// first (more reliable than email for inbound calls), then email. If neither
// matches, create. Existing fields are not overwritten with empty values —
// missing fields fill in, non-empty fields are preserved unless the agent
// passed a different non-empty value.
//
// The `agentConfirmedAt` timestamp is always bumped — this is the signal
// downstream campaigns (and the contacts page) use to know this contact was
// verified by a live human voice, not scraped.
const saveContactSchema = z.object({
  fullName:       z.string().max(200).optional(),
  phoneE164:      z.string().max(40).optional(),
  email:          z.string().email().max(200).optional(),
  notes:          z.string().max(2000).optional(),
  conversationId: z.string().uuid().optional(),
  externalCallId: z.string().min(1).max(120).optional(),
}).refine(d => Boolean(d.phoneE164 || d.email), {
  message: 'Provide phoneE164 or email (or both — both is preferred)',
})

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  if (!/^\+?\d{7,}$/.test(digits)) return null
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  return `+${digits}`
}

router.post('/internal/gateway/tools/save-contact', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = saveContactSchema.parse(req.body)

    const phoneE164 = data.phoneE164 ? normalizePhone(data.phoneE164) ?? data.phoneE164 : null
    const email     = data.email?.trim().toLowerCase() ?? null

    // F.3 — figure out whether this is a tenant-side or partner-side capture
    // before we match-or-create. Partner is read from Conversation.partnerId
    // when the gateway passed conversationId. Matching scope follows: partner
    // contacts only match against the partner's pool; tenant contacts only
    // match against tenant-side rows. Prevents cross-leak.
    const { partnerId } = await resolveGatewayCallContext(tenantId, data)
    const scopeWhere = partnerId
      ? { partnerId }
      : { tenantId, partnerId: null }

    // Match by phone first, then email — within the same scope
    let existing = phoneE164
      ? await prisma.contact.findFirst({ where: { ...scopeWhere, phoneE164 } })
      : null
    if (!existing && email) {
      existing = await prisma.contact.findFirst({
        where: { ...scopeWhere, email: { equals: email, mode: 'insensitive' } },
      })
    }

    const now = new Date()
    let contact
    let created = false

    if (existing) {
      // Update only fields the caller verified that were missing or different.
      // Never overwrite a non-empty existing value with empty.
      const update: Record<string, unknown> = { agentConfirmedAt: now, updatedAt: now }
      if (data.fullName && data.fullName !== existing.fullName) update['fullName'] = data.fullName
      if (phoneE164    && phoneE164    !== existing.phoneE164)  update['phoneE164'] = phoneE164
      if (email        && email        !== existing.email)      update['email'] = email
      if (data.notes) {
        const meta = (existing.metadataJson as Record<string, unknown> | null) ?? {}
        const calls = Array.isArray(meta['callNotes']) ? (meta['callNotes'] as unknown[]) : []
        update['metadataJson'] = { ...meta, callNotes: [...calls, { at: now.toISOString(), notes: data.notes }] }
      }
      contact = await prisma.contact.update({ where: { id: existing.id }, data: update })
    } else if (partnerId) {
      // Partner-side new contact — skip contactService (which goes tenant-CRM
      // pipeline placement) and create directly, then place on partner CRM.
      contact = await prisma.contact.create({
        data: {
          tenantId,
          partnerId,
          fullName:        data.fullName ?? null,
          phoneE164:       phoneE164 ?? null,
          email:           email ?? null,
          source:          'voice_agent',
          emailStatus:     email ? 'unchecked' : null,
          phoneStatus:     phoneE164 ? 'unchecked' : null,
          agentConfirmedAt: now,
          ...(data.notes ? { metadataJson: { callNotes: [{ at: now.toISOString(), notes: data.notes }] } } : {}),
        },
      })
      const { placeNewContactOnPipeline } = await import('../services/crm.service.js')
      await placeNewContactOnPipeline({ kind: 'partner', partnerId, hostingTenantId: tenantId }, contact.id)
        .catch(() => null)
      created = true
    } else {
      // Tenant-side: go through the service so pipeline placement (F.1) +
      // email verification kick off automatically.
      contact = await contactService.createContact(tenantId, {
        fullName:  data.fullName ?? undefined,
        phoneE164: phoneE164      ?? undefined,
        email:     email           ?? undefined,
        source:    'voice_agent',
      })
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data:  {
          agentConfirmedAt: now,
          ...(data.notes ? { metadataJson: { callNotes: [{ at: now.toISOString(), notes: data.notes }] } } : {}),
        },
      })
      created = true
    }

    // Phase F.2 + F.3 — agent-collected notes show up in the CRM notes thread.
    // partnerId on the note matches the contact's partnerId so partner CRMs see
    // it in their note feed.
    if (data.notes && (created || existing)) {
      await prisma.contactNote.create({
        data: {
          tenantId,
          partnerId,
          contactId:    contact.id,
          authorUserId: null,
          body:         data.notes.slice(0, 4000),
        },
      }).catch(() => { /* non-fatal — note thread is nice-to-have */ })
    }

    // F.2 — link the live Conversation row to the contact so the timeline can
    // pull conversations by contactId AND fireCrmTransition on persistConversation
    // sees the link and bumps the pipeline stage on call-end.
    if (data.conversationId) {
      await prisma.conversation.updateMany({
        where: { id: data.conversationId, tenantId, contactId: null },
        data:  { contactId: contact.id },
      }).catch(() => null)
    }

    await writeAuditLog({
      tenantId,
      actorType:  'SYSTEM',
      action:     created ? 'gateway.tool.save_contact.created' : 'gateway.tool.save_contact.updated',
      targetType: 'Contact',
      targetId:   contact.id,
      metadataJson: {
        fullName:  contact.fullName,
        phoneE164: contact.phoneE164,
        email:     contact.email,
      },
    })

    // Marketing capture: when a caller tries the public DEMO and gives their
    // details, mirror them to the durable DemoLead list so they survive the
    // 15-min demo reset (which wipes the demo tenant's Contact rows). Only for
    // demo tenants, tenant-side (partner captures already persist to the
    // partner's real CRM). Deduped per conversation. Non-fatal.
    if (!partnerId && (contact.email || contact.phoneE164)) {
      const demoTenant = await prisma.tenant.findUnique({
        where: { id: tenantId }, select: { isDemo: true },
      })
      if (demoTenant?.isDemo) {
        try {
          const existingLead = data.conversationId
            ? await prisma.demoLead.findFirst({ where: { conversationId: data.conversationId } })
            : null
          if (existingLead) {
            await prisma.demoLead.update({
              where: { id: existingLead.id },
              data: {
                fullName:  contact.fullName ?? existingLead.fullName,
                email:     contact.email    ?? existingLead.email,
                phoneE164: contact.phoneE164 ?? existingLead.phoneE164,
                notes:     data.notes        ?? existingLead.notes,
              },
            })
          } else {
            await prisma.demoLead.create({
              data: {
                fullName:         contact.fullName,
                email:            contact.email,
                phoneE164:        contact.phoneE164,
                notes:            data.notes ?? null,
                source:           'demo_widget',
                capturedTenantId: tenantId,
                conversationId:   data.conversationId ?? null,
              },
            })
          }
        } catch { /* non-fatal — demo lead capture is best-effort */ }
      }
    }

    res.json({
      data: {
        ok:        true,
        contactId: contact.id,
        created,
        fullName:  contact.fullName,
        phoneE164: contact.phoneE164,
        email:     contact.email,
      },
    })
  } catch (err) { next(err) }
})

// ---------- tool: book_appointment ----------

// startsAtIso accepts any of:
//   - UTC with Z suffix         (2026-05-04T13:30:00Z)
//   - UTC offset                (2026-05-04T09:30:00-04:00)
//   - Naive datetime            (2026-05-04T09:30:00)  → interpreted in the
//                                tenant's timezone arg or America/New_York fallback
// Zod's strict .datetime() rejected offset and naive forms, breaking real
// bookings. The handler normalizes after parse.
const bookSchema = z.object({
  startsAtIso:     z.string().min(10).max(40)
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid datetime'),
  durationMinutes: z.number().int().min(5).max(480),
  contactQuery:    z.string().min(1).max(200),
  notes:           z.string().max(2000).optional(),
  appointmentType: z.string().max(120).optional(),
  location:        z.string().max(300).optional(),
  timezone:        z.string().max(80).optional(),
  conversationId:  z.string().uuid().optional(),
  externalCallId:  z.string().min(1).max(120).optional(),
})

// ---------- tool: search_availability ----------
//
// Returns up to 5 open slots in the requested window, plus up to 3
// alternates if the primary 5 are too few for the agent to offer.
// Backed by the same searchAvailability service the tenant-side
// /api/appointments/availability/search endpoint uses, so the slot
// math is identical (Google Calendar busy-blocks → free slots).

const availabilitySchema = z.object({
  fromIso:           z.string().min(1),
  toIso:             z.string().min(1),
  durationMinutes:   z.number().int().min(5).max(480),
  timezone:          z.string().min(1).optional(),
  // Phase E.2 — when set, the handler looks up the conversation's partnerId
  // and runs free/busy against the partner's calendar instead of the tenant's.
  conversationId:    z.string().uuid().optional(),
  externalCallId:    z.string().min(1).max(120).optional(),
})

// Slow tools (availability/booking) hit Google Calendar, which has no timeout of
// its own — a Google stall used to hang the whole call until the gateway's 30s
// silence watchdog fired ("are you still there?"). Cap the Google-backed work
// here so the tool always returns FAST with a spoken message. Budget:
// API (this) 6-7s < gateway abort 8s < silence watchdog 30s.
class ToolTimeout extends Error {}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => { t = setTimeout(() => rej(new ToolTimeout()), ms) }),
  ])
}

router.post('/internal/gateway/tools/search-availability', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const { fromIso, toIso, durationMinutes, timezone, conversationId, externalCallId } = availabilitySchema.parse(req.body)
    // Resolve to the tenant's timezone if the agent didn't pass one — the
    // agent commonly omits it, and defaulting to UTC means slot labels come
    // back as UTC strings the model misreads as wall-clock time. Forcing
    // the business's timezone here keeps the agent honest.
    const effectiveTz = await appointmentService.resolveTenantTimezone(tenantId, timezone)

    // Phase E.2 — resolve partnerId from the conversation, same pattern as
    // book_appointment. Null on tenant-side calls; set on partner-page calls.
    const { partnerId } = await resolveGatewayCallContext(tenantId, { conversationId, externalCallId })

    let result
    try {
      result = await withTimeout(appointmentService.searchAvailability(tenantId, {
        preferredStartRange: { from: fromIso, to: toIso },
        durationMinutes,
        timezone: effectiveTz,
      }, partnerId), 6000)
    } catch (e) {
      if (e instanceof ToolTimeout) {
        // Non-2xx → the tool's !result.ok branch fires (spoken system-error line).
        res.status(504).json({ error: 'Calendar lookup timed out' })
        return
      }
      throw e
    }

    // Enrich each slot with a human-readable label + a timezone-aware ISO
    // the model can pass back to book_appointment without having to do
    // timezone math itself. This stops the "13:00 UTC misread as 1 PM" bug
    // observed in the 2026-05-07 test calls.
    const enrich = (s: { startAt: string; endAt: string }) => {
      const utcMs = new Date(s.startAt).getTime()
      const fmt = appointmentService.formatSlotForAgent(utcMs, effectiveTz)
      return { label: fmt.label, start_local_iso: fmt.startLocalIso, end_iso: s.endAt }
    }
    res.json({
      data: {
        ok:              true,
        timezone:        effectiveTz,
        slots:           result.slots.map(enrich),
        alternateSlots:  result.alternateSlots.map(enrich),
      },
    })
  } catch (err) { next(err) }
})

router.post('/internal/gateway/tools/book-appointment', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = bookSchema.parse(req.body)

    // Find the contact (best-effort — booking can proceed with attendee email if
    // we cannot match a contact record; the agent should have collected one or
    // both during the conversation).
    const contact = await findContact(tenantId, data.contactQuery)
    const attendeeEmail = contact?.email ?? (data.contactQuery.includes('@') ? data.contactQuery : undefined)

    const startAt = new Date(data.startsAtIso)
    const endAt   = new Date(startAt.getTime() + data.durationMinutes * 60_000)
    // Fall back to the tenant's timezone when the agent didn't pass one —
    // the agent commonly omits `timezone` in book_appointment args, and
    // defaulting to UTC stamps the wrong tz on the row even though the
    // wall-clock booking time is correct. Downstream campaign emails read
    // this column to format the appointment time, so a UTC stamp surfaces
    // as a 4-hour-off display ("2:00 PM UTC" instead of "10:00 AM EDT").
    const tz = await appointmentService.resolveTenantTimezone(tenantId, data.timezone)

    // Phase E.2 — read partnerId off the conversation so the booking is routed
    // to the right calendar. partnerId is null for tenant-side widget calls and
    // for inbound phone calls; only partner-page widget calls have it set.
    const { conversationId, partnerId } = await resolveGatewayCallContext(tenantId, data)

    let appointment
    try {
      appointment = await withTimeout(appointmentService.createAppointment(tenantId, null, {
        contactId:       contact?.id,
        conversationId,
        partnerId,
        appointmentType: data.appointmentType,
        startAt:         startAt.toISOString(),
        endAt:           endAt.toISOString(),
        timezone:        tz,
        location:        data.location,
        notes:           data.notes,
        attendeeEmail,
      }), 7000)
    } catch (e) {
      if (e instanceof ToolTimeout) {
        // Non-2xx → the tool's !result.ok branch fires (spoken confirming line).
        res.status(504).json({ error: 'Booking timed out' })
        return
      }
      throw e
    }

    // Service writes its own appointment.created audit; add a gateway-attribution
    // entry so support can see the call → booking link.
    await writeAuditLog({
      tenantId,
      actorType:  'SYSTEM',
      action:     'gateway.tool.book_appointment',
      targetType: 'Appointment',
      targetId:   appointment.id,
      metadataJson: {
        contactId:      contact?.id ?? null,
        contactQuery:   data.contactQuery,
        conversationId: data.conversationId ?? null,
      },
    })

    res.json({
      data: {
        ok: true,
        appointmentId: appointment.id,
        startAt:       appointment.startAt,
        endAt:         appointment.endAt,
      },
    })
  } catch (err) { next(err) }
})

// ---------- tool: book_window (WINDOWS scheduling mode) ----------
// Books an arrival WINDOW (day + morning/afternoon/evening) instead of an exact
// time — for field-service tenants whose jobs run long. Reuses the Appointment
// model: the window's start/end times bound the row, and the label rides in notes.
const WINDOW_SLOTS: Record<string, { startHour: number; endHour: number; label: string }> = {
  MORNING:   { startHour: 8,  endHour: 12, label: 'morning (8 AM–12 PM)' },
  AFTERNOON: { startHour: 12, endHour: 16, label: 'afternoon (12–4 PM)' },
  EVENING:   { startHour: 16, endHour: 20, label: 'evening (4–8 PM)' },
}
// Wall-clock {ymd, hour} in a tz → the correct UTC instant (DST-safe).
function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = dtf.formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a }, {} as Record<string, string>)
  const asUtc = Date.UTC(+p['year']!, +p['month']! - 1, +p['day']!, +p['hour']!, +p['minute']!, +p['second']!)
  return (asUtc - date.getTime()) / 60000
}
function zonedWallClockToUtc(ymd: string, hour: number, tz: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = new Date(Date.UTC(y!, m! - 1, d!, hour, 0, 0))
  return new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60000)
}

const bookWindowSchema = z.object({
  windowDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowSlot:     z.enum(['MORNING', 'AFTERNOON', 'EVENING']),
  contactQuery:   z.string().min(1).max(200),
  notes:          z.string().max(600).optional(),
  conversationId: z.string().uuid().optional(),
  externalCallId: z.string().min(1).max(120).optional(),
})

router.post('/internal/gateway/tools/book-window', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const d = bookWindowSchema.parse(req.body)
    const slot = WINDOW_SLOTS[d.windowSlot]!
    const tz = await appointmentService.resolveTenantTimezone(tenantId, undefined)
    const startAt = zonedWallClockToUtc(d.windowDate, slot.startHour, tz)
    const endAt   = zonedWallClockToUtc(d.windowDate, slot.endHour, tz)

    const contact = await findContact(tenantId, d.contactQuery)
    const attendeeEmail = contact?.email ?? (d.contactQuery.includes('@') ? d.contactQuery : undefined)
    const { conversationId, partnerId } = await resolveGatewayCallContext(tenantId, d as any)

    const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }).format(startAt)
    const label = `${dayLabel}, ${slot.label}`

    const appointment = await appointmentService.createAppointment(tenantId, null, {
      contactId:       contact?.id,
      conversationId,
      partnerId,
      appointmentType: 'Arrival window',
      startAt:         startAt.toISOString(),
      endAt:           endAt.toISOString(),
      timezone:        tz,
      notes:           `Arrival window: ${label}.${d.notes ? ` ${d.notes}` : ''}`,
      attendeeEmail,
    })
    await writeAuditLog({ tenantId, actorType: 'SYSTEM', action: 'gateway.tool.book_window', targetType: 'Appointment', targetId: appointment.id, metadataJson: { windowDate: d.windowDate, windowSlot: d.windowSlot, label } })
    res.json({ data: { ok: true, appointmentId: appointment.id, label } })
  } catch (err) { next(err) }
})

// ---------- tool: transfer_call (live emergency / human handoff) ----------
// Redirects the active Twilio call away from the Gemini media stream to a <Dial>
// of the tenant's transfer number. Orby has already spoken the handoff line, so
// no TTS here. Fails cleanly (ok:false) when no transfer number is configured.
const transferCallSchema = z.object({
  callSid:         z.string().min(1),
  ownerAccountSid: z.string().nullable().optional(),
  reason:          z.string().max(120).optional(),
})
router.post('/internal/gateway/tools/transfer-call', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const d = transferCallSchema.parse(req.body)

    const [chan, tenant] = await Promise.all([
      prisma.channelConfig.findFirst({ where: { tenantId, channelType: 'INBOUND' }, select: { configJson: true } }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { publicPhone: true } }),
    ])
    const cfg = (chan?.configJson ?? {}) as Record<string, unknown>
    // Transfer target from channel config (admin-set), falling back to publicPhone.
    // Sanitize to phone chars only — it's interpolated into TwiML.
    const raw = (cfg['transferNumber'] as string) || (cfg['forwardingNumber'] as string) || tenant?.publicPhone || ''
    const to = raw.replace(/[^+0-9]/g, '')
    if (!to) { res.json({ data: { ok: false, error: 'no_transfer_number' } }); return }

    // Build a Twilio client for the account the call lives on (subaccount or master).
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const master = await getPlatformTwilioClient()
    let client = master
    if (d.ownerAccountSid && d.ownerAccountSid !== master.accountSid) {
      const { getSubaccountAuthTokenBySid } = await import('../services/twilio-subaccount.service.js')
      const token = await getSubaccountAuthTokenBySid(d.ownerAccountSid)
      if (token) {
        const Twilio = (await import('twilio')).default
        client = Twilio(d.ownerAccountSid, token)
      }
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${to}</Dial></Response>`
    await client.calls(d.callSid).update({ twiml })
    await writeAuditLog({ tenantId, actorType: 'SYSTEM', action: 'gateway.tool.transfer_call', targetType: 'Call', targetId: d.callSid, metadataJson: { to, reason: d.reason ?? '' } })
    res.json({ data: { ok: true, to } })
  } catch (err) { next(err) }
})

// ---------- internal: cancel an appointment created during this session ----------
//
// Used to compensate when Gemini Live emits a `toolCallCancellation` for a
// book_appointment that already committed to Postgres + Google Calendar.
// Without this, the cancelled call leaves a phantom event the model has
// already moved on from. The gateway invokes this with the appointmentId
// it captured from the original book_appointment response.

const cancelSchema = z.object({
  appointmentId: z.string().min(8).max(80),
  reason:        z.string().max(200).optional(),
})

router.post('/internal/gateway/tools/cancel-appointment', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const { appointmentId, reason } = cancelSchema.parse(req.body)

    // Tenant-scoped lookup so a leaked id from one tenant cannot cancel
    // another tenant's appointment.
    const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } })
    if (!appt) {
      res.json({ data: { ok: false, error: 'Appointment not found' } })
      return
    }
    if (appt.status === 'CANCELED') {
      res.json({ data: { ok: true, alreadyCanceled: true } })
      return
    }

    await appointmentService.cancelAppointment(tenantId, null, appointmentId)

    await writeAuditLog({
      tenantId,
      actorType:    'SYSTEM',
      action:       'gateway.tool.book_appointment_rolled_back',
      targetType:   'Appointment',
      targetId:     appointmentId,
      metadataJson: { reason: reason ?? 'tool_call_cancelled_by_model' },
    })

    res.json({ data: { ok: true, appointmentId } })
  } catch (err) { next(err) }
})

// ---------- tool: send_followup_email ----------

const emailSchema = z.object({
  contactQuery: z.string().min(1).max(200),
  to:           z.string().email().optional(),
  subject:      z.string().min(1).max(300),
  body:         z.string().min(1).max(20_000),
  isHtml:       z.boolean().optional(),
})

router.post('/internal/gateway/tools/send-followup-email', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = emailSchema.parse(req.body)

    let contact = await findContact(tenantId, data.contactQuery)
    const recipient = data.to ?? contact?.email
    if (!recipient) {
      throw new AppError('VALIDATION_ERROR', 'No email address available for this contact', 422)
    }

    // If the agent dictated a name we don't have a record for, opportunistically
    // create a contact so the email gets associated for later review.
    if (!contact && data.to) {
      contact = await contactService.createContact(tenantId, {
        email:  data.to,
        source: 'voice_agent_followup',
      }).catch(() => null)
    }

    // Prefer the tenant's own connected Gmail (the email lands from THEIR
    // mailbox). Tenants without Google linked — every agent-demo tenant, and any
    // tenant that hasn't finished OAuth — used to make this tool hard-fail, so
    // Orby could never send anything on a demo call. Fall back to the platform
    // transactional sender so "I'll email that to you" is always true.
    let sentVia: 'gmail' | 'platform' = 'gmail'
    try {
      await googleService.sendGmailEmail(tenantId, {
        to:      recipient,
        subject: data.subject,
        body:    data.body,
        isHtml:  data.isHtml ?? false,
      })
    } catch (gmailErr) {
      sentVia = 'platform'
      const profile = await prisma.businessProfile.findUnique({
        where:  { tenantId },
        select: { brandName: true },
      }).catch(() => null)
      const fromName = (profile?.brandName || 'MyOrbisAgents').replace(/"/g, '')
      const html = data.isHtml
        ? data.body
        : `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111;line-height:1.55;white-space:pre-wrap">${escapeHtml(data.body)}</div>`
      await sendEmail({
        to:      recipient,
        from:    `"${fromName}" <notify@myorbisresults.com>`,
        subject: data.subject,
        html,
      })
      console.warn(`[gateway] send_followup_email: Gmail unavailable for tenant ${tenantId} (${(gmailErr as Error).message}) — sent via platform sender instead`)
    }

    await writeAuditLog({
      tenantId,
      actorType:  'SYSTEM',
      action:     'gateway.tool.send_followup_email',
      targetType: 'Contact',
      targetId:   contact?.id,
      metadataJson: {
        recipient,
        subject:    data.subject,
        bodyLength: data.body.length,
        sentVia,
      },
    })

    res.json({ data: { ok: true, sentTo: recipient } })
  } catch (err) { next(err) }
})

// ---------- tool: record_disposition ----------

const dispositionSchema = z.object({
  conversationId: z.string().uuid().optional(),
  externalCallId: z.string().min(1).max(120).optional(),
  outcomeCode:    z.string().min(1).max(40),
  notes:          z.string().max(2000).optional(),
}).refine(d => d.conversationId || d.externalCallId, {
  message: 'Provide conversationId or externalCallId',
})

router.post('/internal/gateway/tools/record-disposition', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = dispositionSchema.parse(req.body)

    const conv = data.conversationId
      ? await prisma.conversation.findFirst({ where: { id: data.conversationId, tenantId } })
      : await prisma.conversation.findFirst({ where: { externalCallId: data.externalCallId!, tenantId } })

    if (!conv) {
      throw new AppError('NOT_FOUND', 'Conversation not found', 404)
    }

    await prisma.conversation.update({
      where: { id: conv.id },
      data:  { outcomeCode: data.outcomeCode },
    })

    // Auto-tag the contact based on outcome — drives campaign enrollment.
    // Outcomes that don't map to a tag (WRONG_NUMBER, SPAM, NO_ACTION) are no-ops.
    const tagByOutcome: Record<string, string> = {
      BOOKED:               'booked',
      CALLBACK_REQUESTED:   'callback-requested',
      INFO_REQUEST:         'info-requested',
      QUALIFIED_LEAD:       'qualified-lead',
      MISSED_CALL:          'missed-call',
    }
    const tagToApply = tagByOutcome[data.outcomeCode]
    let autoTaggedCampaign: { id: string; name: string } | null = null

    if (tagToApply && conv.contactId) {
      try {
        const { applyTag } = await import('../services/campaign.service.js')
        const tagResult = await applyTag(tenantId, conv.contactId, tagToApply)
        if (tagResult.enrolled && tagResult.campaign) {
          autoTaggedCampaign = tagResult.campaign
        }
      } catch (err) {
        // Non-fatal — outcome recording must succeed even if tag/enrollment fails
        console.error('[record_disposition] auto-tag failed:', err)
      }
    }

    await writeAuditLog({
      tenantId,
      actorType:  'SYSTEM',
      action:     'gateway.tool.record_disposition',
      targetType: 'Conversation',
      targetId:   conv.id,
      metadataJson: {
        outcomeCode: data.outcomeCode,
        notes:       data.notes ?? null,
        autoTag:     tagToApply ?? null,
        enrolledCampaign: autoTaggedCampaign,
      },
    })

    res.json({ data: { ok: true, conversationId: conv.id, autoTag: tagToApply ?? null, enrolledCampaign: autoTaggedCampaign } })
  } catch (err) { next(err) }
})

// request_callback — CALLBACK scheduling mode. Orby captures a lead instead of
// booking a time: records the disposition, alerts the owner immediately, and
// texts the caller a confirmation. See docs/scheduling-modes-plan.md.
function callbackSlaPhrase(sla?: string | null): string {
  switch ((sla ?? '').trim().toUpperCase()) {
    case 'ONE_HOUR':          return 'within the hour'
    case 'SAME_DAY':          return 'by the end of the day'
    case 'NEXT_BUSINESS_DAY': return 'first thing the next business day'
    case '':                  return 'shortly'
    default:                  return (sla as string).trim()
  }
}

const requestCallbackSchema = z.object({
  conversationId: z.string().uuid().optional(),
  externalCallId: z.string().min(1).max(120).optional(),
  callSid:        z.string().min(1).optional(),
  name:           z.string().min(1).max(120),
  phone:          z.string().min(3).max(40),
  address:        z.string().max(300).optional(),
  problem:        z.string().max(600).optional(),
  urgency:        z.string().max(20).optional(),
  scheduling: z.object({
    callbackWho:    z.string().max(120).optional(),
    callbackSla:    z.string().max(120).optional(),
    ownerNotify:    z.object({ sms: z.boolean().optional(), email: z.boolean().optional(), phone: z.string().max(40).optional() }).optional(),
    callerTextBack: z.boolean().optional(),
  }).nullable().optional(),
})

router.post('/internal/gateway/tools/request-callback', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const d = requestCallbackSchema.parse(req.body)
    const sched = d.scheduling ?? {}
    const who = sched.callbackWho?.trim() || 'the team'
    const promise = `${who} will call you back ${callbackSlaPhrase(sched.callbackSla)}`
    const isUrgent = (d.urgency ?? '').toUpperCase() === 'EMERGENCY'

    // Record the callback disposition + stash the captured lead on the conversation.
    const conv = d.conversationId
      ? await prisma.conversation.findFirst({ where: { id: d.conversationId, tenantId } })
      : d.externalCallId
        ? await prisma.conversation.findFirst({ where: { externalCallId: d.externalCallId, tenantId } })
        : null
    if (conv) {
      const leadNote = [`Callback requested (${d.urgency ?? 'ROUTINE'})`, `Name: ${d.name}`, `Phone: ${d.phone}`, d.address ? `Address: ${d.address}` : '', d.problem ? `Problem: ${d.problem}` : ''].filter(Boolean).join(' · ')
      await prisma.conversation.update({
        where: { id: conv.id },
        data:  { outcomeCode: 'CALLBACK_REQUESTED', summaryText: conv.summaryText ? `${conv.summaryText}\n\n${leadNote}` : leadNote },
      }).catch((e) => console.error('[request_callback] conv update failed:', e))
    }

    // Caller + tenant numbers from the live call record (text-back + owner from-#).
    const call = d.callSid
      ? await prisma.callLog.findFirst({ where: { providerCallId: d.callSid, tenantId }, select: { sourceNumber: true, destinationNumber: true, contactId: true } })
      : null

    const { sendMessage } = await import('../services/sms.service.js')

    // Owner notification — the linchpin: the callback only happens if the owner is
    // pinged immediately with the lead.
    let ownerNotified = false
    const ownerPhone = sched.ownerNotify?.phone?.trim()
    if (sched.ownerNotify?.sms !== false && ownerPhone && call?.destinationNumber) {
      const body = `${isUrgent ? '🚨 URGENT ' : ''}Callback request: ${d.name} (${d.phone})` + (d.address ? ` · ${d.address}` : '') + (d.problem ? ` · ${d.problem}` : '')
      const r = await sendMessage({ tenantId, from: call.destinationNumber, to: ownerPhone, body })
      ownerNotified = r.success
    }

    // Caller text-back — concrete expectation + invite a photo.
    let callerTexted = false
    if (sched.callerTextBack !== false && call?.sourceNumber && call.destinationNumber) {
      const r = await sendMessage({ tenantId, from: call.destinationNumber, to: call.sourceNumber, body: `Got it — ${promise}. Reply here with a photo if it helps us prepare.`, contactId: call.contactId ?? undefined })
      callerTexted = r.success
    }

    await writeAuditLog({
      tenantId, actorType: 'SYSTEM', action: 'gateway.tool.request_callback',
      targetType: 'Conversation', targetId: conv?.id ?? undefined,
      metadataJson: { name: d.name, phone: d.phone, urgency: d.urgency ?? 'ROUTINE', ownerNotified, callerTexted },
    })

    res.json({ data: { ok: true, promise, ownerNotified, callerTexted } })
  } catch (err) { next(err) }
})

// collect_payment — Orby texts a Stripe payment link to the caller mid-call.
// Pass-through: the link is a Checkout Session on the tenant's connected
// account (no platform fee). Gated: the tenant must have orbyPaymentsEnabled
// AND stripeChargesEnabled — off by default, so this is a no-op for any tenant
// that hasn't deliberately turned it on. The caller's number + the tenant's
// own number are resolved from the CallLog (by callSid), so the gateway never
// has to thread phone numbers around.
const collectPaymentSchema = z.object({
  callSid:     z.string().min(1),
  amountCents: z.number().int().positive().optional(),
  description: z.string().max(200).optional(),
})

router.post('/internal/gateway/tools/collect-payment', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = collectPaymentSchema.parse(req.body)

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { orbyPaymentsEnabled: true, stripeChargesEnabled: true, orbyDepositCents: true, displayName: true },
    })
    if (!tenant?.orbyPaymentsEnabled || !tenant.stripeChargesEnabled) {
      res.json({ data: { ok: false, error: 'payments_not_enabled' } }); return
    }

    const amountCents = data.amountCents ?? tenant.orbyDepositCents ?? 0
    if (amountCents < 50) {
      res.json({ data: { ok: false, error: 'no_amount' } }); return
    }

    // Resolve caller (sourceNumber) + the tenant's own number (destinationNumber)
    // + the matched contact from the live call record.
    const call = await prisma.callLog.findFirst({
      where:  { providerCallId: data.callSid, tenantId },
      select: { sourceNumber: true, destinationNumber: true, contactId: true },
    })
    if (!call?.sourceNumber || !call.destinationNumber) {
      res.json({ data: { ok: false, error: 'no_caller_number' } }); return
    }

    const description = data.description?.trim() || `Payment to ${tenant.displayName}`
    const { createPaymentLink } = await import('../services/tenant-payments.service.js')
    const { sendMessage } = await import('../services/sms.service.js')

    const link = await createPaymentLink(tenantId, {
      amountCents, description, source: 'voice',
      contactId: call.contactId ?? undefined,
    })

    const sms = await sendMessage({
      tenantId,
      from:      call.destinationNumber,
      to:        call.sourceNumber,
      body:      `${description}: ${link.url}`,
      contactId: call.contactId ?? undefined,
    })

    res.json({ data: { ok: sms.success, sent: sms.success, amountCents, error: sms.success ? undefined : (sms.error ?? 'sms_failed') } })
  } catch (err) { next(err) }
})

// The gateway muxes demo call audio (caller + Orby) into a WAV itself, because
// Twilio's recording API crashes <Connect><Stream> calls. It posts the WAV here
// (base64) after the conversation is persisted; we upload to Bunny + attach.
const recordingSchema = z.object({
  callSid:      z.string().min(1),
  durationSecs: z.number().int().nonnegative(),
  wavBase64:    z.string().min(1),
})
router.post('/internal/gateway/recording', async (req, res, next) => {
  try {
    const tenantId = (req as any).internalTenantId as string
    const data = recordingSchema.parse(req.body)
    const wav = Buffer.from(data.wavBase64, 'base64')
    await storeGatewayRecording(data.callSid, tenantId, wav, data.durationSecs)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
