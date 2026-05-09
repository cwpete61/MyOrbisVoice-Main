import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'
import { sendCallNotification } from '../services/email.service.js'
import { streamConversationPdf } from '../services/conversation-pdf.service.js'

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
        outcomeCode: true,
        contact: { select: { firstName: true, lastName: true, email: true, phoneE164: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ])

  res.json({ data: { items, total } })
}))

// GET /api/usage/summary — usage for current billing period (voice + SMS/MMS/WhatsApp)
router.get('/usage/summary', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string

  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const [inbound, outbound, widget] = await Promise.all([
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'INBOUND',  startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true }, _sum: { recordingDurationSecs: true },
    }),
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'OUTBOUND', startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true }, _sum: { recordingDurationSecs: true },
    }),
    prisma.conversation.aggregate({
      where: { tenantId, channelType: 'WIDGET',   startedAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true }, _sum: { recordingDurationSecs: true },
    }),
  ])

  const totalSecs = (inbound._sum.recordingDurationSecs ?? 0)
    + (outbound._sum.recordingDurationSecs ?? 0)
    + (widget._sum.recordingDurationSecs ?? 0)
  const minutesUsed = Math.ceil(totalSecs / 60)

  // Messaging counts — outbound only counts toward overage; inbound is informational
  const [sms, mms, wa] = await Promise.all([
    prisma.messageLog.groupBy({
      by: ['direction'],
      where: { tenantId, channel: 'SMS', createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
    }),
    prisma.messageLog.groupBy({
      by: ['direction'],
      where: { tenantId, channel: 'MMS', createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
    }),
    prisma.messageLog.groupBy({
      by: ['direction'],
      where: { tenantId, channel: 'WHATSAPP', createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { id: true },
    }),
  ])

  const countByDir = (rows: { direction: string; _count: { id: number } }[]) => ({
    sent:     rows.find(r => r.direction === 'OUTBOUND')?._count.id ?? 0,
    received: rows.find(r => r.direction === 'INBOUND')?._count.id ?? 0,
  })
  const smsCounts = countByDir(sms)
  const mmsCounts = countByDir(mms)
  const waCounts  = countByDir(wa)

  // Entitlements — quotas + per-unit overage rates (already merged via TenantEntitlement override → PlanEntitlement)
  const ents = await prisma.tenantEntitlement.findMany({
    where: { tenantId },
    select: { key: true, integerValue: true, booleanValue: true },
  })
  const intVal = (key: string, fallback = 0) =>
    ents.find(e => e.key === key)?.integerValue ?? fallback

  const quotas = {
    voiceMinutes:        intVal('minutes_per_month', 0),
    sms:                 intVal('included_sms_per_month', 0),
    mms:                 intVal('included_mms_per_month', 0),
    whatsapp:            intVal('included_whatsapp_per_month', 0),
  }
  const rates = {
    smsOverageCents:      intVal('sms_overage_per_message_cents', 0),
    mmsOverageCents:      intVal('mms_overage_per_message_cents', 0),
    whatsappOverageCents: intVal('whatsapp_overage_per_message_cents', 0),
    voiceOverageCents:    intVal('voice_overage_per_minute_cents', 0),
  }

  // Apply platform-wide markup (system-settings)
  const markupRow = await prisma.systemConfig.findUnique({ where: { key: 'overage_markup_percent' } })
  const markupPct = Number(markupRow?.value ?? 0) || 0
  const m = (cents: number) => Math.round(cents * (1 + markupPct / 100))

  const smsOver  = Math.max(0, smsCounts.sent - quotas.sms)
  const mmsOver  = Math.max(0, mmsCounts.sent - quotas.mms)
  const waOver   = Math.max(0, waCounts.sent  - quotas.whatsapp)
  const minOver  = Math.max(0, minutesUsed    - quotas.voiceMinutes)

  const overageCharges = {
    smsCents:      smsOver * m(rates.smsOverageCents),
    mmsCents:      mmsOver * m(rates.mmsOverageCents),
    whatsappCents: waOver  * m(rates.whatsappOverageCents),
    voiceCents:    minOver * m(rates.voiceOverageCents),
  }
  const totalOverageCents =
    overageCharges.smsCents + overageCharges.mmsCents +
    overageCharges.whatsappCents + overageCharges.voiceCents

  // 6-month voice history
  const history: { month: string; minutes: number; calls: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    const agg  = await prisma.conversation.aggregate({
      where: { tenantId, startedAt: { gte: from, lt: to } },
      _count: { id: true }, _sum: { recordingDurationSecs: true },
    })
    history.push({
      month:   from.toISOString().slice(0, 7),
      minutes: Math.ceil((agg._sum.recordingDurationSecs ?? 0) / 60),
      calls:   agg._count.id,
    })
  }

  res.json({
    data: {
      periodStart: periodStart.toISOString(),
      minutesUsed,
      minutesQuota: quotas.voiceMinutes || null,
      callCounts: {
        inbound:  inbound._count.id,
        outbound: outbound._count.id,
        widget:   widget._count.id,
        total:    inbound._count.id + outbound._count.id + widget._count.id,
      },
      messaging: {
        sms:      { ...smsCounts, included: quotas.sms,      overage: smsOver, ratePerMessageCents: m(rates.smsOverageCents) },
        mms:      { ...mmsCounts, included: quotas.mms,      overage: mmsOver, ratePerMessageCents: m(rates.mmsOverageCents) },
        whatsapp: { ...waCounts,  included: quotas.whatsapp, overage: waOver,  ratePerMessageCents: m(rates.whatsappOverageCents) },
      },
      voice: {
        included: quotas.voiceMinutes,
        overage:  minOver,
        ratePerMinuteCents: m(rates.voiceOverageCents),
      },
      overageCharges: {
        ...overageCharges,
        totalCents: totalOverageCents,
        markupPct,
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

// PATCH /api/conversations/:id — update tenant-editable fields (outcome tag,
// notes). Lets a tenant disposition a call once they've reviewed it: was
// it a booking? Did the lead qualify? Drives funnel reporting.
router.patch('/conversations/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const { outcomeCode } = z.object({
    outcomeCode: z.string().max(40).nullable().optional(),
  }).parse(req.body)

  const existing = await prisma.conversation.findFirst({ where: { id: req.params.id, tenantId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const updated = await prisma.conversation.update({
    where: { id: existing.id },
    data:  { outcomeCode: outcomeCode ?? null },
  })
  res.json({ data: { ...updated, recordingSizeBytes: updated.recordingSizeBytes != null ? String(updated.recordingSizeBytes) : null } })
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

  await writeAuditLogFromRequest(req, {
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
      // Defense-in-depth: lock the Content-Type the browser uses to what we
      // sent. We only ever stream audio/mpeg from Bunny here.
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const { Readable } = await import('stream')
      const nodeStream = Readable.fromWeb(upstream.body as any)
      nodeStream.pipe(res)
      return
    }
  }

  res.redirect(302, conv.recordingRef)
}))

// GET /api/conversations/:id/export.pdf — full conversation record as a PDF.
// Streams the PDF — never buffers the whole document in memory.
router.get('/conversations/:id/export.pdf', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.currentTenantId as string
  const userId   = (req as any).user?.id as string | undefined
  const conversationId = req.params.id!

  // Pre-flight tenant scope check so we can return a clean 404 BEFORE we
  // start streaming the PDF (once the headers go out we lose the ability
  // to send a structured error response).
  const exists = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    select: { id: true, startedAt: true },
  })
  if (!exists) { res.status(404).json({ error: 'Not found' }); return }

  const dateSlug = exists.startedAt.toISOString().slice(0, 10)
  const filename = `conversation-${conversationId}-${dateSlug}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')

  // Audit log — fire-and-forget, never blocks the export
  writeAuditLogFromRequest(req, {
    tenantId,
    actorType:    userId ? 'USER' : 'SYSTEM',
    actorUserId:  userId,
    action:       'conversation.exported',
    targetType:   'Conversation',
    targetId:     conversationId,
    metadataJson: { format: 'pdf' },
  }).catch(() => { /* non-fatal */ })

  try {
    await streamConversationPdf({ conversationId, tenantId }, res)
  } catch (err) {
    // If headers already went out we can't change status — just end the stream.
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF generation failed' })
      return
    }
    try { res.end() } catch { /* ignore */ }
    console.error('[conversations] PDF export failed:', err)
  }
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
