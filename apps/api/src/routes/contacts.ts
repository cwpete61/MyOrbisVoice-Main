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

router.patch('/contacts/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await contactService.updateContact(tenantId, req.params.id!, req.body as Record<string, string>)
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
