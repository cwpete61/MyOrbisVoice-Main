import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as svc from '../services/campaign.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

// ── Templates (what the platform offers for a vertical) ───────────────────────
router.get('/campaigns/templates', async (_req, res, next) => {
  try {
    const templates = await svc.listTemplates()
    res.json({ data: templates })
  } catch (err) { next(err) }
})

// ── Campaigns CRUD ─────────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.listCampaigns(tenantId) })
  } catch (err) { next(err) }
})

router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.getCampaign(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

router.post('/campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = svc.createCampaignSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    }
    const campaign = await svc.createCampaign(tenantId, parsed.data)
    res.status(201).json({ data: campaign })
  } catch (err) { next(err) }
})

router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = svc.updateCampaignSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    res.json({ data: await svc.updateCampaign(tenantId, req.params['id']!, parsed.data) })
  } catch (err) { next(err) }
})

router.delete('/campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await svc.deleteCampaign(tenantId, req.params['id']!)
    res.sendStatus(204)
  } catch (err) { next(err) }
})

// ── Tag engine ─────────────────────────────────────────────────────────────────
router.post('/contacts/:contactId/tags', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { tag } = req.body as { tag?: string }
    if (!tag) throw new AppError('VALIDATION_ERROR', 'tag is required', 422)
    const result = await svc.applyTag(tenantId, req.params['contactId']!, tag)
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.delete('/contacts/:contactId/tags/:tag', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const result = await svc.removeTag(tenantId, req.params['contactId']!, req.params['tag']!)
    res.json({ data: result })
  } catch (err) { next(err) }
})

// ── Enrollments ────────────────────────────────────────────────────────────────
router.get('/campaigns/:id/enrollments', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const status = req.query['status'] as string | undefined
    res.json({ data: await svc.listEnrollments(tenantId, req.params['id']!, status) })
  } catch (err) { next(err) }
})

router.get('/enrollments', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const status = req.query['status'] as string | undefined
    res.json({ data: await svc.listEnrollments(tenantId, undefined, status) })
  } catch (err) { next(err) }
})

// ── Tenant vertical ────────────────────────────────────────────────────────────
router.patch('/tenant/vertical', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { vertical } = req.body as { vertical?: string }
    if (!vertical) throw new AppError('VALIDATION_ERROR', 'vertical is required', 422)
    res.json({ data: await svc.updateTenantVertical(tenantId, vertical) })
  } catch (err) { next(err) }
})

export default router
