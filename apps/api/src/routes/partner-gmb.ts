/**
 * Partner GMB Evaluation routes — the lead-gen door-opener. Mounted under
 * /api/partner and gated by `requirePartnerContext` (sets req.partnerAccountId).
 *
 * Read-only audit of a prospect's Google Business Profile via the portable
 * gmb-audit engine (Serper.dev data). Produces an interactive result + a
 * brand-parameterized PDF report the partner uses to pitch the trifecta.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import * as gmbService from '../services/gmb-evaluation.service.js'
import { streamGmbEvaluationPdf } from '../services/gmb-evaluation-pdf.service.js'
import { renderReportHtml } from '../services/gmb-report-html.service.js'
import { renderPdfFromHtml } from '../services/pdf-render.client.js'

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

const runSchema = z.object({
  businessName: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  website: z.string().max(300).optional(),
  keywords: z.array(z.string().max(120)).max(5).optional(),
})

// Run a new evaluation.
router.post('/partner/gmb-evaluations', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = runSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const data = await gmbService.runEvaluation(partnerId, parsed.data)
    res.json({ data })
  } catch (err) { next(err) }
})

// Monthly cap usage (for the counter).
router.get('/partner/gmb-evaluations/usage', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    res.json({ data: await gmbService.getUsage(partnerId) })
  } catch (err) { next(err) }
})

// List this partner's recent evaluations.
router.get('/partner/gmb-evaluations', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const items = await gmbService.listEvaluations(partnerId)
    res.json({ data: { items, total: items.length } })
  } catch (err) { next(err) }
})

// Fetch one full evaluation (for the interactive result screen).
router.get('/partner/gmb-evaluations/:id', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const data = await gmbService.getEvaluation(partnerId, req.params.id!)
    res.json({ data })
  } catch (err) { next(err) }
})

// Soft-delete an evaluation (still counts toward the monthly cap).
router.delete('/partner/gmb-evaluations/:id', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    await gmbService.deleteEvaluation(partnerId, req.params.id!)
    res.json({ data: { deleted: true } })
  } catch (err) { next(err) }
})

// Export the brand-parameterized PDF report.
router.get('/partner/gmb-evaluations/:id/export.pdf', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const evaluation = await gmbService.getEvaluation(partnerId, req.params.id!)
    const brand = await gmbService.resolvePartnerBrand(partnerId)
    const locale = (req.query['locale'] === 'es' ? 'es' : 'en') as 'en' | 'es'
    const safeName = evaluation.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="gmb-evaluation-${safeName}.pdf"`)

    // Prefer the designer-grade HTML→Chromium render; fall back to the pdfkit
    // report if the render service isn't configured/reachable.
    const pdf = await renderPdfFromHtml(renderReportHtml({ evaluation, brand, locale }))
    if (pdf) { res.end(pdf); return }
    await streamGmbEvaluationPdf({ evaluation, brand, locale }, res)
  } catch (err) { next(err) }
})

export default router
