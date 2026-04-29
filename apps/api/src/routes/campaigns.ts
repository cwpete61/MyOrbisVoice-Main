import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as campaignService from '../services/campaign.service.js'
import * as outboundService from '../services/outbound.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

const createSchema = z.object({
  name:            z.string().min(1),
  description:     z.string().optional(),
  audienceJson:    z.record(z.unknown()).optional(),
  scheduleJson:    z.record(z.unknown()).optional(),
  promptVersionId: z.string().uuid().optional(),
})

router.get('/campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaigns = await campaignService.listCampaigns(tenantId)
    res.json({ data: campaigns })
  } catch (err) { next(err) }
})

router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaign = await campaignService.getCampaign(tenantId, req.params.id!)
    if (!campaign) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'Campaign not found' }] }); return }
    const stats = await campaignService.getAttemptStats(req.params.id!)
    res.json({ data: { ...campaign, stats } })
  } catch (err) { next(err) }
})

router.post('/campaigns', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ errors: parsed.error.issues.map(i => ({ code: 'VALIDATION_ERROR', message: i.message })) })
      return
    }
    const campaign = await campaignService.createCampaign(tenantId, parsed.data)
    res.status(201).json({ data: campaign })
  } catch (err) { next(err) }
})

router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaign = await campaignService.updateCampaign(tenantId, req.params.id!, req.body as Record<string, unknown>)
    res.json({ data: campaign })
  } catch (err) { next(err) }
})

// Add contacts to campaign
router.post('/campaigns/:id/contacts', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { contactIds } = req.body as { contactIds?: string[] }
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      res.status(422).json({ errors: [{ code: 'VALIDATION_ERROR', message: 'contactIds array required' }] })
      return
    }
    const result = await campaignService.addContactsToCampaign(tenantId, req.params.id!, contactIds)
    res.json({ data: result })
  } catch (err) { next(err) }
})

// Launch
router.post('/campaigns/:id/launch', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaign = await campaignService.launchCampaign(tenantId, req.params.id!)
    // Kick off pending calls (non-blocking)
    outboundService.dispatchPendingCalls(tenantId, req.params.id!).catch(() => null)
    res.json({ data: campaign })
  } catch (err) { next(err) }
})

// Pause
router.post('/campaigns/:id/pause', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaign = await campaignService.pauseCampaign(tenantId, req.params.id!)
    res.json({ data: campaign })
  } catch (err) { next(err) }
})

// Cancel
router.post('/campaigns/:id/cancel', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const campaign = await campaignService.cancelCampaign(tenantId, req.params.id!)
    res.json({ data: campaign })
  } catch (err) { next(err) }
})

export default router
