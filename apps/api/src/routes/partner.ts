import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import multer from 'multer'
import path from 'path'
import { promises as fs } from 'fs'
import { randomBytes } from 'crypto'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
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

// All routes require partner auth
router.use('/partner', authenticate, requirePartnerContext)

// ─── GET /api/partner/me ────────────────────────────────────────────────────
// Combined User + Partner profile. Used by the dashboard on initial load to
// hydrate the header (avatar + name) + the Profile page form in one call.
router.get('/partner/me', async (req: Request, res: Response, next: NextFunction) => {
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
          aggressionTier:        partner.aggressionTier,
          partnerEmail:          partner.slug ? `${partner.slug}@myorbisresults.com` : null,
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
  aggressionTier:        z.enum(['conservative', 'balanced', 'direct', 'aggressive']).optional(),
})

router.patch('/partner/profile', async (req: Request, res: Response, next: NextFunction) => {
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
