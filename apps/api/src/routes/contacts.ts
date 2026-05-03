import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as contactService from '../services/contact.service.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'
import { sendSms } from '../services/sms.service.js'
import * as optOutSvc from '../services/opt-out.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

const createSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  fullName:  z.string().min(1).optional(),
  email:     z.string().email().optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format').optional(),
  source:    z.string().optional(),
}).refine(d => d.email || d.phoneE164 || d.fullName || d.firstName, {
  message: 'Provide at least a name, email, or phone number',
})

router.get('/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { search, page, limit } = req.query as Record<string, string>
    const result = await contactService.listContacts(tenantId, {
      search: search || undefined,
      page:   page   ? parseInt(page)  : undefined,
      limit:  limit  ? parseInt(limit) : undefined,
    })
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.get('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const contact = await contactService.getContact(tenantId, req.params.id!)
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    res.json({ data: contact })
  } catch (err) { next(err) }
})

router.post('/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ errors: parsed.error.issues.map(i => ({ code: 'VALIDATION_ERROR', message: i.message })) })
      return
    }
    const contact = await contactService.createContact(tenantId, parsed.data)
    res.status(201).json({ data: contact })
  } catch (err) { next(err) }
})

// POST /api/contacts/import — bulk import from CSV.
// Body: { csv: "firstName,lastName,email,phone\nJane,Doe,jane@x.com,+1...\n..." }
// Header row required. Recognized columns (case-insensitive, any subset):
//   firstName, lastName, fullName, email, phone (or phoneE164)
// Returns { created, skipped, errors }. skipped = rows failing validation;
// errors = first 10 row-level errors with row number for fixing.
router.post('/contacts/import', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { csv } = z.object({ csv: z.string().min(10).max(2_000_000) }).parse(req.body)

    // Light-weight CSV parser — handles quoted values + escaped quotes,
    // doesn't depend on a library. Sufficient for typical contact lists.
    const parseCsv = (input: string): string[][] => {
      const rows: string[][] = []
      let row: string[] = []
      let cell = ''
      let inQuotes = false
      for (let i = 0; i < input.length; i++) {
        const c = input[i]
        if (inQuotes) {
          if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; continue }
          if (c === '"') { inQuotes = false; continue }
          cell += c
        } else {
          if (c === '"') { inQuotes = true; continue }
          if (c === ',') { row.push(cell); cell = ''; continue }
          if (c === '\n' || c === '\r') {
            if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); row = []; cell = '' }
            if (c === '\r' && input[i + 1] === '\n') i++
            continue
          }
          cell += c
        }
      }
      if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
      return rows
    }

    const rows = parseCsv(csv.trim())
    if (rows.length < 2) {
      res.status(422).json({ errors: [{ code: 'VALIDATION_ERROR', message: 'CSV needs a header row plus at least one data row.' }] })
      return
    }

    const headers = rows[0]!.map(h => h.trim().toLowerCase().replace(/_/g, ''))
    const colIdx = (...names: string[]) => {
      for (const n of names) {
        const i = headers.indexOf(n.toLowerCase())
        if (i >= 0) return i
      }
      return -1
    }
    const idx = {
      firstName: colIdx('firstname', 'first', 'first name'),
      lastName:  colIdx('lastname', 'last', 'last name'),
      fullName:  colIdx('fullname', 'name', 'full name'),
      email:     colIdx('email', 'e-mail'),
      phone:     colIdx('phone', 'phonee164', 'phone number', 'mobile', 'tel'),
    }

    if (idx.firstName === -1 && idx.fullName === -1 && idx.email === -1 && idx.phone === -1) {
      res.status(422).json({ errors: [{ code: 'VALIDATION_ERROR', message: 'CSV must include at least one of: firstName, fullName, email, phone.' }] })
      return
    }

    let created = 0, skipped = 0
    const errors: { row: number; reason: string }[] = []

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!
      const get = (j: number) => j >= 0 && j < r.length ? (r[j] ?? '').trim() : ''
      const data: Record<string, string> = {}
      const fn = get(idx.firstName); if (fn) data['firstName'] = fn
      const ln = get(idx.lastName);  if (ln) data['lastName']  = ln
      const fu = get(idx.fullName);  if (fu) data['fullName']  = fu
      const em = get(idx.email);     if (em) data['email']     = em
      let ph = get(idx.phone)
      if (ph) {
        // Normalize: strip non-digits except leading +. Add +1 to bare 10-digit US numbers.
        const cleaned = ph.replace(/[^\d+]/g, '')
        ph = cleaned.startsWith('+') ? cleaned : (cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`)
        data['phoneE164'] = ph
      }
      data['source'] = 'csv_import'

      const validated = createSchema.safeParse(data)
      if (!validated.success) {
        skipped++
        if (errors.length < 10) errors.push({ row: i + 1, reason: validated.error.issues[0]?.message ?? 'invalid' })
        continue
      }
      try {
        await contactService.createContact(tenantId, validated.data)
        created++
      } catch (e) {
        skipped++
        if (errors.length < 10) errors.push({ row: i + 1, reason: e instanceof Error ? e.message : 'create failed' })
      }
    }

    res.json({ data: { created, skipped, errors } })
  } catch (err) { next(err) }
})

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  fullName:  z.string().min(1).optional(),
  email:     z.string().email().optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format').optional(),
  source:    z.string().optional(),
})

router.patch('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ errors: parsed.error.issues.map(i => ({ code: 'VALIDATION_ERROR', message: i.message })) })
      return
    }
    await contactService.updateContact(tenantId, req.params.id!, parsed.data)
    const updated = await contactService.getContact(tenantId, req.params.id!)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

router.delete('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await contactService.deleteContact(tenantId, req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// GET /api/contacts/:id/timeline — unified voice + SMS interaction history
router.get('/contacts/:id/timeline', async (req, res, next) => {
  try {
    const tenantId   = req.user!.currentTenantId!
    const contactId  = req.params.id!
    const limit      = Math.min(parseInt((req.query['limit'] as string) || '50'), 100)
    const offset     = parseInt((req.query['offset'] as string) || '0')

    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    const [conversations, messages, optOuts] = await Promise.all([
      prisma.conversation.findMany({
        where: { tenantId, contactId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, channelType: true, direction: true, status: true,
          startedAt: true, endedAt: true, summaryText: true,
          recordingStatus: true, recordingDurationSecs: true,
          outcomeCode: true,
        },
      }),
      prisma.messageLog.findMany({
        where: { tenantId, contactId, channel: 'SMS' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, direction: true, sender: true, recipient: true,
          bodyText: true, deliveryStatus: true, optOutDetected: true,
          sentAt: true, deliveredAt: true, failedAt: true, createdAt: true,
        },
      }),
      prisma.optOutLog.findMany({
        where: { tenantId, contactId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, channel: true, source: true, optedOut: true, createdAt: true },
      }),
    ])

    // Merge and sort chronologically (newest first)
    const items = [
      ...conversations.map(c => ({ type: 'VOICE' as const, at: c.startedAt, data: c })),
      ...messages.map(m => ({ type: 'SMS' as const, at: m.sentAt ?? m.createdAt, data: m })),
      ...optOuts.map(o => ({ type: 'OPT_OUT' as const, at: o.createdAt, data: o })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime())

    res.json({ data: { contact, items, total: items.length } })
  } catch (err) { next(err) }
})

// POST /api/contacts/:id/opt-out — manual opt-out by staff
router.post('/contacts/:id/opt-out', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const { channel } = z.object({ channel: z.enum(['SMS', 'VOICE', 'EMAIL']) }).parse(req.body)
    await optOutSvc.processOptOut(tenantId, contactId, channel, 'MANUAL')
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// POST /api/contacts/:id/opt-in — manual opt-in by staff
router.post('/contacts/:id/opt-in', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const { channel } = z.object({ channel: z.enum(['SMS', 'VOICE', 'EMAIL']) }).parse(req.body)
    await optOutSvc.processOptIn(tenantId, contactId, channel, 'MANUAL')
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// GET /api/messages — list SMS messages for tenant
router.get('/messages', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const limit    = Math.min(parseInt((req.query['limit'] as string) || '50'), 100)
    const offset   = parseInt((req.query['offset'] as string) || '0')
    const contactId = req.query['contactId'] as string | undefined

    const where = { tenantId, channel: 'SMS' as const, ...(contactId ? { contactId } : {}) }
    const [items, total] = await Promise.all([
      prisma.messageLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.messageLog.count({ where }),
    ])
    res.json({ data: { items, total, limit, offset } })
  } catch (err) { next(err) }
})

// POST /api/messages/sms — send an SMS to a contact
router.post('/messages/sms', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { contactId, body } = z.object({
      contactId: z.string().uuid(),
      body:      z.string().min(1).max(1600),
    }).parse(req.body)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    if (!contact.phoneE164) throw new AppError('VALIDATION_ERROR', 'Contact has no phone number', 422)

    // Find a tenant phone number to send from
    const phone = await prisma.phoneNumber.findFirst({ where: { tenantId } })
    if (!phone) throw new AppError('VALIDATION_ERROR', 'No Twilio number configured', 422)

    const result = await sendSms({ tenantId, contactId, from: phone.e164Number, to: contact.phoneE164, body })
    if (!result.success) throw new AppError('EXTERNAL_ERROR', result.error ?? 'Failed to send SMS', 502)

    res.json({ data: { sid: result.sid } })
  } catch (err) { next(err) }
})

export default router
