import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { prisma } from '../lib/prisma.js'
import * as partnerService from '../services/partner.service.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'

/**
 * Partner Mailbox routes — Inbox / Sent / Compose / detail view.
 *
 * All endpoints scoped to the authenticated partner's AffiliateAccount.id
 * (resolved by requirePartnerContext middleware which attaches partnerAccountId
 * to req). Partners can only see + send their own email; no cross-partner reads.
 */

const router: IRouter = Router()
router.use('/partner/mailbox', authenticate, requirePartnerContext)

// Shape for inbox/sent list items — trimmed for fast list rendering
const listSelect = {
  id:            true,
  direction:     true,
  fromAddress:   true,
  toAddresses:   true,
  subject:       true,
  textBody:      true,        // first chars used for the preview snippet
  threadId:      true,
  readAt:        true,
  receivedAt:    true,
  sentAt:        true,
  createdAt:     true,
  deliveryStatus: true,
} as const

// ─── GET /api/partner/mailbox ───────────────────────────────────────────────
// Combined dashboard view: counts + the 5 most recent of each direction
router.get('/partner/mailbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const [unreadCount, totalInbox, totalSent, recentInbox, recentSent] = await Promise.all([
      prisma.email.count({ where: { partnerId, direction: 'INBOUND', readAt: null } }),
      prisma.email.count({ where: { partnerId, direction: 'INBOUND' } }),
      prisma.email.count({ where: { partnerId, direction: 'OUTBOUND' } }),
      prisma.email.findMany({
        where: { partnerId, direction: 'INBOUND' },
        select: listSelect,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.email.findMany({
        where: { partnerId, direction: 'OUTBOUND' },
        select: listSelect,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])
    res.json({
      data: {
        counts: { unread: unreadCount, inboxTotal: totalInbox, sentTotal: totalSent },
        recentInbox,
        recentSent,
      },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/mailbox/inbox?cursor&limit ────────────────────────────
const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
})

router.get('/partner/mailbox/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { cursor, limit } = listQuerySchema.parse(req.query)
    const emails = await prisma.email.findMany({
      where: { partnerId, direction: 'INBOUND' },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore   = emails.length > limit
    const items     = hasMore ? emails.slice(0, limit) : emails
    const nextCursor = hasMore ? items[items.length - 1]!.id : null
    res.json({ data: { items, nextCursor } })
  } catch (err) { next(err) }
})

router.get('/partner/mailbox/sent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { cursor, limit } = listQuerySchema.parse(req.query)
    const emails = await prisma.email.findMany({
      where: { partnerId, direction: 'OUTBOUND' },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore   = emails.length > limit
    const items     = hasMore ? emails.slice(0, limit) : emails
    const nextCursor = hasMore ? items[items.length - 1]!.id : null
    res.json({ data: { items, nextCursor } })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/mailbox/search?q&cursor&limit ─────────────────────────
// Case-insensitive substring search across subject, fromAddress, and textBody.
// Returns inbox + sent results mixed, newest first. JSON `toAddresses` is not
// covered yet (Prisma can't ILIKE a Json column without raw SQL); we'll add a
// raw fallback if recipient-only searches become a real need.
const searchQuerySchema = z.object({
  q:      z.string().min(2).max(200),
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
})

router.get('/partner/mailbox/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = searchQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'q must be 2–200 chars', 422)
    }
    const { q, cursor, limit } = parsed.data
    const emails = await prisma.email.findMany({
      where: {
        partnerId,
        OR: [
          { subject:     { contains: q, mode: 'insensitive' } },
          { fromAddress: { contains: q, mode: 'insensitive' } },
          { textBody:    { contains: q, mode: 'insensitive' } },
        ],
      },
      select:  listSelect,
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore    = emails.length > limit
    const items      = hasMore ? emails.slice(0, limit) : emails
    const nextCursor = hasMore ? items[items.length - 1]!.id : null
    res.json({ data: { items, nextCursor, query: q } })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/mailbox/emails/:id ────────────────────────────────────
// Full email body, no truncation. Auto-marks INBOUND emails read on first load.
router.get('/partner/mailbox/emails/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const email = await prisma.email.findFirst({
      where: { id: req.params['id'], partnerId },
    })
    if (!email) throw new AppError('NOT_FOUND', 'Email not found', 404)

    // Mark INBOUND as read on first detail-view fetch
    if (email.direction === 'INBOUND' && !email.readAt) {
      await prisma.email.update({
        where: { id: email.id },
        data:  { readAt: new Date() },
      })
      email.readAt = new Date()
    }
    res.json({ data: email })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/mailbox/threads/:threadId ─────────────────────────────
// Returns every email in this thread (both directions), oldest → newest, for
// the conversation panel in the detail page. Partner-scoped.
router.get('/partner/mailbox/threads/:threadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const threadId = req.params['threadId']
    if (!threadId) throw new AppError('VALIDATION_ERROR', 'threadId required', 422)
    const emails = await prisma.email.findMany({
      where:   { partnerId, threadId },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ data: { emails } })
  } catch (err) { next(err) }
})

// ─── POST /api/partner/mailbox/compose ──────────────────────────────────────
const composeSchema = z.object({
  to:        z.union([z.string().email(), z.array(z.string().email()).min(1).max(10)]),
  subject:   z.string().min(1).max(200),
  html:      z.string().min(1).max(100_000).optional(),
  text:      z.string().min(1).max(100_000).optional(),
  inReplyTo: z.string().optional(),
  threadId:  z.string().uuid().optional(),
}).refine(d => d.html || d.text, { message: 'Provide html or text (or both)' })

router.post('/partner/mailbox/compose', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = composeSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fieldErrors)
    }

    const { to, subject, html, text, inReplyTo, threadId } = parsed.data
    const htmlBody = html ?? `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text!)}</pre>`

    const result = await partnerService.sendPartnerEmail(partnerId, {
      to, subject, html: htmlBody, text, inReplyTo, threadId,
    })

    writeAuditLog({
      actorType:    'USER',
      actorUserId:  req.user!.id,
      action:       'partner.email.sent',
      targetType:   'Email',
      targetId:     result.emailId,
      metadataJson: {
        to:      Array.isArray(to) ? to : [to],
        subject,
        inReplyTo: inReplyTo ?? null,
      },
    }).catch(e => console.error('[audit] partner.email.sent write failed:', e))

    res.json({ data: result })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/mailbox/templates ─────────────────────────────────────
// Lists every template available to this partner: system-seeded templates +
// any custom templates the partner has created. Sorted by sortOrder.
router.get('/partner/mailbox/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const templates = await prisma.emailTemplate.findMany({
      where: {
        OR: [
          { isSystem: true },        // platform-seeded library
          { partnerId },             // partner's custom templates
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, category: true, name: true, description: true,
        subject: true, bodyHtml: true, isSystem: true, sortOrder: true,
      },
    })
    res.json({ data: { templates } })
  } catch (err) { next(err) }
})

// ─── PATCH /api/partner/mailbox/emails/:id/read ─────────────────────────────
router.patch('/partner/mailbox/emails/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const body = z.object({ read: z.boolean() }).safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 'Body: { read: boolean }', 422)

    const updated = await prisma.email.updateMany({
      where: { id: req.params['id'], partnerId, direction: 'INBOUND' },
      data:  { readAt: body.data.read ? new Date() : null },
    })
    if (updated.count === 0) throw new AppError('NOT_FOUND', 'Email not found or not inbound', 404)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;'
  ))
}

export default router
