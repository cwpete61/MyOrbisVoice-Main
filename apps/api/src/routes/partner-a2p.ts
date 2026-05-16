/**
 * A2P 10DLC application — partner-scoped routes.
 *
 * Partners register their own A2P brand/campaign for the numbers they
 * manage. Same lifecycle and same submission engine as the tenant-scoped
 * router (a2p.ts) — only the scope key differs (partnerId vs tenantId).
 *
 * Auth: authenticate + requirePartnerContext (adds req.partnerAccountId).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { a2pSchema, a2pScalarFields, a2pResetOnEdit } from './a2p.js'
import {
  runValidationGate,
  authorizeA2PApplication,
  submitA2PApplication,
  syncA2PStatus,
  A2P_EDITABLE_STATUSES,
} from '../services/a2p.service.js'

const router: IRouter = Router()
router.use('/partner/a2p', authenticate, requirePartnerContext)

const partnerId = (req: Request): string => (req as any).partnerAccountId as string

// GET /api/partner/a2p — fetch the partner's current application (or null)
router.get('/partner/a2p', asyncHandler(async (req: Request, res: Response) => {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: partnerId(req) } })
  res.json({ data: app })
}))

// PUT /api/partner/a2p — upsert the application as DRAFT.
router.put('/partner/a2p', asyncHandler(async (req: Request, res: Response) => {
  const pid = partnerId(req)
  const data = a2pSchema.parse(req.body)

  const existing = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: pid } })
  if (existing && !(A2P_EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new AppError('CONFLICT', `Application is in ${existing.status} status — cannot edit`, 409)
  }

  const fields = a2pScalarFields(data)
  const app = await prisma.tenantA2PApplication.upsert({
    where: { partnerId: pid },
    create: { partnerId: pid, ...fields, status: 'DRAFT' },
    update: { ...fields, ...a2pResetOnEdit },
  })
  res.json({ data: app })
}))

// POST /api/partner/a2p/validate — run the 4-layer pre-submission gate.
router.post('/partner/a2p/validate', asyncHandler(async (req: Request, res: Response) => {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: partnerId(req) } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  res.json({ data: await runValidationGate(app.id) })
}))

// POST /api/partner/a2p/authorize — record the partner's consent to submit.
router.post('/partner/a2p/authorize', asyncHandler(async (req: Request, res: Response) => {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: partnerId(req) } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await authorizeA2PApplication(app.id, req.user!.id)
  writeAuditLogFromRequest(req, {
    actorType: 'USER', actorUserId: req.user!.id,
    action: 'a2p.authorized',
    targetType: 'TenantA2PApplication', targetId: updated.id,
  }).catch(() => null)
  res.json({ data: updated })
}))

// POST /api/partner/a2p/submit — run the Trust Hub submission pipeline.
router.post('/partner/a2p/submit', asyncHandler(async (req: Request, res: Response) => {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: partnerId(req) } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await submitA2PApplication(app.id)
  writeAuditLogFromRequest(req, {
    actorType: 'USER', actorUserId: req.user!.id,
    action: 'a2p.submitted',
    targetType: 'TenantA2PApplication', targetId: updated.id,
    metadataJson: { mode: updated.submissionMode, scope: 'partner' },
  }).catch(() => null)
  res.json({ data: updated })
}))

// POST /api/partner/a2p/sync — refresh the application status from Twilio.
router.post('/partner/a2p/sync', asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { partnerId: partnerId(req) } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  res.json({ data: await syncA2PStatus(app.id) })
}))

export default router
