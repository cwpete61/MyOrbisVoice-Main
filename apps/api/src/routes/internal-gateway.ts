import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'
import * as appointmentService from '../services/appointment.service.js'
import * as googleService from '../services/google.service.js'
import * as contactService from '../services/contact.service.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'

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
  fullName:  z.string().max(200).optional(),
  phoneE164: z.string().max(40).optional(),
  email:     z.string().email().max(200).optional(),
  notes:     z.string().max(2000).optional(),
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

    // Match by phone first, then email
    let existing = phoneE164
      ? await prisma.contact.findFirst({ where: { tenantId, phoneE164 } })
      : null
    if (!existing && email) {
      existing = await prisma.contact.findFirst({
        where: { tenantId, email: { equals: email, mode: 'insensitive' } },
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
    } else {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          fullName:         data.fullName ?? null,
          phoneE164,
          email,
          source:           'voice_agent',
          agentConfirmedAt: now,
          emailStatus:      email ? 'unchecked' : null,
          metadataJson:     data.notes ? { callNotes: [{ at: now.toISOString(), notes: data.notes }] } : undefined,
        },
      })
      created = true
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
  timezone:        z.string().max(80).optional(),
  conversationId:  z.string().uuid().optional(),
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
    const tz      = data.timezone ?? 'UTC'

    const appointment = await appointmentService.createAppointment(tenantId, null, {
      contactId:       contact?.id,
      conversationId:  data.conversationId,
      appointmentType: data.appointmentType,
      startAt:         startAt.toISOString(),
      endAt:           endAt.toISOString(),
      timezone:        tz,
      notes:           data.notes,
      attendeeEmail,
    })

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

    await googleService.sendGmailEmail(tenantId, {
      to:      recipient,
      subject: data.subject,
      body:    data.body,
      isHtml:  data.isHtml ?? false,
    })

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

    await writeAuditLog({
      tenantId,
      actorType:  'SYSTEM',
      action:     'gateway.tool.record_disposition',
      targetType: 'Conversation',
      targetId:   conv.id,
      metadataJson: {
        outcomeCode: data.outcomeCode,
        notes:       data.notes ?? null,
      },
    })

    res.json({ data: { ok: true, conversationId: conv.id } })
  } catch (err) { next(err) }
})

export default router
