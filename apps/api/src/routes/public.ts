import { Router, type IRouter } from 'express'
import { z } from 'zod'
import * as systemConfig from '../services/system-config.service.js'
import { prisma } from '../lib/prisma.js'
import { getReportByToken } from '../services/gmb-evaluation.service.js'
import { renderReportHtml } from '../services/gmb-report-html.service.js'
import { verifyInviteToken } from '../lib/jwt.js'
import { renderLeadReportHtml } from '../services/lead-report-html.service.js'

const REPORT_WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'https://app.myorbisvoice.com'

const router: IRouter = Router()

// GET /api/public/lead-report/:token — the customer-facing Lead Capture report.
// No login: the partner-issued token IS the access key (token → that one contact).
// Branded scorecard + addendum; its "Get started" CTA leads to the prefilled
// signup. Doubles as a PDF (print-clean CSS).
router.get('/public/lead-report/:token', async (req, res) => {
  try {
    const token = req.params['token'] as string
    const cid = verifyInviteToken(token)
    const c = await prisma.contact.findFirst({
      where:  { id: cid, deletedAt: null },
      select: { fullName: true, createdAt: true, metadataJson: true },
    })
    const meta = (c?.metadataJson ?? {}) as Record<string, unknown>
    if (!c || typeof meta['leadCaptureScore'] !== 'number') { res.status(404).send('No evaluation on file'); return }
    const lang = req.query['lang'] === 'es' ? 'es' : 'en'
    const html = renderLeadReportHtml({
      businessName: (meta['businessName'] as string) || c.fullName || 'Your business',
      score:        meta['leadCaptureScore'] as number,
      grade:        (meta['leadCaptureGrade'] as string) ?? null,
      scores:       (meta['evalScores'] as Record<string, number>) ?? {},
      locale:       lang,
      signupUrl:    `${REPORT_WEB_ORIGIN}/signup?invite=${encodeURIComponent(token)}`,
      reportDate:   new Date(c.createdAt).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.send(html)
  } catch { res.status(400).send('Invalid or expired link') }
})

// GET /api/public/signup-invite/:token — prefill for a partner-issued signup
// invite. No auth: the signed token IS the access key (a partner converted a
// saved lead into this exact link), so it returns only that one contact's
// basics — never an open email lookup that could leak anyone's data.
router.get('/public/signup-invite/:token', async (req, res) => {
  try {
    const cid = verifyInviteToken(req.params['token'] as string)
    const c = await prisma.contact.findFirst({
      where:  { id: cid, deletedAt: null },
      select: { fullName: true, email: true, phoneE164: true, metadataJson: true },
    })
    if (!c) { res.status(404).json({ error: 'not_found' }); return }
    const meta = (c.metadataJson ?? {}) as Record<string, unknown>
    res.json({ data: {
      businessName: (meta['businessName'] as string) || c.fullName || '',
      email:        c.email || '',
      phone:        c.phoneE164 || '',
    } })
  } catch {
    res.status(400).json({ error: 'invalid_or_expired' })
  }
})

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
