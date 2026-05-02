import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import * as svc from '../services/outbound-campaign.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

// ── CRUD ───────────────────────────────────────────────────────────────────────
router.get('/outbound-campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.listOutboundCampaigns(tenantId) })
  } catch (err) { next(err) }
})

router.get('/outbound-campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.getOutboundCampaign(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

router.post('/outbound-campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = svc.createOutboundCampaignSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const campaign = await svc.createOutboundCampaign(tenantId, parsed.data)
    res.status(201).json({ data: campaign })
  } catch (err) { next(err) }
})

router.patch('/outbound-campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = svc.updateOutboundCampaignSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    res.json({ data: await svc.updateOutboundCampaign(tenantId, req.params['id']!, parsed.data) })
  } catch (err) { next(err) }
})

router.delete('/outbound-campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await svc.deleteOutboundCampaign(tenantId, req.params['id']!)
    res.sendStatus(204)
  } catch (err) { next(err) }
})

// ── Contact management ─────────────────────────────────────────────────────────
router.post('/outbound-campaigns/:id/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = svc.addContactsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'contactIds array required', 422)
    const result = await svc.addContactsToCampaign(tenantId, req.params['id']!, parsed.data.contactIds)
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.delete('/outbound-campaigns/:id/contacts/:contactId', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await svc.removeContactFromCampaign(tenantId, req.params['id']!, req.params['contactId']!)
    res.sendStatus(204)
  } catch (err) { next(err) }
})

router.get('/outbound-campaigns/:id/attempts', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.listAttempts(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

// ── State transitions ──────────────────────────────────────────────────────────
router.post('/outbound-campaigns/:id/start', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.startCampaign(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

router.post('/outbound-campaigns/:id/pause', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.pauseCampaign(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

router.post('/outbound-campaigns/:id/cancel', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    res.json({ data: await svc.cancelCampaign(tenantId, req.params['id']!) })
  } catch (err) { next(err) }
})

export default router
