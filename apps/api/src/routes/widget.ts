import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { createWidgetSession } from '../services/widget-session.service.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

// Public endpoint — called by the embedded widget JS on the visitor's browser.
// Uses the tenant's public widget key (channelConfig.publicKey) to identify the tenant.
// Optional partnerSlug ties the session to a specific Partner record — the gateway
// then injects "you are demoing for <Partner>" into the agent's prompt context.
router.post('/public/widget/session', asyncHandler(async (req, res) => {
  const { publicKey, partnerSlug } = req.body as { publicKey?: string; partnerSlug?: string }
  if (!publicKey) { res.status(400).json({ error: 'publicKey required' }); return }

  const channel = await prisma.channelConfig.findFirst({
    where: { publicKey, channelType: 'WIDGET', isEnabled: true },
  })

  if (!channel) { res.status(404).json({ error: 'Widget not found or disabled' }); return }

  const result = await createWidgetSession(channel.tenantId, {
    remoteIp: req.ip,
    userAgent: req.headers['user-agent'],
    partnerSlug: typeof partnerSlug === 'string' && partnerSlug.length > 0 ? partnerSlug : undefined,
  })

  res.json({ data: result })
}))

// Public endpoint — partner page hydration. Returns the public-safe slice of a
// Partner record for rendering /p/<slug>/ pages with the partner's avatar, name,
// bio, etc. No auth required — the partner page is itself public.
router.get('/public/partner/:slug', asyncHandler(async (req, res) => {
  const slug = req.params['slug']
  if (!slug) { res.status(400).json({ error: 'slug required' }); return }

  const partner = await prisma.affiliateAccount.findUnique({
    where: { slug },
    select: {
      slug:              true,
      displayName:       true,
      avatarUrl:         true,
      bio:               true,
      partnerPhone:      true,
      businessName:      true,
      partnerPageActive: true,
      user:              { select: { firstName: true, lastName: true } },
    },
  })

  if (!partner || !partner.partnerPageActive) {
    res.status(404).json({ error: 'Partner page not found' })
    return
  }

  res.json({
    data: {
      slug:         partner.slug,
      firstName:    partner.user.firstName ?? '',
      lastName:     partner.user.lastName  ?? '',
      displayName:  partner.displayName ?? (`${partner.user.firstName ?? ''} ${partner.user.lastName ?? ''}`.trim() || partner.slug),
      businessName: partner.businessName,
      partnerEmail: `${partner.slug}@myorbisresults.com`,
      partnerPhone: partner.partnerPhone,
      avatarUrl:    partner.avatarUrl,
      bio:          partner.bio,
    },
  })
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
