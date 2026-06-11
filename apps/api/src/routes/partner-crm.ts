/**
 * Partner-scoped CRM routes — mirror /api/crm/* but every query filters on
 * the authenticated partner instead of a tenant. Mounted under /api/partner
 * and gated by `requirePartnerContext` (sets req.partnerAccountId).
 *
 * The data lives in the same Contact / PipelineStage / ContactNote tables
 * as the tenant CRM; the difference is the Contact.partnerId column and the
 * PipelineStage.partnerId column. Partner stages and contacts are isolated
 * from the hosting tenant's CRM and from every other partner's CRM.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import * as crmService from '../services/crm.service.js'
import { sendEmail } from '../services/email.service.js'
import { sendSms } from '../services/sms.service.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'
import { signInviteToken } from '../lib/jwt.js'

const SIGNUP_ORIGIN = process.env['WEB_ORIGIN'] ?? 'https://app.myorbisvoice.com'
const API_PUBLIC_ORIGIN = process.env['API_PUBLIC_ORIGIN'] ?? 'https://api.myorbisvoice.com'

function normPhone(s: string | undefined | null): string | null {
  const d = (s ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return (s ?? '').startsWith('+') ? (s as string) : '+' + d
}

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

/**
 * Hosting tenant resolution. Partner CRM rows still need a tenantId because
 * Contact.tenantId and PipelineStage.tenantId are NOT NULL (carryover from
 * F.1 when only tenants existed). For an active partner we use whatever
 * tenant has actually been hosting their widget sessions; for brand-new
 * partners with no conversations yet we fall back to the "Orbis Platform"
 * tenant (the platform demo tenant that hosts the partner landing pages).
 */
async function resolveHostingTenantId(partnerId: string): Promise<string> {
  // Prefer an existing conversation's tenant — most accurate.
  const recent = await prisma.conversation.findFirst({
    where:   { partnerId },
    orderBy: { startedAt: 'desc' },
    select:  { tenantId: true },
  })
  if (recent?.tenantId) return recent.tenantId

  // Fall back to the platform demo tenant. Hard-coded to a stable slug rather
  // than a UUID so this still works if the DB is rebuilt from seed.
  const platform = await prisma.tenant.findFirst({
    where:  { slug: 'orbis-platform' },
    select: { id: true },
  })
  if (platform) return platform.id

  // Last resort — any tenant. Should never hit in production but keeps the
  // partner CRM functional in a fresh-seed environment.
  const any = await prisma.tenant.findFirst({ select: { id: true } })
  if (!any) throw new AppError('SERVER_ERROR', 'No hosting tenant available for partner CRM', 500)
  return any.id
}

function partnerId(req: Request): string {
  return (req as any).partnerAccountId as string
}

// ── Pipeline stages ─────────────────────────────────────────────────────────

router.get('/partner/crm/pipeline-stages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    // Auto-seed on first read so new partners get the default 7 stages without
    // a separate admin action — same UX as tenant signup.
    await crmService.seedDefaultPipelineForPartner({ partnerId: pid, hostingTenantId })
    const stages = await crmService.listPipelineStages({ kind: 'partner', partnerId: pid, hostingTenantId })
    res.json({ data: stages })
  } catch (err) { next(err) }
})

const stageInputSchema = z.object({
  id:        z.string().optional(),
  name:      z.string().min(1).max(80),
  sortOrder: z.number().int().min(0),
  color:     z.string().max(40).nullable().optional(),
  isWon:     z.boolean().optional(),
  isLost:    z.boolean().optional(),
})

router.put('/partner/crm/pipeline-stages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const { stages, toDelete } = z.object({
      stages:   z.array(stageInputSchema).min(1),
      toDelete: z.array(z.string()).default([]),
    }).parse(req.body)
    const out = await crmService.upsertPipelineStages(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      stages,
      toDelete,
    )
    res.json({ data: out })
  } catch (err) { next(err) }
})

// ── Kanban board (stages + contacts grouped) ────────────────────────────────

router.get('/partner/crm/board', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    await crmService.seedDefaultPipelineForPartner({ partnerId: pid, hostingTenantId })

    const [stages, contacts] = await Promise.all([
      crmService.listPipelineStages({ kind: 'partner', partnerId: pid, hostingTenantId }),
      prisma.contact.findMany({
        where: { partnerId: pid, pipelineStageId: { not: null }, deletedAt: null },
        select: {
          id: true, fullName: true, firstName: true, lastName: true,
          email: true, phoneE164: true, source: true, metadataJson: true,
          pipelineStageId: true, stageUpdatedAt: true, createdAt: true,
        },
        orderBy: { stageUpdatedAt: 'desc' },
        take: 500,
      }),
    ])
    res.json({ data: { stages, contacts } })
  } catch (err) { next(err) }
})

// ── Save a Lead Capture Evaluation as a CRM contact ─────────────────────────
const evalContactSchema = z.object({
  businessName:  z.string().max(200).optional().default(''),
  contactName:   z.string().max(120).optional().default(''),
  email:         z.string().max(200).optional().default(''),
  businessPhone: z.string().max(40).optional().default(''),
  personalPhone: z.string().max(40).optional().default(''),
  address:       z.string().max(300).optional().default(''),
  niche:         z.string().max(120).optional().default(''),
  score:         z.number().int().min(0).max(100).optional(),
  grade:         z.string().max(4).optional(),
  scores:        z.record(z.number()).optional(),
  costPerWeek:   z.number().min(0).max(100000).optional(),
  closeRate:     z.number().min(0).max(100).optional(),
  avgValue:      z.number().min(0).max(10000000).optional(),
  notCaptured:   z.number().min(0).max(100).optional(),
})

router.post('/partner/crm/contacts/from-eval', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const b = evalContactSchema.parse(req.body)
    if (!b.businessName && !b.contactName && !b.email) {
      throw new AppError('VALIDATION', 'Provide at least a business name, contact name, or email', 400)
    }
    const hostingTenantId = await resolveHostingTenantId(pid)
    const now = new Date()
    const contact = await prisma.contact.create({
      data: {
        tenantId:     hostingTenantId,
        partnerId:    pid,
        fullName:     b.businessName || b.contactName || 'Lead',
        firstName:    b.contactName || null,
        email:        b.email || null,
        phoneE164:    normPhone(b.businessPhone),
        addressLine1: b.address || null,
        source:       'LEAD_EVAL',
        // Cold lead — no consent. Born opted out of voice + SMS (compliance wall).
        optedOutSms:   true, optedOutSmsAt: now,
        optedOutVoice: true, optedOutVoiceAt: now,
        tagsJson:      b.niche ? [b.niche] : undefined,
        metadataJson: {
          businessName:     b.businessName || null,
          contactName:      b.contactName || null,
          niche:            b.niche || null,
          personalPhone:    b.personalPhone || null,
          leadCaptureScore: b.score ?? null,
          leadCaptureGrade: b.grade ?? null,
          evalScores:       b.scores ?? null,
          costPerWeek:      b.costPerWeek ?? null,
          closeRate:        b.closeRate ?? null,
          avgValue:         b.avgValue ?? null,
          notCaptured:      b.notCaptured ?? null,
        },
      },
    })
    await crmService.seedDefaultPipelineForPartner({ partnerId: pid, hostingTenantId })
    await crmService.placeNewContactOnPipeline({ kind: 'partner', partnerId: pid, hostingTenantId }, contact.id)
    res.json({ data: { id: contact.id } })
  } catch (err) { next(err) }
})

// ── Convert a contact → prefilled signup invite link (secure token) ─────────
router.post('/partner/crm/contacts/:id/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const contact = await prisma.contact.findFirst({
      where:  { id: req.params['id'] as string, partnerId: pid, deletedAt: null },
      select: { id: true },
    })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    const acct = await prisma.affiliateAccount.findFirst({ where: { id: pid }, select: { referralCode: true } })
    const token = signInviteToken(contact.id)
    const ref = acct?.referralCode ? `&ref=${encodeURIComponent(acct.referralCode)}` : ''
    // The shareable link is the REPORT (no login). Its "Get started" CTA leads to
    // the prefilled signup — account creation only when the lead is ready.
    res.json({ data: {
      token,
      url:       `${API_PUBLIC_ORIGIN}/api/public/lead-report/${token}`,
      reportUrl: `${API_PUBLIC_ORIGIN}/api/public/lead-report/${token}`,
      signupUrl: `${SIGNUP_ORIGIN}/signup?invite=${token}${ref}`,
    } })
  } catch (err) { next(err) }
})

// ── Contact list + detail + timeline ────────────────────────────────────────

router.get('/partner/crm/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const { search, page, limit, stageId } = req.query as Record<string, string>
    const pageNum  = page  ? parseInt(page,  10) : 1
    const limitNum = limit ? parseInt(limit, 10) : 50

    const where: any = { partnerId: pid, deletedAt: null }
    if (search) {
      where.OR = [
        { fullName:  { contains: search, mode: 'insensitive' as const } },
        { email:     { contains: search, mode: 'insensitive' as const } },
        { phoneE164: { contains: search } },
      ]
    }
    if (stageId === 'unstaged') where.pipelineStageId = null
    else if (stageId)            where.pipelineStageId = stageId

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (pageNum - 1) * limitNum,
        take:    limitNum,
        include: { pipelineStage: { select: { id: true, name: true, color: true, sortOrder: true } } },
      }),
      prisma.contact.count({ where }),
    ])
    res.json({ data: { items, total, page: pageNum, limit: limitNum } })
  } catch (err) { next(err) }
})

router.get('/partner/crm/contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const contact = await prisma.contact.findFirst({
      where:   { id: req.params.id!, partnerId: pid },
      include: { pipelineStage: { select: { id: true, name: true, color: true, sortOrder: true } } },
    })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    res.json({ data: contact })
  } catch (err) { next(err) }
})

router.get('/partner/crm/contacts/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const limit     = Math.min(parseInt((req.query['limit'] as string) || '50', 10), 100)
    const offset    = parseInt((req.query['offset'] as string) || '0', 10)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, partnerId: pid } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    const [conversations, messages, notes, appointments] = await Promise.all([
      prisma.conversation.findMany({
        where: { partnerId: pid, contactId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, channelType: true, direction: true, status: true,
          startedAt: true, endedAt: true, summaryText: true,
          recordingStatus: true, recordingDurationSecs: true,
          outcomeCode: true,
        },
      }),
      prisma.messageLog.findMany({
        where: { contactId, channel: { in: ['SMS', 'EMAIL'] } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, channel: true, direction: true, sender: true, recipient: true,
          subject: true, bodyText: true, deliveryStatus: true, optOutDetected: true,
          sentAt: true, deliveredAt: true, failedAt: true, createdAt: true,
        },
      }),
      prisma.contactNote.findMany({
        where:   { partnerId: pid, contactId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.appointment.findMany({
        where:   { partnerId: pid, contactId },
        orderBy: { startAt: 'desc' },
        take:    limit,
        select: {
          id: true, status: true, startAt: true, endAt: true,
          appointmentType: true, notes: true, createdAt: true,
        },
      }),
    ])

    const items = [
      ...conversations.map(c => ({ type: 'VOICE' as const, at: c.startedAt, data: c })),
      ...messages.map(m => ({
        type: (m.channel === 'EMAIL' ? 'EMAIL' : 'SMS') as 'EMAIL' | 'SMS',
        at:   m.sentAt ?? m.createdAt,
        data: m,
      })),
      ...notes.map(n => ({ type: 'NOTE' as const, at: n.createdAt, data: n })),
      ...appointments.map(a => ({ type: 'APPOINTMENT' as const, at: a.startAt, data: a })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime())

    res.json({ data: { contact, items, total: items.length } })
  } catch (err) { next(err) }
})

// ── Remove from CRM (soft-delete) ───────────────────────────────────────────
//
// Sets Contact.deletedAt — keeps the row for audit + suppression history
// (email-suppression checks key off the email, not Contact existence), but
// hides it from board / list / timeline queries. Also nulls pipelineStageId
// so even queries that ignore deletedAt won't grab the card.
router.delete('/partner/crm/contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, partnerId: pid, deletedAt: null },
      select: { id: true },
    })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    // Hard delete — removes the contact and its related records: ContactNotes
    // cascade (schema onDelete: Cascade); conversations / appointments / message
    // logs unlink (onDelete: SetNull), preserving call history without a dangling
    // contact. The partner asked for associated records to go with the contact.
    await prisma.contact.delete({ where: { id: contact.id } })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Stage move ──────────────────────────────────────────────────────────────

router.patch('/partner/crm/contacts/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const { stageId } = z.object({ stageId: z.string().min(1) }).parse(req.body)

    const [stage, contact] = await Promise.all([
      prisma.pipelineStage.findFirst({ where: { id: stageId, partnerId: pid }, select: { id: true } }),
      prisma.contact.findFirst({ where: { id: contactId, partnerId: pid }, select: { id: true } }),
    ])
    if (!stage)   throw new AppError('NOT_FOUND', 'Stage not found',   404)
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    await crmService.setContactStage({ contactId, stageId })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Notes ───────────────────────────────────────────────────────────────────

router.get('/partner/crm/contacts/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const contact = await prisma.contact.findFirst({ where: { id: contactId, partnerId: pid }, select: { id: true } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    const hostingTenantId = await resolveHostingTenantId(pid)
    const notes = await crmService.listContactNotes({ kind: 'partner', partnerId: pid, hostingTenantId }, contactId)
    res.json({ data: notes })
  } catch (err) { next(err) }
})

router.post('/partner/crm/contacts/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const userId    = req.user!.id
    const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, partnerId: pid }, select: { id: true } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    const hostingTenantId = await resolveHostingTenantId(pid)
    const note = await crmService.addContactNote({
      scope:        { kind: 'partner', partnerId: pid, hostingTenantId },
      contactId,
      authorUserId: userId,
      body,
    })
    res.status(201).json({ data: note })
  } catch (err) { next(err) }
})

// ── Email + SMS send (mirrors tenant CRM compose) ───────────────────────────

router.post('/partner/crm/contacts/:id/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const { subject, body } = z.object({
      subject: z.string().min(1).max(200),
      body:    z.string().min(1).max(50_000),
    }).parse(req.body)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, partnerId: pid } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    if (!contact.email) throw new AppError('VALIDATION_ERROR', 'Contact has no email address', 422)

    const html = `<div style="font-family:sans-serif;max-width:640px;color:#222;line-height:1.55;white-space:pre-wrap">${
      body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }</div>`

    // Partner-from header — use their slug-based alias when available, else fall
    // back to the system from. Lets the contact see a recognizable sender.
    const partner = await prisma.affiliateAccount.findFirst({
      where:  { id: pid },
      select: { slug: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    })
    const fromName = partner?.displayName
      ?? [partner?.user?.firstName, partner?.user?.lastName].filter(Boolean).join(' ')
      ?? 'MyOrbisResults Partner'
    const fromHeader = partner?.slug ? `${fromName} <${partner.slug}@myorbisresults.com>` : undefined

    // F.4 — sendEmail now routes via the right provider (Postmark/Resend/Brevo/SMTP)
    // and returns the providerMessageId so we can persist it on MessageLog. The
    // webhook handler later matches bounces/complaints by this id and updates
    // the same row, plus auto-suppresses the recipient.
    const sendResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      text: body,
      from: fromHeader,
      kind: 'transactional',  // partner ad-hoc compose is conceptually transactional
      tenantId: contact.tenantId,
      partnerId: pid,
    })
    if (!sendResult.sent) {
      throw new AppError(
        sendResult.skipped === 'suppressed' ? 'VALIDATION_ERROR' : 'EXTERNAL_ERROR',
        sendResult.skipped === 'suppressed'
          ? `Recipient is on the suppression list (${sendResult.reason})`
          : `Email send failed: ${sendResult.reason ?? sendResult.skipped}`,
        sendResult.skipped === 'suppressed' ? 422 : 502,
      )
    }

    // Log it. providerMessageId is what the bounce webhook will match against.
    let logId: string | null = null
    let logged = true
    try {
      const log = await prisma.messageLog.create({
        data: {
          tenantId:          contact.tenantId,
          partnerId:         pid,
          contactId,
          channel:           'EMAIL',
          direction:         'OUTBOUND',
          sender:            partner?.slug ? `${partner.slug}@myorbisresults.com` : (req.user!.email || 'system'),
          recipient:         contact.email,
          subject,
          bodyText:          body,
          deliveryStatus:    'sent',
          sentAt:            new Date(),
          providerMessageId: sendResult.providerMessageId ?? null,
        },
        select: { id: true },
      })
      logId = log.id
    } catch (logErr) {
      logged = false
      console.warn('[partner-crm] email log failed (email still sent):', (logErr as Error).message)
    }

    res.status(logged ? 200 : 207).json({
      data: { ok: true, messageId: logId, logged, provider: sendResult.provider },
    })
  } catch (err) { next(err) }
})

router.post('/partner/crm/contacts/:id/sms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid       = partnerId(req)
    const contactId = req.params.id!
    const { body } = z.object({ body: z.string().min(1).max(1600) }).parse(req.body)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, partnerId: pid } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    if (!contact.phoneE164) throw new AppError('VALIDATION_ERROR', 'Contact has no phone number', 422)

    // Partners share the hosting tenant's outbound phone number for SMS today;
    // partner-owned numbers are a future build.
    const phone = await prisma.phoneNumber.findFirst({ where: { tenantId: contact.tenantId } })
    if (!phone) throw new AppError('VALIDATION_ERROR', 'No outbound number configured', 422)

    const result = await sendSms({
      tenantId:  contact.tenantId,
      contactId: contact.id,
      from:      phone.e164Number,
      to:        contact.phoneE164,
      body,
    })
    if (!result.success) throw new AppError('EXTERNAL_ERROR', result.error ?? 'Failed to send SMS', 502)

    res.json({ data: { sid: result.sid } })
  } catch (err) { next(err) }
})

export default router
