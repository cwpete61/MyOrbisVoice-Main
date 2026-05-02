import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'
import { writeAuditLog } from '../lib/audit.js'
import { sendCallNotification } from '../services/email.service.js'

const router: IRouter = Router()

router.use(authenticate, requireTenantContext)

const listSchema = z.object({
  channelType: z.enum(['WIDGET', 'INBOUND', 'OUTBOUND']).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  hasRecording: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['startedAt', 'endedAt', 'status']).default('startedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get('/conversations', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const query = listSchema.parse(req.query)

  // Build where clause
  const where: Record<string, unknown> = { tenantId }
  if (query.channelType) where['channelType'] = query.channelType
  if (query.status) where['status'] = query.status
  if (query.hasRecording === 'true')  where['recordingStatus'] = 'stored'
  if (query.hasRecording === 'false') where['recordingStatus'] = { not: 'stored' }
  if (query.dateFrom || query.dateTo) {
    const range: Record<string, Date> = {}
    if (query.dateFrom) range['gte'] = new Date(query.dateFrom)
    if (query.dateTo)   range['lte'] = new Date(query.dateTo)
    where['startedAt'] = range
  }

  // Full-text search across summaryText
  if (query.search) {
    const s = query.search.trim()
    where['OR'] = [
      { summaryText: { contains: s, mode: 'insensitive' } },
      { contact: { OR: [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName:  { contains: s, mode: 'insensitive' } },
        { email:     { contains: s, mode: 'insensitive' } },
        { phoneE164: { contains: s, mode: 'insensitive' } },
      ]}},
    ]
  }

  const orderBy = { [query.sortBy]: query.sortDir }

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy,
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
        contact: { select: { firstName: true, lastName: true, email: true, phoneE164: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ])

  res.json({ data: { items, total } })
}))

// GET /api/usage/summary — phone usage for current billing period
router.get('/usage/summary', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string

  // Current month window
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  // Aggregate conversation counts and call minutes
  const [inbound, outbound, widget] = await Promise.all([
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'INBOUND', startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
      _sum:   { recordingDurationSecs: true },
    }),
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'OUTBOUND', startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
      _sum:   { recordingDurationSecs: true },
    }),
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'WIDGET', startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
      _sum:   { recordingDurationSecs: true },
    }),
  ])

  const totalSecs = (inbound._sum.recordingDurationSecs ?? 0)
    + (outbound._sum.recordingDurationSecs ?? 0)
    + (widget._sum.recordingDurationSecs ?? 0)
  const minutesUsed = Math.ceil(totalSecs / 60)

  // Get quota from entitlements
  const quotaEnt = await prisma.tenantEntitlement.findFirst({
    where: { tenantId, key: 'minutes_per_month' },
    select: { integerValue: true },
  })
  const minutesQuota = quotaEnt?.integerValue ?? null

  // Last 6 months history
  const history: { month: string; minutes: number; calls: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    const agg  = await prisma.conversation.aggregate({
      where: { tenantId, startedAt: { gte: from, lt: to } },
      _count: { id: true },
      _sum:   { recordingDurationSecs: true },
    })
    history.push({
      month: from.toISOString().slice(0, 7),
      minutes: Math.ceil((agg._sum.recordingDurationSecs ?? 0) / 60),
      calls: agg._count.id,
    })
  }

  res.json({
    data: {
      periodStart: periodStart.toISOString(),
      minutesUsed,
      minutesQuota,
      callCounts: {
        inbound:  inbound._count.id,
        outbound: outbound._count.id,
        widget:   widget._count.id,
        total:    inbound._count.id + outbound._count.id + widget._count.id,
      },
      history,
    },
  })
}))

// POST /api/conversations/notify-call — send email notification for a new call (called by gateway)
router.post('/conversations/notify-call', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const { channelType, callerName, callerPhone, conversationId } = z.object({
    channelType:    z.enum(['INBOUND', 'OUTBOUND', 'WIDGET']),
    callerName:     z.string().optional(),
    callerPhone:    z.string().optional(),
    conversationId: z.string().optional(),
  }).parse(req.body)

  const [tenant, profile] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } }),
    prisma.businessProfile.findUnique({ where: { tenantId }, select: { fallbackNotificationEmail: true } }),
  ])

  const notificationEmail = profile?.fallbackNotificationEmail
  if (!notificationEmail) { res.json({ data: { sent: false, reason: 'no_email_configured' } }); return }

  const appBaseUrl = process.env['APP_BASE_URL'] ?? 'https://app.myorbisvoice.com'

  sendCallNotification({
    to: notificationEmail,
    tenantName: tenant?.displayName ?? 'Your workspace',
    callerName,
    callerPhone,
    channelType,
    startedAt: new Date(),
    conversationId: conversationId ?? '',
    appBaseUrl,
  }).catch(err => console.error('[email] call notification failed:', err))

  res.json({ data: { sent: true, to: notificationEmail } })
}))

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id, tenantId },
  })
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ data: { ...conv, recordingSizeBytes: conv.recordingSizeBytes != null ? String(conv.recordingSizeBytes) : null } })
}))

// DELETE /api/conversations — bulk soft-delete by IDs
router.delete('/conversations', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const userId = (req as any).user?.id as string
  const { ids } = z.object({ ids: z.array(z.string()).min(1).max(200) }).parse(req.body)

  // Verify all conversations belong to this tenant before deleting
  const owned = await prisma.conversation.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true },
  })
  const ownedIds = owned.map(c => c.id)

  await prisma.conversation.deleteMany({ where: { id: { in: ownedIds }, tenantId } })

  await writeAuditLog({
    actorType: 'USER',
    actorUserId: userId,
    action: 'conversations.bulk_deleted',
    targetType: 'Conversation',
    metadataJson: { count: ownedIds.length, ids: ownedIds },
  })

  res.json({ data: { deleted: ownedIds.length } })
}))

// GET /api/conversations/:id/recording — proxies audio from Bunny storage
router.get('/conversations/:id/recording', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id!, tenantId },
    select: { recordingBunnyPath: true, recordingRef: true, recordingStatus: true },
  })
  if (!conv?.recordingRef) { res.status(404).json({ error: 'No recording available' }); return }

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
