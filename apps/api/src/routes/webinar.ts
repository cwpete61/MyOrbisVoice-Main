/**
 * MyOrbisWebinar routes.
 *   /api/admin/webinars/*  — platform-admin management + the 3 screens' data.
 *   /api/public/webinar/*  — registration page + attendee engagement events.
 *
 * Admin-hosted for now: every webinar is scoped to the platform tenant
 * (resolved by slug, see getPlatformWebinarTenantId). Web is Prisma-free — it calls these over HTTP.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import {
  createWebinar, listWebinars, getWebinar, updateWebinar, createSession,
  getPublicWebinarBySlug, registerForSession, recordEngagement, bookFromWebinar,
} from '../services/webinar/webinar.service.js'
import { commandMetrics, leadIntelligence, personTimeline, getPlatformWebinarTenantId } from '../services/webinar/metrics.service.js'

const router: IRouter = Router()

// ─── Admin ───────────────────────────────────────────────────────────────────
router.use('/admin/webinars', authenticate, requirePlatformAdmin)

const createSchema = z.object({
  title:         z.string().min(2).max(160),
  titleEs:       z.string().max(160).optional(),
  description:   z.string().max(4000).optional(),
  descriptionEs: z.string().max(4000).optional(),
  vertical:      z.string().max(80).optional(),
})

router.post('/admin/webinars', async (req, res, next) => {
  try {
    const p = createSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await createWebinar({ tenantId: await getPlatformWebinarTenantId(), createdBy: req.user!.id, ...p.data }) })
  } catch (err) { next(err) }
})

router.get('/admin/webinars', async (_req, res, next) => {
  try { res.json({ data: await listWebinars(await getPlatformWebinarTenantId()) }) } catch (err) { next(err) }
})

router.get('/admin/webinars/:id', async (req, res, next) => {
  try { res.json({ data: await getWebinar(await getPlatformWebinarTenantId(), req.params.id) }) } catch (err) { next(err) }
})

const updateSchema = z.object({
  title:         z.string().min(2).max(160).optional(),
  titleEs:       z.string().max(160).nullable().optional(),
  description:   z.string().max(4000).nullable().optional(),
  descriptionEs: z.string().max(4000).nullable().optional(),
  vertical:      z.string().max(80).nullable().optional(),
  coverImageUrl: z.string().url().max(600).nullable().optional(),
  videoAssetRef: z.string().max(300).nullable().optional(),
  status:        z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})
router.patch('/admin/webinars/:id', async (req, res, next) => {
  try {
    const p = updateSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.json({ data: await updateWebinar(await getPlatformWebinarTenantId(), req.params.id, p.data) })
  } catch (err) { next(err) }
})

const sessionSchema = z.object({
  kind:     z.enum(['EVERGREEN', 'JUST_IN_TIME', 'SCHEDULED', 'LIVE']).optional(),
  startsAt: z.string().datetime().optional(),
  timezone: z.string().max(60).optional(),
})
router.post('/admin/webinars/:id/sessions', async (req, res, next) => {
  try {
    const p = sessionSchema.safeParse(req.body)
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Invalid input', 422)
    res.status(201).json({ data: await createSession({
      tenantId: await getPlatformWebinarTenantId(), webinarId: req.params.id,
      kind: p.data.kind, startsAt: p.data.startsAt ? new Date(p.data.startsAt) : null, timezone: p.data.timezone,
    }) })
  } catch (err) { next(err) }
})

// The 3 screens.
router.get('/admin/webinars/:id/command', async (req, res, next) => {
  try { await getWebinar(await getPlatformWebinarTenantId(), req.params.id); res.json({ data: await commandMetrics(req.params.id) }) } catch (err) { next(err) }
})
router.get('/admin/webinars/:id/leads', async (req, res, next) => {
  try { await getWebinar(await getPlatformWebinarTenantId(), req.params.id); res.json({ data: await leadIntelligence(req.params.id) }) } catch (err) { next(err) }
})
router.get('/admin/webinars/person/:personId/timeline', async (req, res, next) => {
  try {
    const webinarId = typeof req.query['webinarId'] === 'string' ? req.query['webinarId'] : undefined
    res.json({ data: await personTimeline(req.params.personId, await getPlatformWebinarTenantId(), webinarId) })
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
