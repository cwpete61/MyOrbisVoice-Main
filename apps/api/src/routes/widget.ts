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

// Authenticated endpoint — dashboard creates a live session
router.post('/widget/session', authenticate, requireTenantContext, asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const result = await createWidgetSession(tenantId, {
    remoteIp: req.ip,
    userAgent: req.headers['user-agent'],
  })
  res.json({ data: result })
}))

// Draft test-session — carries ephemeral config (voiceName, avatarId) without saving to DB.
// Gateway reads draftConfig from the session record and uses it instead of channel config.
router.post('/widget/draft-session', authenticate, requireTenantContext, asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const { voiceName, avatarId, channelType } = req.body as {
    voiceName?: string
    avatarId?: string
    channelType?: string
  }
  const result = await createWidgetSession(tenantId, {
    remoteIp: req.ip,
    userAgent: req.headers['user-agent'],
    draftConfig: { voiceName: voiceName ?? null, avatarId: avatarId ?? null, channelType: channelType ?? 'WIDGET', isDraft: true },
  })
  res.json({ data: result })
}))

export { router as widgetRouter }
