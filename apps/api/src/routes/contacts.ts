import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as contactService from '../services/contact.service.js'
import { AppError } from '@voiceautomation/shared'

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

export default router
