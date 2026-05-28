/**
 * Partner Daily Activity routes — mounted at /api/partner/daily-activity/*.
 * Gated by requirePartnerContext (sets req.partnerAccountId).
 *
 *   GET    /                   — tree + tick state for today (default) or ?day=YYYY-MM-DD
 *   POST   /:activityKey/check — tick (with optional ?day= + body.notes)
 *   DELETE /:activityKey/check — untick (idempotent)
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import {
  getTreeForPartner,
  checkActivity,
  uncheckActivity,
  todayKey,
  isValidDayKey,
} from '../services/partner-daily-activity/progress.service.js'

const router: IRouter = Router()
router.use('/partner/daily-activity', authenticate, requirePartnerContext)

const dayQuerySchema = z.object({ day: z.string().optional() })

router.get('/partner/daily-activity', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = dayQuerySchema.safeParse(req.query)
    const day = parsed.success && parsed.data.day ? parsed.data.day : todayKey()
    if (!isValidDayKey(day)) {
      throw new AppError('VALIDATION_ERROR', 'invalid day format (expected YYYY-MM-DD)', 422)
    }
    const data = await getTreeForPartner(partnerId, day)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

const checkSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
})

router.post('/partner/daily-activity/:activityKey/check', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = checkSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    }
    const day = parsed.data.day ?? todayKey()
    const result = await checkActivity(partnerId, req.params.activityKey, day, parsed.data.notes)
    if (!result.ok) {
      throw new AppError('VALIDATION_ERROR', result.reason ?? 'Invalid activity', 422)
    }
    res.json({ data: { activityKey: req.params.activityKey, dayKey: day, completedAt: result.completedAt } })
  } catch (err) {
    next(err)
  }
})

router.delete('/partner/daily-activity/:activityKey/check', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const day = typeof req.query.day === 'string' ? req.query.day : todayKey()
    if (!isValidDayKey(day)) {
      throw new AppError('VALIDATION_ERROR', 'invalid day format', 422)
    }
    await uncheckActivity(partnerId, req.params.activityKey, day)
    res.json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
})

export default router
