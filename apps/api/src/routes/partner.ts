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
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },  // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('VALIDATION_ERROR', 'Avatar must be an image (JPEG, PNG, WebP)', 422))
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
        'image/webp': 'webp', 'image/gif': 'gif',
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

export default router
