import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { createWidgetSession } from '../services/widget-session.service.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import * as bunny from '../services/bunny.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()

// Cap the recording upload at 50 MB — generous for stereo PCM WAV at 24kHz
// (~10 MB per 5 min) while preventing pathological uploads. The widget builds
// stereo WAV at 24kHz × 2ch × 16-bit = 96 KB/s of audio, so 50 MB ≈ 8 min.
const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'audio/wav' && file.mimetype !== 'audio/x-wav') {
      cb(new AppError('VALIDATION_ERROR', 'Recording must be a WAV file', 422))
      return
    }
    cb(null, true)
  },
})

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

// ── Widget call recording upload (Phase E.8) ────────────────────────────────
//
// Public endpoint — called by the widget JS on session end. The visitor's
// browser captures both halves of the conversation as raw PCM, muxes them
// to a stereo 24 kHz WAV, and POSTs the result here. We verify ownership
// against the WidgetSession.token that opened the WebSocket, upload to
// Bunny CDN, and write recordingRef / recordingBunnyPath / size + duration
// onto the matching Conversation row.

router.post(
  '/public/widget/upload-recording',
  recordingUpload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversationId = String((req.body as { conversationId?: string }).conversationId ?? '')
      const sessionToken   = String((req.body as { sessionToken?: string }).sessionToken ?? '')
      if (!conversationId || !sessionToken) {
        throw new AppError('VALIDATION_ERROR', 'conversationId and sessionToken required', 422)
      }
      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'audio file required', 422)
      }

      // Ownership check — the widget session that opened the WS must match
      // the conversation it's now claiming a recording for. Without this any
      // caller with a conversationId UUID could overwrite the recording.
      const session = await prisma.widgetSession.findUnique({
        where:  { token: sessionToken },
        select: { tenantId: true, conversationId: true },
      })
      if (!session || session.conversationId !== conversationId) {
        throw new AppError('FORBIDDEN', 'session/conversation mismatch', 403)
      }

      // Defense against late-arriving duplicate uploads (e.g. browser retry
      // after timeout). If a recording is already attached, accept-and-ignore.
      const existing = await prisma.conversation.findUnique({
        where:  { id: conversationId },
        select: { recordingRef: true, tenantId: true, startedAt: true, endedAt: true },
      })
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Conversation not found', 404)
      }
      if (existing.recordingRef) {
        res.json({ data: { ok: true, alreadyUploaded: true } })
        return
      }

      const config = await bunny.getBunnyConfig()
      if (!config) {
        throw new AppError('NOT_CONFIGURED', 'Recording storage is not configured for this platform', 503)
      }

      const bunnyPath = bunny.buildBunnyPath(session.tenantId, conversationId, 'wav')
      const { url, sizeBytes } = await bunny.uploadRecording(config, bunnyPath, req.file.buffer, 'audio/wav')

      // Compute duration from conversation timestamps where available, else
      // fall back to a sample-count estimate (stereo 24 kHz = 96 KB/sec).
      const durationFromTimes = existing.endedAt && existing.startedAt
        ? Math.max(1, Math.round((existing.endedAt.getTime() - existing.startedAt.getTime()) / 1000))
        : null
      const durationFromBytes = Math.max(1, Math.round(sizeBytes / (24000 * 2 * 2)))
      const durationSecs = durationFromTimes ?? durationFromBytes

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          recordingRef:          url,
          recordingBunnyPath:    bunnyPath,
          recordingSizeBytes:    BigInt(sizeBytes),
          recordingDurationSecs: durationSecs,
          recordingStatus:       'stored',
        },
      })

      // Best-effort storage accounting — never fails the upload.
      bunny.incrementStorageUsed(session.tenantId, sizeBytes).catch(() => {})

      res.json({ data: { ok: true, sizeBytes, durationSecs } })
    } catch (err) { next(err) }
  },
)

export { router as widgetRouter }
