import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as affiliateService from '../services/affiliate.service.js'

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
    const days = Math.max(1, Math.min(365, parseInt((req.query as Record<string, string>).days ?? '30') || 30))
    res.json({ data: await affiliateService.getPeriodStats(account.id, days) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/stats/daily', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    const days = parseInt((req.query as Record<string, string>).days ?? '30')
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
    res.json({ data: await affiliateService.getCommissions(account.id, parseInt(page ?? '1'), parseInt(limit ?? '20')) })
  } catch (err) { next(err) }
})

tenantRouter.get('/affiliate/clicks', async (req, res, next) => {
  try {
    const account = await affiliateService.getAffiliateAccount(req.user!.id)
    if (!account) { res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'No affiliate account' }] }); return }
    res.json({ data: await affiliateService.getRecentClicks(account.id) })
  } catch (err) { next(err) }
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

// ── Admin routes ──────────────────────────────────────────────────────────────
const adminRouter: IRouter = Router()
adminRouter.use(authenticate, requirePlatformAdmin)

adminRouter.get('/affiliate/settings',   async (req, res, next) => { try { res.json({ data: await affiliateService.getSettings() }) } catch (err) { next(err) } })
adminRouter.patch('/affiliate/settings', async (req, res, next) => { try { res.json({ data: await affiliateService.updateSettings(req.body as Parameters<typeof affiliateService.updateSettings>[0]) }) } catch (err) { next(err) } })

adminRouter.get('/affiliates', async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.listAffiliates({ status: status || undefined, search: search || undefined, page: parseInt(page ?? '1'), limit: parseInt(limit ?? '50') }) })
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

adminRouter.post('/affiliates/:id/approve',   async (req, res, next) => { try { res.json({ data: await affiliateService.approveAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/pause',      async (req, res, next) => { try { res.json({ data: await affiliateService.pauseAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/reactivate', async (req, res, next) => { try { res.json({ data: await affiliateService.reactivateAffiliate(req.params.id!) }) } catch (err) { next(err) } })
adminRouter.post('/affiliates/:id/disable',    async (req, res, next) => { try { const { notes } = req.body as { notes?: string }; res.json({ data: await affiliateService.disableAffiliate(req.params.id!, notes) }) } catch (err) { next(err) } })
adminRouter.patch('/affiliates/:id/notes',     async (req, res, next) => { try { const { notes } = req.body as { notes: string }; res.json({ data: await affiliateService.updateAffiliateNotes(req.params.id!, notes) }) } catch (err) { next(err) } })

adminRouter.get('/affiliate/commissions', async (req, res, next) => {
  try {
    const { status, affiliateId, page, limit } = req.query as Record<string, string>
    res.json({ data: await affiliateService.listAdminCommissions({ status: status || undefined, affiliateId: affiliateId || undefined, page: parseInt(page ?? '1'), limit: parseInt(limit ?? '50') }) })
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
    res.json({ data: await affiliateService.listAdminPayoutRequests({ status: status || undefined, page: parseInt(page ?? '1'), limit: parseInt(limit ?? '50') }) })
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

publicRouter.get('/affiliate/settings', async (req, res, next) => {
  try {
    const s = await affiliateService.getSettings()
    res.json({ data: { cookieDurationDays: s.cookieDurationDays, programName: s.programName, programDescription: s.programDescription, commissionRatePct: s.commissionRatePct, termsUrl: s.termsUrl } })
  } catch (err) { next(err) }
})

// Order matters — Express tries mounts in declaration order. The most-specific
// (and unauthenticated) /api/public mount must come first so it doesn't get
// caught by tenantRouter's authenticate middleware. Same for /api/admin.
router.use('/api/public', publicRouter)
router.use('/api/admin', adminRouter)
router.use('/api', tenantRouter)

export default router
