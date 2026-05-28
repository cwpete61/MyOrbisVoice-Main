/**
 * Partner Webinar Marketing routes — mounted at /api/partner/webinar-marketing/*.
 * Gated by requirePartnerContext (sets req.partnerAccountId).
 *
 * Phase 1 surface:
 *   GET    /lists                 — list this partner's lead lists
 *   POST   /lists                 — create new lead list
 *   GET    /lists/:id             — list detail
 *   PATCH  /lists/:id             — update list config
 *   DELETE /lists/:id             — archive (soft delete)
 *
 * Phase 2-4 will add:
 *   POST   /lists/:id/discover    — kick off discovery worker
 *   GET    /lists/:id/queue       — manual-review queue
 *   POST   /queue/:emailId/approve
 *   POST   /queue/:emailId/reject
 *   GET    /lists/:id/export      — CSV download
 *   GET    /suppressions          — suppression list mgmt
 *   POST   /suppressions          — add suppression entry
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import {
  createListSchema,
  updateListSchema,
  listForPartner,
  getById,
  create,
  update,
  archive,
} from '../services/webinar-marketing/lists.service.js'
import { log as auditLog } from '../services/webinar-marketing/audit.service.js'
import { startDiscovery } from '../services/webinar-marketing/worker.service.js'
import { promoteToInvite } from '../services/webinar-marketing/promotion.service.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()
router.use('/partner/webinar-marketing', authenticate, requirePartnerContext)

// List
router.get('/partner/webinar-marketing/lists', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const data = await listForPartner(partnerId)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// Create
router.post('/partner/webinar-marketing/lists', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = createListSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        422,
      )
    }
    const list = await create(partnerId, parsed.data)
    void auditLog({
      partnerId,
      action: 'list_created',
      entityType: 'WebinarLeadList',
      entityId: list.id,
      details: { name: list.name, niche: list.niche, location: list.location },
    })
    res.status(201).json({ data: list })
  } catch (err) {
    next(err)
  }
})

// Detail
router.get('/partner/webinar-marketing/lists/:id', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const list = await getById(partnerId, req.params.id)
    res.json({ data: list })
  } catch (err) {
    next(err)
  }
})

// Update
router.patch('/partner/webinar-marketing/lists/:id', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = updateListSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        422,
      )
    }
    const updated = await update(partnerId, req.params.id, parsed.data)
    void auditLog({
      partnerId,
      action: 'list_updated',
      entityType: 'WebinarLeadList',
      entityId: updated.id,
      details: parsed.data as Record<string, unknown>,
    })
    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// Kick off discovery — DRAFT → DISCOVERING, enqueues SearchQuery rows.
router.post(
  '/partner/webinar-marketing/lists/:id/discover',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      // Ownership check — throws 404 if not this partner's list.
      const list = await getById(partnerId, req.params.id)
      const result = await startDiscovery(list.id)
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  },
)

// Archive (soft delete)
router.delete('/partner/webinar-marketing/lists/:id', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const archived = await archive(partnerId, req.params.id)
    void auditLog({
      partnerId,
      action: 'list_archived',
      entityType: 'WebinarLeadList',
      entityId: archived.id,
    })
    res.json({ data: archived })
  } catch (err) {
    next(err)
  }
})

// ─── CSV export ──────────────────────────────────────────────────────────────

// Stream all WebinarInviteContact rows for a list as CSV. Includes the
// fields the spec mandates: list_name, business_name, email, niche, location,
// source_url, verification_status, consent_status, lawful_basis_notes, added_at.
router.get(
  '/partner/webinar-marketing/lists/:id/export',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      const list = await getById(partnerId, req.params.id)
      const contacts = await prisma.webinarInviteContact.findMany({
        where: { leadListId: list.id, unsubscribedAt: null },
        orderBy: { addedAt: 'asc' },
      })

      const header = [
        'list_name',
        'business_name',
        'email',
        'niche',
        'location',
        'source_url',
        'verification_status',
        'consent_status',
        'lawful_basis_notes',
        'added_at',
      ]
      const rows = contacts.map((c) => [
        list.name,
        c.businessName ?? '',
        c.email,
        c.niche,
        c.location,
        c.sourceUrl,
        c.verificationStatus,
        c.consentStatus,
        c.lawfulBasisNotes ?? '',
        c.addedAt.toISOString(),
      ])
      const csv = [header, ...rows].map(csvLine).join('\n')

      void auditLog({
        partnerId,
        action: 'exported_csv',
        entityType: 'WebinarLeadList',
        entityId: list.id,
        details: { rowCount: contacts.length },
      })

      const safeName = list.name.replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="webinar-invites-${safeName}.csv"`,
      )
      res.send(csv)
    } catch (err) {
      next(err)
    }
  },
)

function csvLine(fields: (string | null | undefined)[]): string {
  return fields
    .map((f) => {
      const v = (f ?? '').toString()
      if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`
      return v
    })
    .join(',')
}

// ─── Review queue ────────────────────────────────────────────────────────────

// List QUARANTINED rows that need operator decision.
router.get(
  '/partner/webinar-marketing/lists/:id/queue',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      const list = await getById(partnerId, req.params.id)
      const rows = await prisma.webinarExtractedEmail.findMany({
        where: {
          leadListId: list.id,
          classificationStatus: 'QUARANTINED',
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: {
          verifications: { orderBy: { verifiedAt: 'desc' }, take: 1 },
        },
      })
      res.json({ data: rows })
    } catch (err) {
      next(err)
    }
  },
)

const approveSchema = z.object({
  consentStatus: z.enum([
    'OPTED_IN',
    'EXISTING_CUSTOMER',
    'MANUAL_LAWFUL_BASIS_REVIEWED',
  ]),
  lawfulBasisNotes: z.string().max(2000).optional(),
  businessName: z.string().max(200).optional(),
})

// Approve one quarantined row → run promotion gate. Returns ok/false + reason.
router.post(
  '/partner/webinar-marketing/queue/:emailId/approve',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      const parsed = approveSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message ?? 'Invalid input',
          422,
        )
      }
      // Ownership check via the parent list.
      const row = await prisma.webinarExtractedEmail.findUnique({
        where: { id: req.params.emailId },
        include: { leadList: true },
      })
      if (!row || row.leadList.partnerId !== partnerId) {
        throw new AppError('NOT_FOUND', 'Extracted email not found', 404)
      }
      const outcome = await promoteToInvite({
        extractedEmailId: row.id,
        consentStatus: parsed.data.consentStatus,
        lawfulBasisNotes: parsed.data.lawfulBasisNotes ?? null,
        businessName: parsed.data.businessName ?? null,
      })
      if (outcome.ok) {
        void auditLog({
          partnerId,
          action: 'manual_review_approved',
          entityType: 'WebinarExtractedEmail',
          entityId: row.id,
          details: {
            contactId: outcome.contactId,
            consentStatus: parsed.data.consentStatus,
          },
        })
        res.json({ data: outcome })
        return
      }
      res.status(409).json({ error: { code: 'PROMOTION_BLOCKED', message: outcome.reason } })
    } catch (err) {
      next(err)
    }
  },
)

// Reject quarantined row → marks REJECTED + optional reviewer note.
router.post(
  '/partner/webinar-marketing/queue/:emailId/reject',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      const notes = z.string().max(2000).optional().parse(req.body?.notes)
      const row = await prisma.webinarExtractedEmail.findUnique({
        where: { id: req.params.emailId },
        include: { leadList: true },
      })
      if (!row || row.leadList.partnerId !== partnerId) {
        throw new AppError('NOT_FOUND', 'Extracted email not found', 404)
      }
      await prisma.webinarExtractedEmail.update({
        where: { id: row.id },
        data: {
          classificationStatus: 'REJECTED',
          reviewerNotes: notes ?? null,
        },
      })
      void auditLog({
        partnerId,
        action: 'manual_review_rejected',
        entityType: 'WebinarExtractedEmail',
        entityId: row.id,
        details: { notes: notes ?? null },
      })
      res.json({ data: { ok: true } })
    } catch (err) {
      next(err)
    }
  },
)

// ─── Suppression list ────────────────────────────────────────────────────────

router.get('/partner/webinar-marketing/suppressions', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const rows = await prisma.webinarSuppression.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

const addSuppressionSchema = z.object({
  email: z.string().email().max(320),
  reason: z.enum([
    'unsubscribed',
    'bounce',
    'complaint',
    'manual',
    'role_suppressed',
    'imported',
  ]),
  source: z.string().max(200).optional(),
})

router.post('/partner/webinar-marketing/suppressions', async (req, res, next) => {
  try {
    const partnerId = (req as any).partnerAccountId as string
    const parsed = addSuppressionSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        422,
      )
    }
    const normalized = parsed.data.email.toLowerCase().trim()
    const row = await prisma.webinarSuppression.upsert({
      where: {
        partnerId_normalizedEmail: { partnerId, normalizedEmail: normalized },
      },
      create: {
        partnerId,
        email: parsed.data.email,
        normalizedEmail: normalized,
        reason: parsed.data.reason,
        source: parsed.data.source ?? null,
      },
      update: { reason: parsed.data.reason, source: parsed.data.source ?? null },
    })
    res.status(201).json({ data: row })
  } catch (err) {
    next(err)
  }
})

router.delete(
  '/partner/webinar-marketing/suppressions/:id',
  async (req, res, next) => {
    try {
      const partnerId = (req as any).partnerAccountId as string
      const row = await prisma.webinarSuppression.findUnique({
        where: { id: req.params.id },
      })
      if (!row || row.partnerId !== partnerId) {
        throw new AppError('NOT_FOUND', 'Suppression entry not found', 404)
      }
      await prisma.webinarSuppression.delete({ where: { id: row.id } })
      res.json({ data: { ok: true } })
    } catch (err) {
      next(err)
    }
  },
)

export default router
