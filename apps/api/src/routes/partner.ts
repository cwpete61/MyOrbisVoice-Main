import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import multer from 'multer'
import path from 'path'
import { promises as fs } from 'fs'
import { randomBytes } from 'crypto'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext, requirePartnerAccount } from '../middleware/rbac.js'
import { prisma } from '../lib/prisma.js'
import * as partnerService from '../services/partner.service.js'
import * as googleService from '../services/google.service.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'

/**
 * Partner-scoped routes for the Mailbox + Profile dashboard at /partner.
 *
 * Auth: `authenticate` + `requirePartnerContext`. The middleware verifies that
 * the authenticated user has an active AffiliateAccount with a slug, and adds
 * partnerAccountId / partnerSlug to req for downstream handlers.
 */

const router: IRouter = Router()

// All routes require authentication. The actual partner-state gate is
// applied per-route: soft gate (requirePartnerAccount — any AffiliateAccount,
// even PENDING / no-slug) for the three self-service profile endpoints
// below, then strict gate (requirePartnerContext — ACTIVE + slug) for every
// other partner-scoped route after the avatar upload handler.
router.use('/partner', authenticate)

// ─── GET /api/partner/signature-preview ──────────────────────────────────────
// Returns the rendered HTML for the partner's auto-signature so the profile
// page + compose UI can show a live preview (iframe srcdoc, not editable).
// Reads the saved emailSignature override when set; falls back to the auto-
// generated block. Either way, returns the actual HTML that will be appended
// at send time — single source of truth.
router.get('/partner/signature-preview', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        customLinks: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { slug: true } },
      },
    })
    if (!partner) throw new AppError('NOT_FOUND', 'Partner record vanished mid-request', 404)
    const { buildPartnerSignatureHtml } = await import('../services/partner.service.js')
    const customSig = partner.emailSignature?.trim()
    const html = (customSig && customSig.length > 0)
      ? customSig
      : buildPartnerSignatureHtml(partner, partner.customLinks[0]?.slug ?? null)
    res.json({ data: { html, source: (customSig && customSig.length > 0) ? 'custom' : 'auto' } })
  } catch (err) { next(err) }
})

// ─── GET /api/partner/me ────────────────────────────────────────────────────
// Combined User + Partner profile. Used by the dashboard on initial load to
// hydrate the header (avatar + name) + the Profile page form in one call.
// Soft-gated so a pending partner can still view their own profile.
router.get('/partner/me', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const partner = await prisma.affiliateAccount.findUnique({
      where: { id: partnerId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, username: true, createdAt: true, preferredLocale: true, preferredTimezone: true },
        },
      },
    })
    if (!partner) throw new AppError('NOT_FOUND', 'Partner record vanished mid-request', 404)

    res.json({
      data: {
        user: partner.user,
        partner: {
          id:                    partner.id,
          slug:                  partner.slug,
          status:                partner.status,
          partnerPageActive:     partner.partnerPageActive,
          displayName:           partner.displayName,
          avatarUrl:             partner.avatarUrl,
          bio:                   partner.bio,
          partnerPhone:          partner.partnerPhone,
          businessName:          partner.businessName,
          emailSignature:        partner.emailSignature,
          calendarId:            partner.calendarId,
          forwardPlatformEmails: partner.forwardPlatformEmails,
          notifyAppointmentsEnabled: partner.notifyAppointmentsEnabled,
          aggressionTier:        partner.aggressionTier,
          partnerEmail:          partner.slug ? `${partner.slug}@myorbisresults.com` : null,
          partnerStreet:         partner.partnerStreet,
          partnerUnit:           partner.partnerUnit,
          partnerCity:           partner.partnerCity,
          partnerState:          partner.partnerState,
          partnerPostalCode:     partner.partnerPostalCode,
          referralCode:          partner.referralCode,
          totalEarnedCents:      partner.totalEarnedCents,
          totalPaidCents:        partner.totalPaidCents,
        },
      },
    })
  } catch (err) { next(err) }
})

// ─── PATCH /api/partner/profile ─────────────────────────────────────────────
// Editable fields only. Slug / status / payment / referral data are NOT
// touched here — those need admin endpoints or specific flows.
const profileUpdateSchema = z.object({
  displayName:           z.string().min(1).max(100).optional().nullable(),
  bio:                   z.string().max(2000).optional().nullable(),
  partnerPhone:          z.string().max(40).optional().nullable(),
  businessName:          z.string().max(120).optional().nullable(),
  emailSignature:        z.string().max(4000).optional().nullable(),
  calendarId:            z.string().max(200).optional().nullable(),
  forwardPlatformEmails: z.boolean().optional(),
  notifyAppointmentsEnabled: z.boolean().optional(),
  partnerPageActive:     z.boolean().optional(),
  aggressionTier:        z.enum(['conservative', 'balanced', 'direct', 'aggressive']).optional(),
  // Phase F.5 — partner public mailing address. Lenient max-lengths leave
  // room for international addresses; CAN-SPAM only requires the address be
  // accurate, not US-formatted.
  partnerStreet:         z.string().max(200).optional().nullable(),
  partnerUnit:           z.string().max(60).optional().nullable(),
  partnerCity:           z.string().max(100).optional().nullable(),
  partnerState:          z.string().max(60).optional().nullable(),
  partnerPostalCode:     z.string().max(20).optional().nullable(),
})

router.patch('/partner/profile', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = profileUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fieldErrors)
    }

    const updated = await partnerService.updatePartnerProfile(req.user!.id, parsed.data)

    writeAuditLog({
      actorType:    'USER',
      actorUserId:  req.user!.id,
      action:       'partner.profile.updated',
      targetType:   'AffiliateAccount',
      targetId:     partnerId,
      metadataJson: { changedKeys: Object.keys(parsed.data) },
    }).catch(e => console.error('[audit] partner.profile.updated write failed:', e))

    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ─── POST /api/partner/profile/avatar ───────────────────────────────────────
// Avatar upload. 2MB cap, image/* mime check. Writes to /app/uploads/avatars/
// and returns the public URL the dashboard should set as <img src>.
// Per project image rules (memory:image-rules) — only PNG/JPEG/WebP are
// accepted. SVG is excluded (XSS vector); GIF is excluded (animation causes
// inconsistent cross-client rendering and bloats avatar storage).
const AVATAR_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },  // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_ALLOWED_MIMES.has(file.mimetype.toLowerCase())) {
      cb(new AppError('VALIDATION_ERROR', 'Avatar must be a PNG, JPEG, or WebP image', 422))
      return
    }
    cb(null, true)
  },
})

router.post(
  '/partner/profile/avatar',
  requirePartnerAccount,
  avatarUpload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('VALIDATION_ERROR', 'avatar file required (multipart field name: "avatar")', 422)
      const partnerId = (req as any).partnerAccountId as string

      const uploadsDir = process.env['UPLOADS_DIR'] ?? '/app/uploads'
      const avatarsDir = path.join(uploadsDir, 'avatars')
      await fs.mkdir(avatarsDir, { recursive: true })

      // Filename: <partnerId>-<6-byte-hex>.<ext> — keeps a stable per-partner
      // prefix while still making the URL non-guessable.
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/webp': 'webp',
      }
      const ext      = extMap[req.file.mimetype] ?? 'bin'
      const random   = randomBytes(6).toString('hex')
      const filename = `${partnerId}-${random}.${ext}`
      const fullPath = path.join(avatarsDir, filename)
      await fs.writeFile(fullPath, req.file.buffer)

      const publicUrl = `https://api.myorbisvoice.com/uploads/avatars/${filename}`

      const updated = await prisma.affiliateAccount.update({
        where: { id: partnerId },
        data:  { avatarUrl: publicUrl },
        select: { id: true, avatarUrl: true },
      })

      writeAuditLog({
        actorType:    'USER',
        actorUserId:  req.user!.id,
        action:       'partner.avatar.uploaded',
        targetType:   'AffiliateAccount',
        targetId:     partnerId,
        metadataJson: { url: publicUrl, sizeBytes: req.file.size, mime: req.file.mimetype },
      }).catch(e => console.error('[audit] partner.avatar write failed:', e))

      res.json({ data: updated })
    } catch (err) { next(err) }
  },
)

// ── Strict gate for everything below: requires AffiliateAccount with
// status=ACTIVE and a slug. Pending partners get 403s here, which is
// correct — they shouldn't be able to manage calendar / conversations /
// integrations until the platform has finished provisioning them.
router.use('/partner', requirePartnerContext)

// ─── Partner Twilio: visibility (Phase G.1) ─────────────────────────────────
// Read-only endpoints so a partner can see their subaccount status + their
// owned numbers. Number purchases happen admin-side (see admin.ts) until
// the partner self-service buy + Stripe metering ships in Phase G.1.B.

router.get('/partner/twilio/subaccount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { getPartnerSubaccountStatus } = await import('../services/twilio-subaccount.service.js')
    res.json({ data: await getPartnerSubaccountStatus(partnerId) })
  } catch (err) { next(err) }
})

router.get('/partner/twilio/numbers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const numbers = await prisma.phoneNumber.findMany({
      where:  { partnerId },
      select: {
        id: true, e164Number: true, displayLabel: true, notes: true,
        isInboundEnabled: true, isOutboundEnabled: true, isSmsEnabled: true,
        forwardingTarget: true, monthlyPriceCents: true,
        releaseScheduledAt: true, createdAt: true,
        purchaseStatus: true, partnerCapabilityTier: true, a2pStatus: true,
        requestedAt: true, approvedAt: true, rejectionReason: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: { items: numbers, total: numbers.length } })
  } catch (err) { next(err) }
})

// ─── Partner number search (Phase G.1.B) ─────────────────────────────────────
// GET /api/partner/twilio/numbers/search?areaCode=...&type=local|tollfree
// Reads-only — hits Twilio's availablePhoneNumbers inventory. No purchase.
// Country is hardcoded US (only US partners for now per legal-entity scope).
router.get('/partner/twilio/numbers/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const areaCode = (req.query['areaCode'] as string | undefined)?.trim() || undefined
    const pattern  = (req.query['pattern']  as string | undefined)?.trim() || undefined
    const type     = ((req.query['type'] as string | undefined)?.toLowerCase() ?? 'local')
    if (type !== 'local' && type !== 'tollfree') {
      throw new AppError('VALIDATION_ERROR', 'type must be "local" or "tollfree"', 422)
    }
    const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string | undefined) ?? '20', 10) || 20))

    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()
    const searchOpts: Record<string, unknown> = { limit, voiceEnabled: true }
    if (areaCode) searchOpts['areaCode'] = parseInt(areaCode, 10)
    if (pattern)  searchOpts['contains'] = pattern

    const inventory = type === 'tollfree'
      ? await masterClient.availablePhoneNumbers('US').tollFree.list(searchOpts as never)
      : await masterClient.availablePhoneNumbers('US').local.list(searchOpts as never)

    res.json({
      data: inventory.map(n => ({
        phoneNumber:  n.phoneNumber,
        friendlyName: n.friendlyName,
        locality:     n.locality ?? null,
        region:       n.region ?? null,
        capabilities: {
          voice: n.capabilities?.voice ?? false,
          sms:   n.capabilities?.sms ?? false,
          mms:   n.capabilities?.mms ?? false,
        },
      })),
    })
  } catch (err) { next(err) }
})

// ─── Partner number purchase request (Phase G.1.B) ───────────────────────────
// POST /api/partner/twilio/numbers/request
// Body: { phoneNumber: "+15551234567", tier: "VOICE" | "VOICE_SMS" | "TOLLFREE" }
// Creates a PENDING PhoneNumber row. Admin processes via the queue.
const requestNumberSchema = z.object({
  phoneNumber: z.string().regex(/^\+\d{10,15}$/),
  tier:        z.enum(['VOICE', 'VOICE_SMS', 'TOLLFREE']),
  label:       z.string().max(80).optional().nullable(),
})

// ─── Partner Stripe billing (Phase G.1.B-2) ──────────────────────────────────
// Card-on-file setup + payment-method status. Subscription creation happens
// admin-side on approval (not exposed here).

router.get('/partner/billing/payment-method', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { getPartnerPaymentMethodStatus } = await import('../services/partner-billing.service.js')
    res.json({ data: await getPartnerPaymentMethodStatus(partnerId) })
  } catch (err) { next(err) }
})

router.post('/partner/billing/setup-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const body = (req.body ?? {}) as { returnUrl?: string; cancelUrl?: string }
    // Default redirect targets — caller can override if launching the setup
    // flow from a different surface.
    const baseUrl = process.env['APP_BASE_URL'] ?? 'https://app.myorbisvoice.com'
    const returnUrl = body.returnUrl?.trim() || `${baseUrl}/partner-portal/phone-numbers?setup=success`
    const cancelUrl = body.cancelUrl?.trim() || `${baseUrl}/partner-portal/phone-numbers?setup=cancel`
    const { createPartnerSetupSession } = await import('../services/partner-billing.service.js')
    const { url } = await createPartnerSetupSession(partnerId, { returnUrl, cancelUrl })
    res.json({ data: { url } })
  } catch (err) { next(err) }
})

// Phase G.2 — SMS credit balance + ledger.
router.get('/partner/sms-credits', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { getPartnerCreditStatus, getPartnerFinancials, SMS_PACK_DEFS, SMS_CHANNEL_COST } =
      await import('../services/partner-sms-credits.service.js')
    const [status, financials] = await Promise.all([
      getPartnerCreditStatus(partnerId),
      getPartnerFinancials(partnerId),
    ])
    res.json({
      data: {
        ...status,
        packs: Object.values(SMS_PACK_DEFS).map(p => ({
          id:             p.id,
          credits:        p.credits,
          unitAmountCents: p.unitAmount,
        })),
        channelCost: SMS_CHANNEL_COST,
        financials,
      },
    })
  } catch (err) { next(err) }
})

router.post('/partner/sms-credits/purchase-session', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const body = (req.body ?? {}) as { packId?: string; returnUrl?: string; cancelUrl?: string }
    if (body.packId !== 'pack_5' && body.packId !== 'pack_10') {
      throw new AppError('VALIDATION_ERROR', 'packId must be pack_5 or pack_10', 422)
    }
    const baseUrl   = process.env['APP_BASE_URL'] ?? 'https://app.myorbisvoice.com'
    const returnUrl = body.returnUrl?.trim() || `${baseUrl}/partner-portal/phone-numbers?credits=success`
    const cancelUrl = body.cancelUrl?.trim() || `${baseUrl}/partner-portal/phone-numbers?credits=cancel`
    const { createSmsPackCheckoutSession } = await import('../services/partner-sms-credits.service.js')
    const { url } = await createSmsPackCheckoutSession(partnerId, body.packId, { returnUrl, cancelUrl })
    res.json({ data: { url } })
  } catch (err) { next(err) }
})

// Phase G.3 — voice-minute usage summary (post-paid, billed at 30-day cycle).
router.get('/partner/voice-usage', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { getPartnerVoiceUsageSummary, VOICE_RATE_CENTS_PER_MIN } =
      await import('../services/partner-voice-usage.service.js')
    const summary = await getPartnerVoiceUsageSummary(partnerId)
    res.json({ data: { ...summary, rateCents: VOICE_RATE_CENTS_PER_MIN } })
  } catch (err) { next(err) }
})

// Phase G.4 — partner onboarding wizard.
router.get('/partner/onboarding/status', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { getPartnerOnboardingStatus } = await import('../services/partner-onboarding.service.js')
    res.json({ data: await getPartnerOnboardingStatus(partnerId) })
  } catch (err) { next(err) }
})

router.post('/partner/onboarding/mark-step-done', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const stepKey = (req.body ?? {}).stepKey as string | undefined
    const valid = ['profile', 'page', 'payouts', 'calendar', 'booking', 'share', 'number']
    if (!stepKey || !valid.includes(stepKey)) {
      throw new AppError('VALIDATION_ERROR', `stepKey must be one of: ${valid.join(', ')}`, 422)
    }
    const { markPartnerOnboardingStep } = await import('../services/partner-onboarding.service.js')
    const markedDone = await markPartnerOnboardingStep(partnerId, stepKey as never)
    res.json({ data: { ok: true, markedDone } })
  } catch (err) { next(err) }
})

// Toggle the "re-show wizard after completion" override.
router.post('/partner/onboarding/show-wizard', requirePartnerAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const show = (req.body ?? {}).show === true
    const { setPartnerShowWizard } = await import('../services/partner-onboarding.service.js')
    await setPartnerShowWizard(partnerId, show)
    res.json({ data: { ok: true, showOnboardingWizard: show } })
  } catch (err) { next(err) }
})

// Cancel a partner's number Subscription. Webhook releases the Twilio number
// on customer.subscription.deleted. Partner-facing only — admin path can
// piggyback on this if needed.
router.post('/partner/twilio/numbers/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const numberId = req.params['id']!
    const number = await prisma.phoneNumber.findUnique({ where: { id: numberId } })
    if (!number || number.partnerId !== partnerId) {
      throw new AppError('NOT_FOUND', 'Number not found', 404)
    }
    if (number.purchaseStatus !== 'PURCHASED') {
      throw new AppError('CONFLICT', `Number is ${number.purchaseStatus}; only PURCHASED numbers can be canceled`, 409)
    }
    if (!number.stripeSubscriptionId) {
      // No subscription wired — fall back to direct release (legacy rows).
      throw new AppError('FAILED_PRECONDITION', 'Number has no active subscription. Contact admin.', 412)
    }
    const { cancelPartnerNumberSubscription } = await import('../services/partner-billing.service.js')
    await cancelPartnerNumberSubscription(numberId)
    res.json({ data: { ok: true, message: 'Subscription canceled. Number will be released shortly.' } })
  } catch (err) { next(err) }
})

router.post('/partner/twilio/numbers/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = requestNumberSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid request', 422, fieldErrors)
    }
    const { phoneNumber, tier, label } = parsed.data

    // Tier → price + A2P state. Codified here so the price shown to the
    // partner at request time is exactly what gets billed.
    const priceForTier: Record<typeof tier, number> = { VOICE: 200, VOICE_SMS: 1500, TOLLFREE: 500 }
    const a2pForTier: Record<typeof tier, 'NOT_REQUIRED' | 'PENDING_QUEUE'> = {
      VOICE:     'NOT_REQUIRED',
      VOICE_SMS: 'PENDING_QUEUE',
      TOLLFREE:  'NOT_REQUIRED',
    }

    // Reject duplicate active row for the same partner + number.
    const conflict = await prisma.phoneNumber.findFirst({
      where: { partnerId, e164Number: phoneNumber, purchaseStatus: { in: ['PENDING', 'APPROVED', 'PURCHASED'] } },
    })
    if (conflict) {
      throw new AppError('CONFLICT', 'You already have an active request or active number for this phone number', 409)
    }

    // Platform tenant — partner numbers parent under it so tenantId-keyed
    // queries don't break elsewhere.
    const platformTenant = await prisma.tenant.findFirst({
      where:  { slug: 'orbis-platform' },
      select: { id: true },
    })
    if (!platformTenant) throw new AppError('INTERNAL_ERROR', 'Platform tenant not found', 500)

    // Phase G.2.2 — auto-approve flow. Create the row in PENDING, then run
    // provisionPartnerNumber() inline (buy on Twilio + move to subaccount +
    // Stripe charge). On success the row flips to PURCHASED in the same
    // request; on failure the helper rolls back + persists the failure
    // reason on the row (purchaseStatus = REJECTED with rejectionReason).
    // Admin keeps the "Disable" action for after-the-fact disabling.
    const row = await prisma.phoneNumber.create({
      data: {
        tenantId:              platformTenant.id,
        partnerId,
        e164Number:            phoneNumber,
        displayLabel:          label ?? null,
        purchaseStatus:        'PENDING',
        partnerCapabilityTier: tier,
        monthlyPriceCents:     priceForTier[tier],
        a2pStatus:             a2pForTier[tier],
        requestedAt:           new Date(),
        requestedByUserId:     req.user!.id,
        isInboundEnabled:      false,
        isOutboundEnabled:     false,
        isSmsEnabled:          false,
      },
    })

    writeAuditLog({
      actorType:    'USER',
      actorUserId:  req.user!.id,
      action:       'partner.number_requested',
      targetType:   'PhoneNumber',
      targetId:     row.id,
      metadataJson: { partnerId, phoneNumber, tier },
    }).catch(e => console.error('[audit] number_requested write failed:', e))

    const { provisionPartnerNumber } = await import('../services/partner-billing.service.js')
    try {
      const result = await provisionPartnerNumber({
        phoneNumberRowId: row.id,
        actorUserId:      req.user!.id,
        actorType:        'USER',
      })
      res.json({
        data: {
          id:                  result.id,
          status:              result.status,
          monthlyPriceCents:   priceForTier[tier],
          twilioNumberSid:     result.twilioNumberSid,
          stripeSubscriptionId: result.stripeSubscriptionId,
        },
      })
    } catch (provisionErr) {
      // Provisioning helper has already persisted REJECTED + rejectionReason on
      // the row by this point. Surface the error to the partner so they know
      // what happened and can retry (with a new number or after fixing card).
      throw provisionErr
    }
  } catch (err) { next(err) }
})

// ─── Per-partner Google Calendar OAuth (Phase E.0) ──────────────────────────
//
// Each partner can connect their OWN Google account. Tokens land on a
// dedicated IntegrationConnection row (tenantId=null, linked from
// AffiliateAccount.integrationConnectionId). Used by:
//   - the agent's book_appointment when the widget runs on a partner page
//     (E.2) — routes booking to THIS partner's calendar
//   - the partner-portal calendar view (E.1)
//   - the public prospect-booking page at /p/<slug>/book (E.4)
//
// OAuth callback hits the shared /api/integrations/google/callback route
// (which dispatches on state metadata to handlePartnerGoogleCallback).

router.get('/partner/integrations/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const status = await googleService.getPartnerGoogleConnection(partnerId)
    res.json({ data: status })
  } catch (err) { next(err) }
})

router.post('/partner/integrations/google/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const { url } = await googleService.startPartnerGoogleOAuth(partnerId, req.user!.id)
    res.json({ data: { url } })
  } catch (err) { next(err) }
})

router.delete('/partner/integrations/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    await googleService.disconnectPartnerGoogle(partnerId, req.user!.id)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ─── Partner Calendar (Phase E.1) ───────────────────────────────────────────
//
// GET /api/partner/calendar/events?from=ISO&to=ISO[&calendarId=...]
// Fetches events from the partner's connected Google Calendar over the given
// range. If calendarId is omitted, uses AffiliateAccount.calendarId (which is
// auto-populated to the primary calendar on first OAuth connect — see E.0).
// Returns normalized event shape suitable for direct rendering by the
// <PartnerCalendarView> component.

const calendarEventsSchema = z.object({
  from: z.string().min(1, 'from is required (ISO datetime)'),
  to:   z.string().min(1, 'to is required (ISO datetime)'),
  calendarId: z.string().optional(),
})

router.get('/partner/calendar/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = calendarEventsSchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 422)
    }
    const { from, to, calendarId } = parsed.data

    // Validate ISO range — caller passes a window like "this week" or
    // "next 30 days"; we trust them but defend against pathologically large
    // ranges that would blow up the Google API quota.
    const fromMs = new Date(from).getTime()
    const toMs   = new Date(to).getTime()
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new AppError('VALIDATION_ERROR', 'from and to must be valid ISO datetimes', 422)
    }
    if (toMs - fromMs > 90 * 24 * 60 * 60 * 1000) {
      throw new AppError('VALIDATION_ERROR', 'Range cannot exceed 90 days', 422)
    }

    const partner = await prisma.affiliateAccount.findUnique({ where: { id: partnerId } })
    if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

    if (!partner.integrationConnectionId) {
      // Partner hasn't connected Google yet — return an empty list with a
      // structured signal the UI can render as a "Connect Google" CTA.
      res.json({ data: { events: [], notConnected: true, calendarId: null } })
      return
    }

    // Resolve which calendar to read. Caller can override (e.g. show a non-
    // primary calendar) — falls back to whatever's stored on the partner row.
    const targetCalendarId = calendarId ?? partner.calendarId ?? 'primary'

    const { google } = await import('googleapis')
    const client = await googleService.getAuthenticatedGoogleClientForPartner(partnerId)
    const cal = google.calendar({ version: 'v3', auth: client })

    const resp = await cal.events.list({
      calendarId:  targetCalendarId,
      timeMin:     from,
      timeMax:     to,
      singleEvents: true,                  // expands recurring events into instances
      orderBy:     'startTime',
      maxResults:  250,
    })

    // Normalize for the UI. Events with no `start.dateTime` are all-day —
    // expose their `start.date` separately so the component can render them
    // distinctly. Mark events that were created by MyOrbisVoice
    // (extendedProperties.private.source = 'myorbisvoice') so the UI can
    // tag them visually.
    const events = (resp.data.items ?? []).map((e) => {
      const isMOV = e.extendedProperties?.private?.['source'] === 'myorbisvoice'
      return {
        id:       e.id,
        title:    e.summary ?? '(no title)',
        start:    e.start?.dateTime ?? e.start?.date ?? null,
        end:      e.end?.dateTime   ?? e.end?.date   ?? null,
        allDay:   !e.start?.dateTime,
        location: e.location ?? null,
        attendees:(e.attendees ?? []).map(a => ({ email: a.email, name: a.displayName ?? null, response: a.responseStatus ?? null })),
        organizerEmail: e.organizer?.email ?? null,
        htmlLink: e.htmlLink ?? null,
        source:   isMOV ? 'myorbisvoice' : 'external',
      }
    })

    res.json({ data: { events, notConnected: false, calendarId: targetCalendarId } })
  } catch (err) { next(err) }
})

// ─── Partner booking preferences (Phase E.3) ────────────────────────────────
//
// Working hours, slot length, min notice, max advance window, and pre/post
// buffer for partner-side bookings. These constrain what slots the agent can
// offer (search_availability with partnerId) and what the public /p/<slug>/book
// page (E.4) exposes to prospects.

router.get('/partner/booking-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await partnerService.getPartnerBookingPreferences(req.user!.id)
    res.json({ data: prefs })
  } catch (err) { next(err) }
})

router.put('/partner/booking-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await partnerService.updatePartnerBookingPreferences(req.user!.id, req.body ?? {})
    await writeAuditLog({
      actorUserId:  req.user!.id,
      actorType:    'USER',
      action:       'partner.booking_preferences.updated',
      targetType:   'AffiliateAccount',
      targetId:     (req as any).partnerAccountId,
      metadataJson: { fields: Object.keys(req.body ?? {}) },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ─── Partner landing-page analytics (Phase E.15) ────────────────────────────
//
// Per-variation visit + conversion stats for the partner's landing pages.
// AffiliateClick rows already capture visits (each landing-page pageview
// fires a beacon to /api/public/track/click). Conversions = Conversations
// that share the partner's id, grouped by the landing path of the click that
// preceded them. For the MVP we use a simple landingPath GROUP BY — a 1:1
// click-to-conversation join would require cookie threading we don't have
// across the static page → API hop today.

router.get('/partner/landing-page-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string

    // Visits per variation — grouped by the URL path. We bucket by
    // /voice-1/, /voice-2/, /voice-3/ (and their /es/ mirrors). Anything else
    // (legacy or non-variation paths) is ignored.
    const visits = await prisma.affiliateClick.groupBy({
      by:    ['landingPath'],
      where: { affiliateAccountId: partnerId, landingPath: { not: null } },
      _count: { _all: true },
    })

    // Conversations per variation — Conversation.partnerId matches. We can't
    // attribute each conversation back to the exact landing page (no
    // referer-on-conversion threading yet), so the conversion total is the
    // partner's total conversation count for now. A future enhancement would
    // stash the landing-page slug on Conversation.metadataJson at session
    // start so per-variation conversion rates are accurate, not bucket-level.
    const totalConversations = await prisma.conversation.count({ where: { partnerId } })

    // Bucket the visit data into clean per-variation rows so the UI doesn't
    // have to know about Spanish mirrors or trailing slashes.
    function bucket(path: string): number | null {
      const m = /\/voice-(\d)\//.exec(path)
      if (!m || !m[1]) return null
      const n = parseInt(m[1], 10)
      return [1, 2, 3].includes(n) ? n : null
    }

    const perVariation: Record<number, { visits: number }> = { 1: { visits: 0 }, 2: { visits: 0 }, 3: { visits: 0 } }
    let totalVisits = 0
    for (const v of visits) {
      const n = v.landingPath ? bucket(v.landingPath) : null
      if (n !== null) perVariation[n]!.visits += v._count._all
      if (n !== null) totalVisits += v._count._all
    }

    res.json({
      data: {
        totalVisits,
        totalConversations,
        variations: [1, 2, 3].map(n => ({
          variation: n,
          visits:    perVariation[n]!.visits,
        })),
      },
    })
  } catch (err) { next(err) }
})

// ─── Partner Reminder Preferences (Phase E.12) ──────────────────────────────
//
// Per-partner override of the reminder cadence + channels for partner-routed
// bookings. Same shape + validation as the tenant-side endpoint, but reads
// from / writes to AffiliateAccount columns instead of BusinessProfile.

router.get('/partner/reminder-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await partnerService.getPartnerReminderPreferences(req.user!.id)
    res.json({ data: prefs })
  } catch (err) { next(err) }
})

router.put('/partner/reminder-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await partnerService.updatePartnerReminderPreferences(req.user!.id, req.body ?? {})
    await writeAuditLog({
      actorUserId:  req.user!.id,
      actorType:    'USER',
      action:       'partner.reminder_preferences.updated',
      targetType:   'AffiliateAccount',
      targetId:     (req as any).partnerAccountId,
      metadataJson: { fields: Object.keys(req.body ?? {}) },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ─── Partner Conversations (Phase E.9) ──────────────────────────────────────
//
// Surfaces every widget conversation that originated on this partner's
// landing pages (Conversation.partnerId = this partner). Includes the
// AI-generated summary, full speaker-labelled transcript, the audio recording
// (when E.8 capture was successful), and any appointments that came out of
// the call.

const conversationsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

router.get('/partner/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = conversationsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 422)
    }
    const limit  = parsed.data.limit  ?? 50
    const offset = parsed.data.offset ?? 0

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where:   { partnerId },
        orderBy: { startedAt: 'desc' },
        take:    limit,
        skip:    offset,
        select: {
          id:                    true,
          channelType:           true,
          startedAt:             true,
          endedAt:               true,
          status:                true,
          summaryText:           true,
          outcomeCode:           true,
          recordingRef:          true,
          recordingDurationSecs: true,
          contact: {
            select: { id: true, fullName: true, firstName: true, email: true, phoneE164: true },
          },
          appointments: {
            select: { id: true, status: true, startAt: true, appointmentType: true },
          },
        },
      }),
      prisma.conversation.count({ where: { partnerId } }),
    ])

    res.json({
      data: {
        items: conversations.map(c => ({
          id:                    c.id,
          channelType:           c.channelType,
          startedAt:             c.startedAt.toISOString(),
          endedAt:               c.endedAt?.toISOString() ?? null,
          status:                c.status,
          summary:               c.summaryText,
          outcomeCode:           c.outcomeCode,
          hasRecording:          !!c.recordingRef,
          recordingDurationSecs: c.recordingDurationSecs,
          contact:               c.contact,
          appointmentCount:      c.appointments.length,
        })),
        total,
        limit,
        offset,
      },
    })
  } catch (err) { next(err) }
})

router.get('/partner/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const id = req.params['id']
    if (!id) throw new AppError('VALIDATION_ERROR', 'id required', 422)

    const conv = await prisma.conversation.findFirst({
      where: { id, partnerId },  // ownership check — partner only sees their own
      select: {
        id:                    true,
        channelType:           true,
        startedAt:             true,
        endedAt:               true,
        status:                true,
        summaryText:           true,
        transcriptJson:        true,
        outcomeCode:           true,
        recordingRef:          true,
        recordingBunnyPath:    true,
        recordingDurationSecs: true,
        contact: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true, phoneE164: true },
        },
        appointments: {
          select: {
            id: true, status: true, startAt: true, endAt: true,
            appointmentType: true, timezone: true, location: true, notes: true,
          },
          orderBy: { startAt: 'asc' },
        },
      },
    })
    if (!conv) throw new AppError('NOT_FOUND', 'Conversation not found', 404)

    res.json({
      data: {
        id:                    conv.id,
        channelType:           conv.channelType,
        startedAt:             conv.startedAt.toISOString(),
        endedAt:               conv.endedAt?.toISOString() ?? null,
        status:                conv.status,
        summary:               conv.summaryText,
        transcript:            (conv.transcriptJson as unknown[]) ?? [],
        outcomeCode:           conv.outcomeCode,
        hasRecording:          !!conv.recordingRef,
        recordingUrl:          conv.recordingRef,
        recordingDurationSecs: conv.recordingDurationSecs,
        contact:               conv.contact,
        appointments:          conv.appointments.map(a => ({
          id:              a.id,
          status:          a.status,
          startAt:         a.startAt.toISOString(),
          endAt:           a.endAt.toISOString(),
          appointmentType: a.appointmentType,
          timezone:        a.timezone,
          location:        a.location,
          notes:           a.notes,
        })),
      },
    })
  } catch (err) { next(err) }
})

export default router
