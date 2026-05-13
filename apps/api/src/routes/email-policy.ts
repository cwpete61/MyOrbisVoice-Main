/**
 * Email policy + suppression routes (Phase F.4).
 *
 * Admin routes (under /api/admin) — full read+write of platform defaults,
 * per-partner overrides, suspension state, and the global suppression list.
 *
 * Partner routes (under /api/partner) — read-only view of resolved limits
 * + per-partner suppression list (add manual unsubs, remove false-positives).
 *
 * ESP webhook routes (under /api/email-webhooks) — public endpoints called
 * by Postmark + Resend. Signature verification is provider-specific; we
 * stub the verifier per provider and reject unsigned payloads.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin, requirePlatformSuperAdmin, requirePartnerContext } from '../middleware/rbac.js'
import {
  getPlatformPolicy, setPlatformPolicy,
  getPartnerPolicy, setPartnerOverrides, setPartnerBulkSuspension,
} from '../services/email-bulk-policy.service.js'
import {
  checkSuppression, addSuppression, removeSuppression, listSuppressions,
} from '../services/email-suppression.service.js'
import { ingestEmailEvent } from '../services/email-webhook.service.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

// ─── Admin: platform-wide defaults ──────────────────────────────────────────

router.get('/admin/email-policy', authenticate, requirePlatformAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await getPlatformPolicy()
    res.json({ data: policy })
  } catch (err) { next(err) }
})

const platformPatchSchema = z.object({
  dailyCap:               z.number().int().min(1).max(100_000).optional(),
  sendWindowStartHour:    z.number().int().min(0).max(23).optional(),
  sendWindowEndHour:      z.number().int().min(0).max(23).optional(),
  dripIntervalSecs:       z.number().int().min(1).max(86_400).optional(),
  bounceAutoPauseRate:    z.number().min(0).max(1).optional(),
  complaintAutoPauseRate: z.number().min(0).max(1).optional(),
  warningBounceRate:      z.number().min(0).max(1).optional(),
  warningComplaintRate:   z.number().min(0).max(1).optional(),
  bulkEvaluationWindow:   z.number().int().min(10).max(10_000).optional(),
})

router.put('/admin/email-policy', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patch = platformPatchSchema.parse(req.body)
    const updated = await setPlatformPolicy(patch, req.user!.id)
    await writeAuditLog({
      actorType:   'ADMIN',
      actorUserId: req.user!.id,
      action:     'admin.email_policy.updated',
      targetType: 'EmailPolicy',
      targetId:   'platform',
      metadataJson: patch as Record<string, unknown>,
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ─── Admin: per-partner overrides + suspension ──────────────────────────────

router.get('/admin/partners/:id/email-policy', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await getPartnerPolicy(req.params.id!)
    if (!policy) throw new AppError('NOT_FOUND', 'Partner not found', 404)
    // Surface the raw stored override values too so the admin UI can show
    // null-as-"inherit" and value-as-"override". The resolved view above
    // already merged platform defaults in.
    const raw = await prisma.affiliateAccount.findUnique({
      where:  { id: req.params.id! },
      select: {
        emailBulkEnabled: true,
        emailDailyCap: true,
        emailSendWindowStartHour: true,
        emailSendWindowEndHour: true,
        emailDripIntervalSecs: true,
        emailBulkSuspendedAt: true,
        emailBulkSuspendedReason: true,
      },
    })
    res.json({ data: { resolved: policy, overrides: raw } })
  } catch (err) { next(err) }
})

const partnerPatchSchema = z.object({
  bulkEnabled:          z.boolean().optional(),
  dailyCap:             z.number().int().min(1).max(100_000).nullable().optional(),
  sendWindowStartHour:  z.number().int().min(0).max(23).nullable().optional(),
  sendWindowEndHour:    z.number().int().min(0).max(23).nullable().optional(),
  dripIntervalSecs:     z.number().int().min(1).max(86_400).nullable().optional(),
})

router.put('/admin/partners/:id/email-policy', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.params.id!
    const patch = partnerPatchSchema.parse(req.body)
    await setPartnerOverrides({ partnerId, patch })
    await writeAuditLog({
      actorType:   'ADMIN',
      actorUserId: req.user!.id,
      action:     'admin.partner_email_policy.updated',
      targetType: 'AffiliateAccount',
      targetId:   partnerId,
      metadataJson: patch as Record<string, unknown>,
    })
    const updated = await getPartnerPolicy(partnerId)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

router.post('/admin/partners/:id/email-suspend', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.params.id!
    const { suspended, reason } = z.object({
      suspended: z.boolean(),
      reason:    z.string().max(500).optional(),
    }).parse(req.body)
    await setPartnerBulkSuspension({ partnerId, suspended, reason })
    await writeAuditLog({
      actorType:   'ADMIN',
      actorUserId: req.user!.id,
      action:     suspended ? 'admin.partner_email.suspended' : 'admin.partner_email.unsuspended',
      targetType: 'AffiliateAccount',
      targetId:   partnerId,
      metadataJson: { reason: reason ?? null },
    })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ─── Admin: global suppression list ─────────────────────────────────────────

router.get('/admin/email-suppression', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit, offset, scope } = req.query as Record<string, string>
    const opts: Parameters<typeof listSuppressions>[0] = {
      query:  query ?? undefined,
      limit:  limit  ? parseInt(limit, 10)  : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    }
    // scope=global filters to platform-wide entries (no tenant or partner).
    // No scope = admin sees everything (global + per-tenant + per-partner).
    if (scope === 'global') {
      opts.tenantId = null
    }
    const result = await listSuppressions(opts)
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.post('/admin/email-suppression', authenticate, requirePlatformSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, reason, note, tenantId, partnerId } = z.object({
      email:     z.string().email(),
      reason:    z.enum(['HARD_BOUNCE', 'COMPLAINT', 'UNSUBSCRIBE', 'MANUAL', 'SOFT_BOUNCE_REPEATED']),
      note:      z.string().max(500).optional(),
      tenantId:  z.string().nullable().optional(),
      partnerId: z.string().nullable().optional(),
    }).parse(req.body)
    const out = await addSuppression({ email, reason, note, tenantId, partnerId })
    res.status(out.created ? 201 : 200).json({ data: out })
  } catch (err) { next(err) }
})

router.delete('/admin/email-suppression/:id', authenticate, requirePlatformSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await removeSuppression({ id: req.params.id! })
    if (count === 0) throw new AppError('NOT_FOUND', 'Suppression not found', 404)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ─── Partner: read-only resolved policy + their suppression list ─────────────

router.get('/partner/email-policy', authenticate, requirePartnerContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const policy = await getPartnerPolicy(partnerId)
    if (!policy) throw new AppError('NOT_FOUND', 'Partner not found', 404)
    res.json({ data: policy })
  } catch (err) { next(err) }
})

router.get('/partner/email-suppression', authenticate, requirePartnerContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { query, limit, offset } = req.query as Record<string, string>
    const result = await listSuppressions({
      partnerId,
      query:  query ?? undefined,
      limit:  limit  ? parseInt(limit, 10)  : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    })
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.post('/partner/email-suppression', authenticate, requirePartnerContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { email, note } = z.object({
      email: z.string().email(),
      note:  z.string().max(500).optional(),
    }).parse(req.body)
    const out = await addSuppression({ email, reason: 'MANUAL', note, partnerId })
    res.status(out.created ? 201 : 200).json({ data: out })
  } catch (err) { next(err) }
})

router.delete('/partner/email-suppression/:id', authenticate, requirePartnerContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    // Scope the delete so a partner can only remove their own entries.
    // Hard bounces (global) and complaints from a different partner are
    // not touchable here.
    const count = await removeSuppression({ id: req.params.id!, partnerId })
    if (count === 0) throw new AppError('NOT_FOUND', 'Suppression not found', 404)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ─── ESP webhooks ───────────────────────────────────────────────────────────
// Signature verification is provider-specific. Both providers sign the raw
// request body; the route must therefore have access to the raw bytes. The
// JSON parser in index.ts is already configured with a `verify` hook that
// stashes the raw body on (req as any).rawBody — Twilio webhooks rely on
// this pattern. Reusing it here.

function verifyPostmark(req: Request): boolean {
  // Postmark uses HTTP Basic auth as its webhook auth model (no payload
  // signature). The configured username:password pair is stored in
  // SystemConfig under postmark.webhook.basic_auth. Empty config = accept
  // any (dev-mode) — flagged in startup logs.
  const expected = process.env['POSTMARK_WEBHOOK_BASIC_AUTH']
  if (!expected) return true  // dev mode: accept
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Basic ')) return false
  const presented = Buffer.from(auth.slice(6), 'base64').toString('utf8')
  // Constant-time compare to avoid timing side-channel.
  if (presented.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected))
}

function verifyResend(req: Request): boolean {
  // Resend signs the body with Svix (X-Svix-Signature header). Verification
  // requires the raw body. When RESEND_WEBHOOK_SECRET is unset we accept
  // anything (dev mode).
  const secret = process.env['RESEND_WEBHOOK_SECRET']
  if (!secret) return true
  const sig    = req.headers['svix-signature']        as string | undefined
  const id     = req.headers['svix-id']               as string | undefined
  const ts     = req.headers['svix-timestamp']        as string | undefined
  const rawBody = (req as any).rawBody as Buffer | string | undefined
  if (!sig || !id || !ts || !rawBody) return false

  const toSign = `${id}.${ts}.${rawBody.toString()}`
  const expected = 'v1,' + crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
    .update(toSign).digest('base64')
  // Svix sig header can have multiple signatures space-separated; any match wins.
  return sig.split(' ').some(s => {
    const a = Buffer.from(s)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
}

// Postmark sends one event per request. RecordType tells us what it is.
// https://postmarkapp.com/developer/webhooks/webhooks-overview
router.post('/email-webhooks/postmark', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyPostmark(req)) throw new AppError('UNAUTHORIZED', 'Invalid webhook auth', 401)

    const body = req.body as any
    const recordType = body?.RecordType as string | undefined
    const recipient  = (body?.Email ?? body?.Recipient) as string | undefined
    const providerMessageId = body?.MessageID as string | undefined
    if (!recipient || !providerMessageId) {
      res.status(200).json({ ok: true, ignored: 'missing_fields' })
      return
    }

    let event: Parameters<typeof ingestEmailEvent>[0]['event'] | null = null
    if (recordType === 'Bounce') {
      const type = (body?.Type as string)?.toLowerCase() ?? ''
      // Postmark types: HardBounce, SoftBounce, Transient, BadEmailAddress…
      const bounceType: 'hard' | 'soft' = type.includes('hard') || type === 'bademailaddress' ? 'hard' : 'soft'
      event = { kind: 'bounce', bounceType, reason: body?.Description }
    } else if (recordType === 'SpamComplaint') {
      event = { kind: 'complaint', reason: body?.Description }
    } else if (recordType === 'Delivery') {
      event = { kind: 'delivered' }
    }

    if (event) await ingestEmailEvent({ providerMessageId, recipient, event })
    res.status(200).json({ ok: true })
  } catch (err) { next(err) }
})

// Brevo doesn't sign webhooks. Optional defense: filter by source IP (Brevo
// publishes its IP ranges) or use a secret URL path. For now accept all —
// the worst-case attack is forced suppression-list growth, which is
// recoverable. Set BREVO_WEBHOOK_SECRET to require a matching `?secret=...`
// query param for an additional gate.
function verifyBrevo(req: Request): boolean {
  const required = process.env['BREVO_WEBHOOK_SECRET']
  if (!required) return true
  const provided = (req.query['secret'] as string) ?? ''
  if (provided.length !== required.length) return false
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(required))
}

// Brevo webhook payload is single-event with snake_case-ish field names.
// https://developers.brevo.com/docs/transactional-webhooks
// Event names: hardBounce, softBounce, delivered, spam, unsubscribed,
// blocked, invalid (we map blocked + invalid → hard bounce, spam → complaint).
router.post('/email-webhooks/brevo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyBrevo(req)) throw new AppError('UNAUTHORIZED', 'Invalid webhook auth', 401)

    const body = req.body as any
    // Brevo's event name is inconsistent across docs vs reality — webhook docs
    // say `hardBounce`, stats API uses `hardBounces`, some legacy threads
    // mention `hard_bounce`. Normalize all three forms to a single token.
    const rawEvent = String(body?.event ?? '').replace(/_/g, '').toLowerCase()
    const recipient = (body?.email ?? '') as string
    // Brevo's "message-id" header is the SMTP Message-Id (rfc822) with angle
    // brackets — `<id@smtp-relay.mailin.fr>`. We strip them so it matches what
    // we'd store on MessageLog.providerMessageId at send time.
    const rawMsgId = (body?.['message-id'] ?? body?.message_id ?? '') as string
    const providerMessageId = rawMsgId.replace(/^<|>$/g, '')

    // F.4 — log every Brevo webhook hit so we can see the payload shape
    // during the initial wire-up. Drop this log after the first week of
    // real traffic confirms event names + headers are stable.
    console.log('[brevo-webhook]', JSON.stringify({
      rawEvent, recipient, providerMessageId,
      bodyKeys: Object.keys(body ?? {}),
    }))

    if (!recipient || !providerMessageId) {
      res.status(200).json({ ok: true, ignored: 'missing_fields' })
      return
    }

    let event: Parameters<typeof ingestEmailEvent>[0]['event'] | null = null
    if (rawEvent === 'hardbounce' || rawEvent === 'hardbounces' || rawEvent === 'blocked' || rawEvent === 'invalid') {
      event = { kind: 'bounce', bounceType: 'hard', reason: body?.reason }
    } else if (rawEvent === 'softbounce' || rawEvent === 'softbounces' || rawEvent === 'deferred') {
      event = { kind: 'bounce', bounceType: 'soft', reason: body?.reason }
    } else if (rawEvent === 'spam' || rawEvent === 'complaint') {
      event = { kind: 'complaint', reason: body?.reason }
    } else if (rawEvent === 'unsubscribed' || rawEvent === 'unsubscribe') {
      event = { kind: 'unsubscribe', reason: body?.reason }
    } else if (rawEvent === 'delivered') {
      event = { kind: 'delivered' }
    }

    if (event) await ingestEmailEvent({ providerMessageId, recipient, event })
    res.status(200).json({ ok: true })
  } catch (err) { next(err) }
})

// Resend can send a single event or batched events. Normalize to an array.
// https://resend.com/docs/dashboard/webhooks/event-types
router.post('/email-webhooks/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyResend(req)) throw new AppError('UNAUTHORIZED', 'Invalid webhook signature', 401)
    const events: any[] = Array.isArray(req.body) ? req.body : [req.body]
    for (const e of events) {
      const type = e?.type as string | undefined
      const data = e?.data ?? {}
      const recipient = Array.isArray(data?.to) ? data.to[0] : data?.to
      const providerMessageId = data?.email_id ?? data?.id
      if (!recipient || !providerMessageId) continue

      let event: Parameters<typeof ingestEmailEvent>[0]['event'] | null = null
      if (type === 'email.bounced') {
        const subType = (data?.bounce?.type as string ?? '').toLowerCase()
        const bounceType: 'hard' | 'soft' = subType === 'hard' ? 'hard' : 'soft'
        event = { kind: 'bounce', bounceType, reason: data?.bounce?.message }
      } else if (type === 'email.complained') {
        event = { kind: 'complaint', reason: data?.complaint?.feedback_type }
      } else if (type === 'email.delivered') {
        event = { kind: 'delivered' }
      }
      if (event) await ingestEmailEvent({ providerMessageId: String(providerMessageId), recipient: String(recipient), event })
    }
    res.status(200).json({ ok: true })
  } catch (err) { next(err) }
})

// ─── Check-suppression utility — useful for the bulk worker preflight ───────
router.post('/admin/email-suppression/check', authenticate, requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, kind, tenantId, partnerId } = z.object({
      email:     z.string().email(),
      kind:      z.enum(['transactional', 'marketing']).default('marketing'),
      tenantId:  z.string().nullable().optional(),
      partnerId: z.string().nullable().optional(),
    }).parse(req.body)
    const hit = await checkSuppression({ email, kind, tenantId: tenantId ?? null, partnerId: partnerId ?? null })
    res.json({ data: hit })
  } catch (err) { next(err) }
})

export default router
