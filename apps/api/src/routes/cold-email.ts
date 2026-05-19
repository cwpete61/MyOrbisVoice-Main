/**
 * Cold-email routes — partner-scoped (Bulk Email Phase 2 + 3).
 *
 * Phase 2: send one compliant cold email through the partner's dedicated SES
 * sending domain. Phase 3: build multi-touch campaigns — a named campaign, a
 * touch sequence, and enrolled leads.
 *
 * Mounted under /api, gated by requirePartnerContext.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import { sendColdEmail } from '../services/cold-email.service.js'
import * as campaigns from '../services/cold-email-campaign.service.js'

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

function partnerId(req: Request): string {
  return (req as Request & { partnerAccountId: string }).partnerAccountId
}

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(50000),
})

router.post('/partner/cold-email/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = sendSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid input', 422)
    }
    const result = await sendColdEmail({ partnerId: partnerId(req), ...parsed.data })
    res.json({ data: result })
  } catch (err) { next(err) }
})

// ── Campaigns (Phase 3) ──────────────────────────────────────────────────────

const createCampaignSchema = z.object({ name: z.string().trim().min(1).max(120) })
const updateCampaignSchema = z.object({
  name:   z.string().trim().min(1).max(120).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
})
const touchesSchema = z.object({
  touches: z.array(z.object({
    delayDays: z.number().int().min(0).max(365),
    subject:   z.string().trim().min(1).max(200),
    bodyHtml:  z.string().min(1).max(50000),
  })).min(1).max(10),
})
const enrollSchema = z.object({ leadIds: z.array(z.string().uuid()).min(1).max(500) })

function invalid(msg?: string): never {
  throw new AppError('VALIDATION_ERROR', msg ?? 'Invalid input', 422)
}

router.get('/partner/cold-email/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await campaigns.listCampaigns(partnerId(req)) })
  } catch (err) { next(err) }
})

router.get('/partner/cold-email/eligible-leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await campaigns.listEligibleLeads(partnerId(req)) })
  } catch (err) { next(err) }
})

router.post('/partner/cold-email/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createCampaignSchema.safeParse(req.body)
    if (!parsed.success) invalid(parsed.error.errors[0]?.message)
    res.json({ data: await campaigns.createCampaign(partnerId(req), parsed.data.name) })
  } catch (err) { next(err) }
})

router.get('/partner/cold-email/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaigns.getCampaign(partnerId(req), req.params['id']!)
    if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
    res.json({ data: campaign })
  } catch (err) { next(err) }
})

router.get('/partner/cold-email/campaigns/:id/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await campaigns.getCampaignFunnel(partnerId(req), req.params['id']!) })
  } catch (err) { next(err) }
})

router.patch('/partner/cold-email/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateCampaignSchema.safeParse(req.body)
    if (!parsed.success) invalid(parsed.error.errors[0]?.message)
    res.json({ data: await campaigns.updateCampaign(partnerId(req), req.params['id']!, parsed.data) })
  } catch (err) { next(err) }
})

router.delete('/partner/cold-email/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await campaigns.deleteCampaign(partnerId(req), req.params['id']!)
    res.json({ data: { deleted: true } })
  } catch (err) { next(err) }
})

router.put('/partner/cold-email/campaigns/:id/touches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = touchesSchema.safeParse(req.body)
    if (!parsed.success) invalid(parsed.error.errors[0]?.message)
    res.json({ data: await campaigns.saveTouches(partnerId(req), req.params['id']!, parsed.data.touches) })
  } catch (err) { next(err) }
})

router.post('/partner/cold-email/campaigns/:id/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = enrollSchema.safeParse(req.body)
    if (!parsed.success) invalid(parsed.error.errors[0]?.message)
    res.json({ data: await campaigns.enrollLeads(partnerId(req), req.params['id']!, parsed.data.leadIds) })
  } catch (err) { next(err) }
})

router.delete('/partner/cold-email/campaigns/:id/leads/:campaignLeadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await campaigns.removeLead(partnerId(req), req.params['id']!, req.params['campaignLeadId']!)
    res.json({ data: { removed: true } })
  } catch (err) { next(err) }
})

export default router
