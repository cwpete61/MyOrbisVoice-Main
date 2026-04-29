import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { createWidgetSession } from '../services/widget-session.service.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

// Public endpoint — called by the embedded widget JS on the visitor's browser.
// Uses the tenant's public widget key (channelConfig.publicKey) to identify the tenant.
router.post('/public/widget/session', asyncHandler(async (req, res) => {
  const { publicKey } = req.body as { publicKey?: string }
  if (!publicKey) { res.status(400).json({ error: 'publicKey required' }); return }

  const channel = await prisma.channelConfig.findFirst({
    where: { publicKey, channelType: 'WIDGET', isEnabled: true },
  })

  if (!channel) { res.status(404).json({ error: 'Widget not found or disabled' }); return }

  const result = await createWidgetSession(channel.tenantId, {
    remoteIp: req.ip,
    userAgent: req.headers['user-agent'],
  })

  res.json({ data: result })
}))

// Authenticated endpoint — dashboard can also create a test session
router.post('/widget/session', authenticate, requireTenantContext, asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const result = await createWidgetSession(tenantId, {
    remoteIp: req.ip,
    userAgent: req.headers['user-agent'],
  })
  res.json({ data: result })
}))

export { router as widgetRouter }
