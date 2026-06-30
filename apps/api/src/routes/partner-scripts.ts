/**
 * Partner script library (Directory Leads → Scripts tab). Mounted under /api and
 * gated by `requirePartnerContext` (sets req.partnerAccountId). Per-partner CRUD +
 * copy-from-default + a channel-aware AI draft helper. Admin default templates are
 * managed separately in routes/admin.ts.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import * as scripts from '../services/scripts.service.js'
import { generateScriptDraft, type ScriptChannel } from '../services/ai-assist.service.js'

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

const partnerId = (req: Request): string => (req as unknown as { partnerAccountId: string }).partnerAccountId
const userId = (req: Request): string => req.user!.id

const upsertSchema = z.object({
  title: z.string().max(200).optional(),
  channel: z.enum(scripts.SCRIPT_CHANNELS).optional(),
  bodyHtml: z.string().max(50_000).optional(),
})

const createSchema = z.object({
  title: z.string().max(200).default(''),
  channel: z.enum(scripts.SCRIPT_CHANNELS).default('call'),
  bodyHtml: z.string().max(50_000).default(''),
})

const aiSchema = z.object({
  channel: z.enum(scripts.SCRIPT_CHANNELS),
  instructions: z.string().min(1).max(2_000),
  businessContext: z.string().max(2_000).optional(),
})

// List own scripts + global admin defaults.
router.get('/partner/scripts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await scripts.listForPartner(partnerId(req)) })
  } catch (err) { next(err) }
})

// AI draft helper — channel-aware. (Declared before /:id so "ai" isn't read as an id.)
router.post('/partner/scripts/ai', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = aiSchema.parse(req.body)
    const draft = await generateScriptDraft({
      channel: b.channel as ScriptChannel,
      instructions: b.instructions,
      businessContext: b.businessContext,
    })
    res.json({ data: draft })
  } catch (err) { next(err) }
})

router.post('/partner/scripts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = createSchema.parse(req.body)
    res.json({ data: await scripts.createForPartner(partnerId(req), userId(req), b) })
  } catch (err) { next(err) }
})

router.get('/partner/scripts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await scripts.getForPartner(req.params.id!, partnerId(req)) })
  } catch (err) { next(err) }
})

router.put('/partner/scripts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = upsertSchema.parse(req.body)
    res.json({ data: await scripts.updateForPartner(req.params.id!, partnerId(req), b) })
  } catch (err) { next(err) }
})

router.delete('/partner/scripts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await scripts.deleteForPartner(req.params.id!, partnerId(req)) })
  } catch (err) { next(err) }
})

router.post('/partner/scripts/:id/copy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await scripts.copyForPartner(req.params.id!, partnerId(req), userId(req)) })
  } catch (err) { next(err) }
})

export default router
