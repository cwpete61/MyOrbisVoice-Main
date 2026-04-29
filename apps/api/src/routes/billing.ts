import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { createCheckoutSession, createPortalSession, getSubscription } from '../services/stripe.service.js'
import { getEffectiveEntitlements } from '../services/entitlement.service.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

router.get('/billing/subscription', authenticate, requireTenantContext, async (req, res, next) => {
  try {
    const sub = await getSubscription(req.user!.currentTenantId!)
    res.json({ data: sub ?? null })
  } catch (err) {
    next(err)
  }
})

router.post('/billing/checkout-session', authenticate, requireTenantContext, async (req, res, next) => {
  try {
    const schema = z.object({ planCode: z.string().min(1) })
    const { planCode } = schema.parse(req.body)
    const result = await createCheckoutSession(req.user!.currentTenantId!, planCode)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/billing/portal-session', authenticate, requireTenantContext, async (req, res, next) => {
  try {
    const result = await createPortalSession(req.user!.currentTenantId!)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.get('/entitlements', authenticate, requireTenantContext, async (req, res, next) => {
  try {
    const entitlements = await getEffectiveEntitlements(req.user!.currentTenantId!)
    res.json({ data: entitlements })
  } catch (err) {
    next(err)
  }
})

router.get('/billing/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { entitlements: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ data: plans })
  } catch (err) {
    next(err)
  }
})

export { router as billingRouter }
