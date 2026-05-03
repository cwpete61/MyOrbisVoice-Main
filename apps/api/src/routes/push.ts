/**
 * Web Push routes — subscribe, unsubscribe, fetch VAPID public key, test send.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import * as pushService from '../services/push.service.js'

const router: IRouter = Router()

// Public — browsers fetch the VAPID public key before they can subscribe.
// (Mounted on its own subpath router with NO auth middleware so it cannot be
// accidentally gated by anything declared below.)
const publicRouter: IRouter = Router()
publicRouter.get('/vapid-public-key', asyncHandler(async (_req, res) => {
  const key = await pushService.getVapidPublicKey()
  if (!key) {
    res.status(503).json({ errors: [{ code: 'NOT_CONFIGURED', message: 'Push notifications not yet configured on this platform' }] })
    return
  }
  res.json({ data: { publicKey: key } })
}))
router.use('/push', publicRouter)

// Auth-gated subscribe / unsubscribe / test routes — run after the public
// vapid-public-key handler above.
router.use('/push', authenticate, requireTenantContext)

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
})

router.post('/push/subscribe', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const userId   = req.user!.id
  const { endpoint, keys } = subscribeSchema.parse(req.body)
  const userAgent = req.headers['user-agent'] ?? null

  const sub = await prisma.pushSubscription.upsert({
    where:  { endpoint },
    create: { tenantId, userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { tenantId, userId, p256dh: keys.p256dh, auth: keys.auth, userAgent, lastUsedAt: new Date() },
  })

  res.status(201).json({ data: { id: sub.id } })
}))

router.delete('/push/subscriptions/:id', asyncHandler(async (req, res) => {
  const userId = req.user!.id
  const id     = req.params['id']!
  const sub = await prisma.pushSubscription.findFirst({ where: { id, userId } })
  if (sub) {
    await prisma.pushSubscription.delete({ where: { id } })
  }
  res.sendStatus(204)
}))

// Convenience for the Enable-notifications flow — fires a test notification
// to whoever is calling. Used to verify permission + subscription end-to-end.
router.post('/push/test', asyncHandler(async (req, res) => {
  const userId = req.user!.id
  const result = await pushService.sendToUser(userId, {
    title: 'OrbisVoice notifications are on',
    body:  'You will be notified here when calls come in. Tap to open the dashboard.',
    url:   '/conversations',
    tag:   'test',
  })
  res.json({ data: result })
}))

export default router
