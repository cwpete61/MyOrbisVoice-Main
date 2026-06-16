import { Router, type IRouter } from 'express'
import { z } from 'zod'
import * as systemConfig from '../services/system-config.service.js'
import { prisma } from '../lib/prisma.js'
import { getReportByToken } from '../services/gmb-evaluation.service.js'
import { renderReportHtml } from '../services/gmb-report-html.service.js'
import { verifyInviteToken } from '../lib/jwt.js'
import { renderLeadReportHtml } from '../services/lead-report-html.service.js'
import { renderPdfFromHtml } from '../services/pdf-render.client.js'
import * as crmService from '../services/crm.service.js'
import { AppError } from '@voiceautomation/shared'

const REPORT_WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'https://app.myorbisvoice.com'
const API_PUBLIC_ORIGIN = process.env['API_PUBLIC_ORIGIN'] ?? 'https://api.myorbisvoice.com'

const router: IRouter = Router()

// Build the Lead Capture report HTML for a token (shared by the HTML + PDF
// routes). Returns null if the token's contact has no saved evaluation.
async function leadReportHtmlForToken(token: string, lang: 'en' | 'es', pdfUrl: string): Promise<string | null> {
  const cid = verifyInviteToken(token)
  const c = await prisma.contact.findFirst({
    where:  { id: cid, deletedAt: null },
    select: { fullName: true, createdAt: true, metadataJson: true },
  })
  const meta = (c?.metadataJson ?? {}) as Record<string, unknown>
  if (!c || typeof meta['leadCaptureScore'] !== 'number') return null
  return renderLeadReportHtml({
    businessName: (meta['businessName'] as string) || c.fullName || 'Your business',
    score:        meta['leadCaptureScore'] as number,
    grade:        (meta['leadCaptureGrade'] as string) ?? null,
    scores:       (meta['evalScores'] as Record<string, number>) ?? {},
    locale:       lang,
    signupUrl:    `${REPORT_WEB_ORIGIN}/signup?invite=${encodeURIComponent(token)}`,
    reportDate:   new Date(c.createdAt).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    costPerWeek:  (meta['costPerWeek'] as number) ?? null,
    closeRate:    (meta['closeRate'] as number) ?? null,
    avgValue:     (meta['avgValue'] as number) ?? null,
    notCaptured:  (meta['notCaptured'] as number) ?? null,
    pdfUrl,
  })
}

// GET /api/public/lead-report/:token — the customer-facing Lead Capture report.
// No login: the partner-issued token IS the access key (token → that one contact).
// Branded scorecard + addendum; "Get started" CTA leads to the prefilled signup.
router.get('/public/lead-report/:token', async (req, res) => {
  try {
    const token = req.params['token'] as string
    const lang = req.query['lang'] === 'es' ? 'es' : 'en'
    const pdfUrl = `${API_PUBLIC_ORIGIN}/api/public/lead-report/${encodeURIComponent(token)}/pdf${lang === 'es' ? '?lang=es' : ''}`
    const html = await leadReportHtmlForToken(token, lang, pdfUrl)
    if (!html) { res.status(404).send('No evaluation on file'); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    // This is a static, server-escaped report page (no user-controlled script).
    // Override the global CSP so the "Download PDF" (window.print) button works —
    // the global script-src-attr 'none' blocks the inline onclick otherwise.
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' https: 'unsafe-inline'; font-src 'self' https: data:; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'")
    res.send(html)
  } catch { res.status(400).send('Invalid or expired link') }
})

// GET /api/public/lead-report/:token/pdf — same report as a real PDF, served
// INLINE so it opens in the browser's PDF viewer (where the owner can download
// or print). Falls back to the HTML if the render service is unreachable.
router.get('/public/lead-report/:token/pdf', async (req, res) => {
  try {
    const token = req.params['token'] as string
    const lang = req.query['lang'] === 'es' ? 'es' : 'en'
    const html = await leadReportHtmlForToken(token, lang, '')
    if (!html) { res.status(404).send('No evaluation on file'); return }
    const pdf = await renderPdfFromHtml(html)
    if (!pdf) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(html); return }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="lead-capture-report.pdf"')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.end(pdf)
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

// ── Inbound Evaluation campaign opt-in (public, partner-attributed) ──────────
// The beta opt-in page (app/beta/[code]) posts here. The `code` is the partner's
// referralCode (or custom slug); the lead lands in that partner's CRM tagged
// with the campaign track + keyword. No platform-DM integration — this is the
// owned funnel endpoint the social posts point to ("comment KEYWORD, then tap
// my link"). Cold lead: born opted-out of SMS + voice (TCPA wall) regardless of
// the eval-consent checkbox; consent is recorded in metadata, not auto-enabled.
const TRACK_KEYWORDS: Record<string, string> = {
  beta: 'BETA', phantom: 'TEST', competitor: 'WHO ANSWERS', math: 'MATH', afterhours: 'EVAL', quiz: 'QUIZ',
}

function normPhoneE164(s: string | undefined | null): string | null {
  const d = (s ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return (s ?? '').startsWith('+') ? (s as string) : '+' + d
}

async function hostingTenantFor(partnerId: string): Promise<string> {
  const recent = await prisma.conversation.findFirst({
    where: { partnerId }, orderBy: { startedAt: 'desc' }, select: { tenantId: true },
  })
  if (recent?.tenantId) return recent.tenantId
  const platform = await prisma.tenant.findFirst({ where: { slug: 'orbis-platform' }, select: { id: true } })
  if (platform) return platform.id
  const any = await prisma.tenant.findFirst({ select: { id: true } })
  if (!any) throw new AppError('SERVER_ERROR', 'No hosting tenant available', 500)
  return any.id
}

const leadOptInSchema = z.object({
  code:         z.string().min(1).max(64),
  track:        z.string().max(32).optional().default('beta'),
  businessName: z.string().max(200).optional().default(''),
  contactName:  z.string().max(120).optional().default(''),
  email:        z.string().max(200).optional().default(''),
  phone:        z.string().max(40).optional().default(''),
  niche:        z.string().max(120).optional().default(''),
  locale:       z.string().max(5).optional().default('en'),
  consent:      z.boolean().optional().default(false),
  quizScore:    z.number().int().min(0).max(100).optional(),
  quizTier:     z.string().max(40).optional(),
})

router.post('/public/lead-optin', async (req, res, next) => {
  try {
    const b = leadOptInSchema.parse(req.body)
    if (!b.businessName && !b.contactName && !b.email && !b.phone) {
      throw new AppError('VALIDATION', 'Provide a business, name, email, or phone', 400)
    }
    const code = b.code.trim()
    const partner = await prisma.affiliateAccount.findFirst({
      where:  { deletedAt: null, OR: [{ referralCode: code.toUpperCase() }, { slug: code.toLowerCase() }] },
      select: { id: true },
    })
    if (!partner) throw new AppError('NOT_FOUND', 'Unknown partner link', 404)

    const tenantId = await hostingTenantFor(partner.id)
    const now = new Date()
    const contact = await prisma.contact.create({
      data: {
        tenantId, partnerId: partner.id,
        fullName:  b.businessName || b.contactName || 'Lead',
        firstName: b.contactName || null,
        email:     b.email || null,
        phoneE164: normPhoneE164(b.phone),
        source:    'LEAD_OPTIN',
        optedOutSms:   true, optedOutSmsAt: now,
        optedOutVoice: true, optedOutVoiceAt: now,
        tagsJson:  b.niche ? [b.niche] : undefined,
        metadataJson: {
          businessName:    b.businessName || null,
          contactName:     b.contactName || null,
          niche:           b.niche || null,
          campaignTrack:   b.track,
          campaignKeyword: TRACK_KEYWORDS[b.track] ?? null,
          optinConsent:    b.consent,
          optinLocale:     b.locale,
          quizScore:       b.quizScore ?? null,
          quizTier:        b.quizTier ?? null,
          sourceUrl:       req.get('referer') ?? null,
          source:          b.track === 'quiz' ? 'quiz-optin' : 'beta-optin',
        },
      },
    })
    await crmService.seedDefaultPipelineForPartner({ partnerId: partner.id, hostingTenantId: tenantId })
    await crmService.placeNewContactOnPipeline({ kind: 'partner', partnerId: partner.id, hostingTenantId: tenantId }, contact.id)
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
