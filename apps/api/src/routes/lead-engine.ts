/**
 * Lead engine routes — partner-scoped. A partner runs an industry + location
 * search, the engine finds + enriches local businesses, the partner reviews
 * the leads and promotes the good ones into their CRM.
 *
 * Mounted under /api and gated by requirePartnerContext (sets partnerAccountId).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import * as leadEngine from '../services/lead-engine.service.js'

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

function partnerId(req: Request): string {
  return (req as any).partnerAccountId as string
}

// ── Credits ─────────────────────────────────────────────────────────────────

router.get('/partner/leads/credits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credits = await leadEngine.getCredits(partnerId(req))
    res.json({ data: { credits } })
  } catch (err) { next(err) }
})

// ── Searches ────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  industry: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(120),
  // 60 = the lead engine's cap on the Serper Maps source.
  count: z.number().int().min(1).max(60),
})

router.post('/partner/leads/searches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = searchSchema.parse(req.body)
    const search = await leadEngine.createSearch(partnerId(req), input)
    res.status(201).json({ data: search })
  } catch (err) { next(err) }
})

router.get('/partner/leads/searches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searches = await leadEngine.listSearches(partnerId(req))
    res.json({ data: searches })
  } catch (err) { next(err) }
})

router.get('/partner/leads/searches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leadEngine.getSearchWithLeads(partnerId(req), req.params.id!)
    res.json({ data: result })
  } catch (err) { next(err) }
})

// ── Lead review + promote ───────────────────────────────────────────────────

router.patch('/partner/leads/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.enum(['SAVED', 'REJECTED']) }).parse(req.body)
    const lead = await leadEngine.reviewLead(partnerId(req), req.params.id!, status)
    res.json({ data: lead })
  } catch (err) { next(err) }
})

router.post('/partner/leads/:id/promote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await leadEngine.promoteLead(partnerId(req), req.params.id!)
    res.status(201).json({ data: contact })
  } catch (err) { next(err) }
})

// Bulk "send selected businesses to contacts".
router.post('/partner/leads/promote-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1).max(60) }).parse(req.body)
    const result = await leadEngine.promoteLeads(partnerId(req), leadIds)
    res.json({ data: result })
  } catch (err) { next(err) }
})

export default router
