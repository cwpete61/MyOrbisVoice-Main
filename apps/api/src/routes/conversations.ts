import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'

const router: IRouter = Router()

router.use(authenticate, requireTenantContext)

const listSchema = z.object({
  channelType: z.enum(['WIDGET', 'INBOUND', 'OUTBOUND']).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get('/conversations', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const query = listSchema.parse(req.query)

  const where = {
    tenantId,
    ...(query.channelType ? { channelType: query.channelType } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        channelType: true,
        direction: true,
        status: true,
        startedAt: true,
        endedAt: true,
        summaryText: true,
        transcriptRef: true,
        transcriptJson: true,
        recordingStatus: true,
        contact: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ])

  res.json({ data: { items, total } })
}))

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id, tenantId },
  })
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { ...conv, recordingSizeBytes: conv.recordingSizeBytes != null ? String(conv.recordingSizeBytes) : null } })
}))

// GET /api/conversations/:id/recording — proxies audio from Bunny storage
router.get('/conversations/:id/recording', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id!, tenantId },
    select: { recordingBunnyPath: true, recordingRef: true, recordingStatus: true },
  })
  if (!conv?.recordingRef) { res.status(404).json({ error: 'No recording available' }); return }

  // If stored on Bunny, proxy audio directly from storage zone (bypasses CDN auth requirements)
  if (conv.recordingBunnyPath) {
    const config = await getBunnyConfig()
    if (config) {
      const host = storageHostForRegion(config.storageRegion)
      const storageUrl = `https://${host}/${config.storageZone}/${conv.recordingBunnyPath}`
      const upstream = await fetch(storageUrl, {
        headers: { AccessKey: config.storagePassword },
      })
      if (!upstream.ok) { res.status(404).json({ error: 'Recording file not found' }); return }
      res.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'audio/mpeg')
      const cl = upstream.headers.get('Content-Length')
      if (cl) res.setHeader('Content-Length', cl)
      res.setHeader('Accept-Ranges', 'bytes')
      const { Readable } = await import('stream')
      const nodeStream = Readable.fromWeb(upstream.body as any)
      nodeStream.pipe(res)
      return
    }
  }

  // Fallback: redirect to stored ref (Twilio-hosted or CDN URL)
  res.redirect(302, conv.recordingRef)
}))

// GET /api/conversations/:id/transcript — structured transcript JSON
router.get('/conversations/:id/transcript', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id!, tenantId },
    select: { transcriptJson: true, summaryText: true },
  })
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { transcript: conv.transcriptJson, summary: conv.summaryText } })
}))

export default router
