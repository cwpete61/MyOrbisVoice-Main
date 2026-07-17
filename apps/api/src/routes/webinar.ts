/**
 * MyOrbisWebinar routes.
 *   /api/webinars/*        — a tenant manages ITS OWN webinars + the 3 screens' data.
 *   /api/public/webinar/*  — registration page + attendee engagement events (no auth).
 *
 * MULTI-TENANT. Every webinar is scoped to the caller's own tenant, taken from the
 * session (req.user.currentTenantId), exactly like contacts/appointments. It used to be
 * platform-admin-only against one hardcoded tenant, which made it an internal tool
 * rather than a product.
 *
 * Platform staff reach a tenant's webinars the same way they reach any tenant data:
 * POST /api/admin/tenants/:tenantId/impersonate mints a tenant-scoped token
 * (roleKey=tenant_owner, isPlatformRole=false). No bypass here, by design.
 *
 * Web is Prisma-free — it calls these over HTTP.
 */
import { Router, type IRouter, type Request } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import {
  createWebinar, listWebinars, getWebinar, updateWebinar, createSession,
  getPublicWebinarBySlug, registerForSession, recordEngagement, bookFromWebinar,
  assertPublishable,
} from '../services/webinar/webinar.service.js'
import { commandMetrics, leadIntelligence, personTimeline } from '../services/webinar/metrics.service.js'
import { webinarEnabled, canPublishAnotherWebinar, aiCallsRemaining } from '../services/webinar/entitlement.js'

const router: IRouter = Router()

/**
 * The caller's tenant — never optional.
 *
 * The house idiom is `req.user!.currentTenantId!`, but that `!` lies: requireTenantContext
 * lets any isPlatformRole token through WITHOUT a tenantId, so currentTenantId can be null
 * at runtime. Passing that into Prisma as `where: { tenantId: undefined }` makes Prisma DROP
 * the filter and return every tenant's rows — a silent cross-tenant leak. Fail loudly instead.
 * A platform admin who wants tenant data must impersonate (which carries a real tenantId).
 */
function tenantOf(req: Request): string {
  const tenantId = req.user?.currentTenantId
  if (!tenantId) {
    throw new AppError('FORBIDDEN', 'No tenant context — platform staff must impersonate a tenant to manage its webinars', 403)
  }
  return tenantId
}

// ─── Tenant-scoped management ────────────────────────────────────────────────
// NOT under /api/admin on purpose: marketing-kit mounts an adminRouter at '/api/admin'
// with a blanket `authenticate + requirePlatformAdmin` (marketing-kit.ts:51,238) and is
// registered at '/' BEFORE this router, so ANY /api/admin/* path is platform-gated
// before it reaches us. A tenant-facing product cannot live in that namespace.
router.use('/webinars', authenticate, requireTenantContext)

/**
 * NOTE on the URL fields: zod's .url() is NOT a safety check here — it accepts
 * `javascript:alert(1)` because it delegates to the URL parser. These are length/shape
 * checks only; the real validation is parseVideoUrlOrThrow / assertSafeHttpUrl in
 * services/webinar/video.ts, which pin the protocol and the host. Don't be tempted to
 * "simplify" by trusting .url() — see video.test.ts.
 */
const createSchema = z.object({
  title:         z.string().min(2).max(160),
  titleEs:       z.string().max(160).optional(),
  description:   z.string().max(4000).optional(),
  descriptionEs: z.string().max(4000).optional(),
  vertical:      z.string().max(80).optional(),
  videoUrl:      z.string().max(1200).optional(),   // fits a pasted <iframe> blob, not just a URL
  ctaLabel:      z.string().max(60).optional(),
  ctaLabelEs:    z.string().max(60).optional(),
  ctaUrl:        z.string().max(600).optional(),
  resourceUrl:   z.string().max(600).optional(),
})

/**
 * Plan gate on WRITES only — reads stay open so a tenant whose plan lapsed can still
 * see the leads they already paid to generate. Locking someone out of their own data
 * is a way to lose them, not to upsell them.
 */
async function requireWebinarPlan(req: Request): Promise<string> {
  const tenantId = tenantOf(req)
  if (!(await webinarEnabled(tenantId))) {
    throw new AppError('FORBIDDEN', 'MyOrbisWebinar is not included in this plan', 403)
  }
  return tenantId
}

router.post('/webinars', async (req, res, next) => {
  try {
    const tenantId = await requireWebinarPlan(req)
    const p = createSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await createWebinar({ tenantId, createdBy: req.user!.id, ...p.data }) })
  } catch (err) { next(err) }
})

router.get('/webinars', async (req, res, next) => {
  try { res.json({ data: await listWebinars(tenantOf(req)) }) } catch (err) { next(err) }
})

/**
 * Plan usage for the dashboard. Without this a tenant only discovers its limits by
 * hitting a 403 — the caps become visible instead of ambush.
 */
router.get('/webinars/quota', async (req, res, next) => {
  try {
    const tenantId = tenantOf(req)
    const [enabled, active, calls] = await Promise.all([
      webinarEnabled(tenantId),
      canPublishAnotherWebinar(tenantId),
      aiCallsRemaining(tenantId),
    ])
    res.json({ data: {
      enabled,
      activeWebinars: { used: active.used, cap: active.cap },
      aiCalls:        { used: calls.used,  cap: calls.cap },
    } })
  } catch (err) { next(err) }
})

router.get('/webinars/:id', async (req, res, next) => {
  try { res.json({ data: await getWebinar(tenantOf(req), req.params.id) }) } catch (err) { next(err) }
})

const updateSchema = z.object({
  title:         z.string().min(2).max(160).optional(),
  titleEs:       z.string().max(160).nullable().optional(),
  description:   z.string().max(4000).nullable().optional(),
  descriptionEs: z.string().max(4000).nullable().optional(),
  vertical:      z.string().max(80).nullable().optional(),
  coverImageUrl: z.string().url().max(600).nullable().optional(),
  // videoAssetRef is NOT settable directly — it is half of a pair, and a raw ref would
  // skip the parser. Tenants send the URL they pasted; the service derives both columns.
  videoUrl:      z.string().max(1200).nullable().optional(),  // fits a pasted <iframe> blob
  ctaLabel:      z.string().max(60).nullable().optional(),
  ctaLabelEs:    z.string().max(60).nullable().optional(),
  ctaUrl:        z.string().max(600).nullable().optional(),
  resourceUrl:   z.string().max(600).nullable().optional(),
  status:        z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})
router.patch('/webinars/:id', async (req, res, next) => {
  try {
    const tenantId = await requireWebinarPlan(req)
    const p = updateSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)

    // The active-webinar cap bites at PUBLISH, not at create — a draft costs nothing.
    if (p.data.status === 'PUBLISHED') {
      const current = await getWebinar(tenantId, req.params.id)
      if (current.status !== 'PUBLISHED') { // re-publishing an already-live one is free
        const { ok, cap, used } = await canPublishAnotherWebinar(tenantId)
        if (!ok) {
          throw new AppError('FORBIDDEN', `Plan allows ${cap} published webinar${cap === 1 ? '' : 's'} (${used} in use). Upgrade or unpublish one.`, 403)
        }
      }
    }

    // Publishing is two steps on purpose.
    //
    // The readiness check has to run AFTER the content edits land (so "paste the video
    // and publish" in one request works — checking first would reject a patch that
    // supplies the very field it wants). But writing status=PUBLISHED and *then*
    // throwing would put the webinar live while returning a 422 to the caller.
    //
    // So: write the content, check, then flip. A webinar that fails the check keeps the
    // tenant's edits and stays a draft — nothing is lost and nothing half-published.
    if (p.data.status === 'PUBLISHED') {
      await updateWebinar(tenantId, req.params.id, { ...p.data, status: undefined })
      await assertPublishable(tenantId, req.params.id) // throws → still a draft
      res.json({ data: await updateWebinar(tenantId, req.params.id, { status: 'PUBLISHED' }) })
      return
    }

    res.json({ data: await updateWebinar(tenantId, req.params.id, p.data) })
  } catch (err) { next(err) }
})

const sessionSchema = z.object({
  kind:     z.enum(['EVERGREEN', 'JUST_IN_TIME', 'SCHEDULED', 'LIVE']).optional(),
  startsAt: z.string().datetime().optional(),
  timezone: z.string().max(60).optional(),
})
router.post('/webinars/:id/sessions', async (req, res, next) => {
  try {
    const p = sessionSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await createSession({
      tenantId: tenantOf(req), webinarId: req.params.id,
      kind: p.data.kind, startsAt: p.data.startsAt ? new Date(p.data.startsAt) : null, timezone: p.data.timezone,
    }) })
  } catch (err) { next(err) }
})

// The 3 screens.
router.get('/webinars/:id/command', async (req, res, next) => {
  try { await getWebinar(tenantOf(req), req.params.id); res.json({ data: await commandMetrics(req.params.id) }) } catch (err) { next(err) }
})
router.get('/webinars/:id/leads', async (req, res, next) => {
  try { await getWebinar(tenantOf(req), req.params.id); res.json({ data: await leadIntelligence(req.params.id) }) } catch (err) { next(err) }
})
router.get('/webinars/person/:personId/timeline', async (req, res, next) => {
  try {
    const webinarId = typeof req.query['webinarId'] === 'string' ? req.query['webinarId'] : undefined
    res.json({ data: await personTimeline(req.params.personId, tenantOf(req), webinarId) })
  } catch (err) { next(err) }
})

// ─── Public (no auth) ────────────────────────────────────────────────────────
router.get('/public/webinar/:slug', async (req, res, next) => {
  try { res.json({ data: await getPublicWebinarBySlug(req.params.slug) }) } catch (err) { next(err) }
})

const registerSchema = z.object({
  name:      z.string().min(1).max(120),
  email:     z.string().email().max(320),
  phone:     z.string().max(40).optional(),
  locale:    z.enum(['en', 'es']).optional(),
  sessionId: z.string().uuid().optional(),
  // Consent is unticked by default — absent/false means the wall stays up and this
  // person is never auto-dialed or texted. Only an explicit true opens a channel.
  voiceConsent: z.boolean().optional(),
  smsConsent:   z.boolean().optional(),
})
router.post('/public/webinar/:slug/register', async (req, res, next) => {
  try {
    const p = registerSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await registerForSession({ slug: req.params.slug, ...p.data }) })
  } catch (err) { next(err) }
})

// Attendee engagement — watch heartbeats, polls, CTA clicks, questions. Keyed by
// the opaque joinToken issued at registration (no login).
const eventSchema = z.object({
  joinToken: z.string().min(1).max(80),
  type:      z.string().min(1).max(40),
  meta:      z.record(z.unknown()).optional(),
  traceId:   z.string().max(120).optional(),
})
router.post('/public/webinar/event', async (req, res, next) => {
  try {
    const p = eventSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.json({ data: await recordEngagement(p.data) })
  } catch (err) { next(err) }
})

// Booking-first CTA — the attendee books a call from the watch page. Server-
// authoritative: BOOKED is not self-reportable via /event, it's only emitted here
// after a real Appointment exists. Keyed by joinToken, no login (same as /event).
const bookSchema = z.object({
  joinToken:  z.string().min(1).max(80),
  startAt:    z.string().datetime(),
  endAt:      z.string().datetime(),
  timezone:   z.string().min(1).max(64),
  notes:      z.string().max(2000).optional(),
  smsConsent: z.boolean().optional(),
  // Unticked by default — the safe path is the lazy path. Only an explicit true
  // ever opens the voice wall (see bookFromWebinar).
  voiceConsent: z.boolean().optional(),
})
router.post('/public/webinar/book', async (req, res, next) => {
  try {
    const p = bookSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await bookFromWebinar(p.data) })
  } catch (err) { next(err) }
})

export default router
