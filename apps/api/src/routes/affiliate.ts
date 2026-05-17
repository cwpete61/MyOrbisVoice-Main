import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as affiliateService from '../services/affiliate.service.js'
import * as leadEngineService from '../services/lead-engine.service.js'

const router: IRouter = Router()

// ── Affiliate-portal routes (USER-scoped, not tenant-scoped) ──────────────────
// All endpoints below operate on req.user.id and the affiliate account that
// belongs to that user. Affiliates do NOT have a tenant — they're standalone
// users who refer prospects. So requireTenantContext is wrong here; just
// authenticate is correct.
//
// Naming `tenantRouter` is historical — kept only so the mounting paths below
// don't churn. The router itself is user-scoped.
const tenantRouter: IRouter = Router()
tenantRouter.use(authenticate)

tenantRouter.post('/affiliate/apply', async (req, res, next) => {
  try { res.json({ data: await affiliateService.applyForAffiliate(req.user!.id) }) } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/account', async (req, res, next) => {
  try { res.json({ data: (await affiliateService.getAffiliateAccount(req.user!.id)) ?? null }) } catch (err) { next(err) }
})

tenantRouter.patch('/affiliate/payout-method', async (req, res, next) => {
  try { res.json({ data: await affiliateService.updatePayoutMethod(req.user!.id, req.body as Record<string, unknown>) }) } catch (err) { next(err) }
})

// Marketing voice intensity — see docs/marketing-style-guide.md
tenantRouter.patch('/affiliate/aggression-tier', async (req, res, next) => {
  try {
    const { tier } = req.body as { tier?: string }
    res.json({ data: await affiliateService.updateAggressionTier(req.user!.id, tier as never) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/link', async (req, res, next) => {
  try { res.json({ data: await affiliateService.getReferralLink(req.user!.id) }) } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/stats', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.getAffiliateStats(account.id) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/stats/period', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const days = Math.max(1, Math.min(365, parseInt((req.query as Record<string, string>).days ?? '30', 10) || 30))
    res.json({ data: await affiliateService.getPeriodStats(account.id, days) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/stats/daily', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const days = parseInt((req.query as Record<string, string>).days ?? '30', 10)
    const [clicks, conversions] = await Promise.all([
      affiliateService.getDailyClickStats(account.id, days),
      affiliateService.getDailyConversionStats(account.id, days),
    ])
    res.json({ data: { clicks, conversions } })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/commissions', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const { page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.getCommissions(account.id, parseInt(page ?? '1', 10), parseInt(limit ?? '20', 10)) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/clicks', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.getRecentClicks(account.id) })
  } catch (err) { next(err) }
})

// All referrals — paid OR free. The /commissions endpoint above only returns
// rows with an actual commission; this one returns every conversion, so a
// partner can see "5 signups, 2 paid" instead of "0 conversions" when their
// referrals are all on the free tier.
tenantRouter.get('/affiliate/referrals', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const limit = Math.max(1, Math.min(500, parseInt((req.query as Record<string, string>).limit ?? '100', 10) || 100))
    res.json({ data: await affiliateService.getReferrals(account.id, limit) })
  } catch (err) { next(err) }
})

// Synthesized notification feed — drives the partner-portal bell. No schema
// change; the feed is computed from conversion + commission rows and bounded
// to the last 30 days. Returns { items, unreadCount } in the same shape the
// NotificationBell component already consumes from /api/notifications.
tenantRouter.get('/affiliate/notifications', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) {
      res.json({ data: { items: [], unreadCount: 0 } })
      return
    }
    const items = await affiliateService.getPartnerNotifications(account.id)
    // Read state is client-side. The bell sends ?since=<ISO> on poll; anything
    // newer is unread. Default behavior (no `since` param): everything <24h is
    // counted as unread so the badge shows fresh activity.
    const since = (req.query as Record<string, string>).since
    const cutoff = since ? new Date(since) : new Date(Date.now() - 86400_000)
    const unreadCount = items.filter(i => new Date(i.createdAt) > cutoff).length
    res.json({ data: { items, unreadCount } })
  } catch (err) { next(err) }
})

// Mark all read — for the partner feed we just record the timestamp on the
// client (localStorage). The endpoint exists to keep the bell component's
// "Mark all read" button working; server returns ok.
tenantRouter.post('/affiliate/notifications/read-all', (_req, res) => {
  res.json({ data: { ok: true } })
})

// Per-item mark-read also a no-op on the server — synthesized items don't
// have persistent read state. Kept so the bell's per-item click handler
// doesn't 404.
tenantRouter.post('/affiliate/notifications/:id/read', (_req, res) => {
  res.json({ data: { ok: true } })
})

tenantRouter.post('/affiliate/payout/request', async (req, res, next) => {
  try {
    res.json({ data: await affiliateService.requestPayout(req.user!.id) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

tenantRouter.get('/affiliate/payout/requests', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.getPayoutRequests(account.id) })
  } catch (err) { next(err) }
})

// ── Stripe Connect Express — payout account onboarding ───────────────────────

/** Start (or resume) the Stripe Express onboarding flow.
 *  Body: { returnUrl, refreshUrl } — both should point at the partner-portal.
 *  Returns the Stripe-hosted URL the browser should open. */
tenantRouter.post('/affiliate/connect/onboard', async (req, res, next) => {
  try {
    const { returnUrl, refreshUrl } = req.body as { returnUrl?: string; refreshUrl?: string }
    if (!returnUrl || !refreshUrl) {
      res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'returnUrl and refreshUrl are required' }] }); return
    }
    res.json({ data: await affiliateService.createConnectOnboardingLink(req.user!.id, { returnUrl, refreshUrl }) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

/** Read the cached Connect status (no Stripe round-trip). */
tenantRouter.get('/affiliate/connect/status', async (req, res, next) => {
  try {
    res.json({ data: await affiliateService.getConnectStatus(req.user!.id) })
  } catch (err) { next(err) }
})

/** Force-refresh the status from Stripe — call after the partner returns from
 *  Stripe-hosted onboarding so the dashboard reflects their new state. */
tenantRouter.post('/affiliate/connect/refresh', async (req, res, next) => {
  try {
    res.json({ data: await affiliateService.refreshConnectStatus(req.user!.id) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

// ── Custom Links (partner-owned named slugs) ──────────────────────────────────

tenantRouter.get('/affiliate/custom-links', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.listCustomLinks(account.id) })
  } catch (err) { next(err) }
})

tenantRouter.post('/affiliate/custom-links', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account || account.status !== 'ACTIVE') {
      res.status(403).json({ errors: [{ code: 'FORBIDDEN', message: 'Active partner account required' }] }); return
    }
    const { slug, label, notes } = req.body as { slug?: string; label?: string; notes?: string }
    res.json({ data: await affiliateService.createCustomLink(account.id, { slug: slug ?? '', label: label ?? '', notes }) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

tenantRouter.patch('/affiliate/custom-links/:id', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const { label, notes } = req.body as { label?: string; notes?: string | null }
    res.json({ data: await affiliateService.updateCustomLink(account.id, req.params.id!, { label, notes }) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

tenantRouter.post('/affiliate/custom-links/:id/archive', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.setCustomLinkArchived(account.id, req.params.id!, true) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

tenantRouter.post('/affiliate/custom-links/:id/unarchive', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.setCustomLinkArchived(account.id, req.params.id!, false) })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

tenantRouter.delete('/affiliate/custom-links/:id', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    await affiliateService.deleteCustomLink(account.id, req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err: unknown) {
    if (err instanceof Error) res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: err.message }] })
    else next(err)
  }
})

// ── Admin routes ──────────────────────────────────────────────────────────────
const adminRouter: IRouter = Router()
adminRouter.use(authenticate, requirePlatformAdmin)

adminRouter.get('/affiliate/settings',   async (_req, res, next) => { try { res.json({ data: await affiliateService.getSettings() }) } catch (err) { next(err) } })
adminRouter.patch('/affiliate/settings', async (req, res, next) => { try { res.json({ data: await affiliateService.updateSettings(req.body as Parameters<typeof affiliateService.updateSettings>[0]) }) } catch (err) { next(err) } })

adminRouter.get('/affiliates', async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.listAffiliates({ status: status || undefined, search: search || undefined, page: parseInt(page ?? '1', 10), limit: parseInt(limit ?? '50', 10) }) })
  } catch (err) { next(err) }
})

adminRouter.get('/affiliates/:id', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccountById(req.params.id!)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'Not found' }] }); return }
    const stats = await affiliateService.getAffiliateStats(account.id)
    res.json({ data: { ...account, stats } })
  } catch (err) { next(err) }
})

adminRouter.get('/affiliate/platform-stats', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query as Record<string, string>).days ?? '30', 10) || 30))
    res.json({ data: await affiliateService.getPlatformStats(days) })
  } catch (err) { next(err) }
})

adminRouter.get('/affiliate/platform-daily', async (req, res, next) => {
  try {
    const days = Math.max(7, Math.min(90, parseInt((req.query as Record<string, string>).days ?? '30', 10) || 30))
    res.json({ data: await affiliateService.getPlatformDailyStats(days) })
  } catch (err) { next(err) }
})

adminRouter.post('/affiliates/:id/regenerate-code', async (req, res, next) => {
  try { res.json({ data: await affiliateService.regeneratePartnerCode(req.params.id!) }) } catch (err) { next(err) }
})

// Default DELETE = soft-delete (safe — partner is hidden, data preserved).
// For GDPR / right-to-be-forgotten full erasure, pass `{ purge: true }` in
// the body — that path drops all rows + Stripe Connect account permanently.
adminRouter.delete('/affiliates/:id', async (req, res, next) => {
  try {
    const body = (req.body as { reason?: string; purge?: boolean } | undefined) ?? {}
    if (body.purge === true) {
      const result = await affiliateService.deletePartner(req.params.id!, {
        actorUserId: req.user!.id,
        reason:      body.reason,
      })
      res.json({ data: result })
      return
    }
    const result = await affiliateService.softDeletePartner(req.params.id!, {
      actorUserId: req.user!.id,
      reason:      body.reason,
    })
    res.json({ data: result })
  } catch (err) { next(err) }
})

adminRouter.post('/affiliates/:id/approve',   async (req, res, next) => { try { res.json({ data: await affiliateService.approveAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/pause',      async (req, res, next) => { try { res.json({ data: await affiliateService.pauseAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/reactivate', async (req, res, next) => { try { res.json({ data: await affiliateService.reactivateAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/disable',    async (req, res, next) => { try { const { notes } = req.body as { notes?: string }; res.json({ data: await affiliateService.disableAffiliate(req.params.id!, notes) }) } catch (err) { next(err) } })
adminRouter.patch('/affiliates/:id/notes',     async (req, res, next) => { try { const { notes } = req.body as { notes: string }; res.json({ data: await affiliateService.updateAffiliateNotes(req.params.id!, notes) }) } catch (err) { next(err) } })

// ── Lead engine credits ──────────────────────────────────────────────────────
// Global default (granted to a partner on approval) + per-partner override.
const creditsSchema = z.object({ credits: z.number().int().min(0).max(1_000_000) })

adminRouter.get('/lead-engine/settings', async (_req, res, next) => {
  try {
    res.json({ data: { defaultCredits: await leadEngineService.getDefaultCredits() } })
  } catch (err) { next(err) }
})
adminRouter.patch('/lead-engine/settings', async (req, res, next) => {
  try {
    const { defaultCredits } = z.object({
      defaultCredits: z.number().int().min(0).max(1_000_000),
    }).parse(req.body)
    await leadEngineService.setDefaultCredits(defaultCredits, req.user!.id)
    res.json({ data: { defaultCredits } })
  } catch (err) { next(err) }
})
adminRouter.patch('/affiliates/:id/lead-credits', async (req, res, next) => {
  try {
    const { credits } = creditsSchema.parse(req.body)
    res.json({ data: await leadEngineService.setPartnerCredits(req.params.id!, credits) })
  } catch (err) { next(err) }
})

adminRouter.get('/affiliate/commissions', async (req, res, next) => {
  try {
    const { status, affiliateId, page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.listAdminCommissions({ status: status || undefined, affiliateId: affiliateId || undefined, page: parseInt(page ?? '1', 10), limit: parseInt(limit ?? '50', 10) }) })
  } catch (err) { next(err) }
})

adminRouter.post('/affiliate/commissions/bulk-approve', async (req, res, next) => {
  try { const { ids } = req.body as { ids: string[] }; res.json({ data: await affiliateService.bulkApproveCommissions(ids) }) } catch (err) { next(err) }
})

adminRouter.post('/affiliate/commissions/:id/approve', async (req, res, next) => { try { res.json({ data: await affiliateService.approveCommission(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliate/commissions/:id/hold',    async (req, res, next) => { try { res.json({ data: await affiliateService.holdCommission(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliate/commissions/:id/reverse', async (req, res, next) => { try { res.json({ data: await affiliateService.reverseCommission(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliate/commissions/:id/pay',     async (req, res, next) => { try { const { payoutRef } = req.body as { payoutRef: string }; res.json({ data: await affiliateService.markCommissionPaid(req.params.id!, payoutRef ?? '') }) } catch (err) { next(err) } })

adminRouter.get('/affiliate/payout-requests', async (req, res, next) => {
  try {
    const { status, page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.listAdminPayoutRequests({ status: status || undefined, page: parseInt(page ?? '1', 10), limit: parseInt(limit ?? '50', 10) }) })
  } catch (err) { next(err) }
})

adminRouter.post('/affiliate/payout-requests/:id/process', async (req, res, next) => {
  try {
    const { payoutRef, notes } = req.body as { payoutRef: string; notes?: string }
    res.json({ data: await affiliateService.processPayoutRequest(req.params.id!, payoutRef, notes) })
  } catch (err) { next(err) }
})

// ── Public ────────────────────────────────────────────────────────────────────
const publicRouter: IRouter = Router()

publicRouter.post('/track/click', async (req, res, next) => {
  try {
    const { ref, sessionId, landingPath, referrer } = req.body as Record<string, string>
    if (!ref) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'ref required' }] }); return }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? ''
    const ipHash = ip ? (await import('crypto')).default.createHash('sha256').update(ip).digest('hex').slice(0, 16) : undefined
    await affiliateService.trackClick(ref, { sessionId, landingPath, referrer, ipHash, userAgent: req.headers['user-agent'] })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

publicRouter.get('/affiliate/settings', async (_req, res, next) => {
  try {
    const s = await affiliateService.getSettings()
    res.json({ data: { cookieDurationDays: s.cookieDurationDays, programName: s.programName, programDescription: s.programDescription, commissionRatePct: s.commissionRatePct, termsUrl: s.termsUrl } })
  } catch (err) { next(err) }
})

// Resolve a referral code OR custom slug → parent referralCode. Lets the
// /r/[code] redirect page drop the right cookie value when a visitor lands via
// a custom slug. Returns 404 for unknown / archived / disabled inputs.
publicRouter.get('/affiliate/resolve', async (req, res, next) => {
  try {
    const code = (req.query as Record<string, string>).code?.trim()
    if (!code) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'code required' }] }); return }
    const resolved = await affiliateService.resolveReferral(code)
    if (!resolved) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'Unknown referral code' }] }); return }
    res.json({ data: resolved })
  } catch (err) { next(err) }
})

// Order matters — Express tries mounts in declaration order. The most-specific
// (and unauthenticated) /api/public mount must come first so it doesn't get
// caught by tenantRouter's authenticate middleware. Same for /api/admin.
router.use('/api/public', publicRouter)
router.use('/api/admin', adminRouter)
router.use('/api', tenantRouter)

export default router
