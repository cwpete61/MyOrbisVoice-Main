/**
 * Cold-email routes — partner-scoped (Bulk Email Phase 2).
 *
 * Sends one compliant cold email through the partner's dedicated SES sending
 * domain. The service runs the full pre-send gate (active domain, policy,
 * window, cap, drip, suppression, Reoon) and always returns a typed outcome.
 *
 * Mounted under /api, gated by requirePartnerContext.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import { sendColdEmail } from '../services/cold-email.service.js'

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

export default router
