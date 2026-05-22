import { Router, type IRouter } from 'express'
import { z } from 'zod'
import * as systemConfig from '../services/system-config.service.js'
import { prisma } from '../lib/prisma.js'
import { getReportByToken } from '../services/gmb-evaluation.service.js'
import { renderReportHtml } from '../services/gmb-report-html.service.js'

const router: IRouter = Router()

// GET /api/public/gmb-report/:token — the customer-facing shareable report.
// No auth: the unguessable token IS the access key. Returns the full HTML
// document (interactive 3D charts); also what the render service prints to PDF.
router.get('/public/gmb-report/:token', async (req, res, next) => {
  try {
    const locale = (req.query['locale'] === 'es' ? 'es' : 'en') as 'en' | 'es'
    const { evaluation, brand } = await getReportByToken(req.params.token!)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.send(renderReportHtml({ evaluation, brand, locale }))
  } catch (err) { next(err) }
})

// POST /api/public/sms-optin — captures a submission of the "Get text
// updates" form on the marketing site. Public, no auth. Stores the A2P
// 10DLC consent record: phone + the exact disclosure text agreed to.
const smsOptInSchema = z.object({
  phone:       z.string().min(7).max(40),
  name:        z.string().max(120).optional(),
  consent:     z.literal(true), // the unchecked consent checkbox must be ticked
  consentText: z.string().min(20).max(2000),
  locale:      z.string().max(5).optional(),
})

router.post('/public/sms-optin', async (req, res, next) => {
  try {
    const data = smsOptInSchema.parse(req.body)
    await prisma.smsOptIn.create({
      data: {
        phone:       data.phone,
        name:        data.name ?? null,
        consentText: data.consentText,
        locale:      data.locale ?? 'en',
        sourceUrl:   req.get('referer') ?? null,
      },
    })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// GET /api/public/social-links — returns OrbisVoice's own social media URLs
// for the marketing site footer + partner portal "Follow us" section.
// Public, no auth, cached client-side. Empty/null values omitted from response
// so the consumer just iterates non-null entries.
router.get('/public/social-links', async (_req, res, next) => {
  try {
    const settings = await systemConfig.getSystemSettings()
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(settings.social)) {
      if (typeof v === 'string' && v.length > 0) out[k] = v
    }
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ data: out })
  } catch (err) { next(err) }
})

export default router
