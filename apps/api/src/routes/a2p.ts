/**
 * A2P 10DLC application — tenant-scoped routes.
 *
 * Lifecycle: PUT (save DRAFT) → POST /validate (4-layer gate) →
 * POST /authorize (record customer consent) → POST /submit (Trust Hub
 * pipeline, mock or live) → POST /sync (refresh status from Twilio).
 *
 * All submission/validation logic lives in a2p.service.ts — this router is
 * thin and shares that engine with the partner-scoped router (partner-a2p.ts).
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { Prisma } from '@prisma/client'
import { writeAuditLogFromRequest } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import {
  runValidationGate,
  authorizeA2PApplication,
  submitA2PApplication,
  syncA2PStatus,
  A2P_EDITABLE_STATUSES,
} from '../services/a2p.service.js'

const router: IRouter = Router()
router.use('/a2p', authenticate, requireTenantContext)

/** Shared form schema — also imported by the partner-scoped router. */
export const a2pSchema = z.object({
  legalName:         z.string().min(2).max(120),
  ein:               z.string().regex(/^\d{2}-?\d{7}$/, 'EIN must be in XX-XXXXXXX format').optional().or(z.literal('')),
  businessType:      z.enum(['SOLE_PROP', 'LLC', 'CORP', 'NON_PROFIT', 'PARTNERSHIP']),
  vertical:          z.string().min(2).max(60),
  websiteUrl:        z.string().url().optional().or(z.literal('')),
  addressLine1:      z.string().min(2).max(120),
  addressLine2:      z.string().max(120).optional().or(z.literal('')),
  city:              z.string().min(1).max(60),
  region:            z.string().min(2).max(60),
  postalCode:        z.string().min(3).max(20),
  country:           z.string().length(2).default('US'),
  contactFirstName:  z.string().min(1).max(60),
  contactLastName:   z.string().min(1).max(60),
  contactEmail:      z.string().email(),
  contactPhone:      z.string().min(7).max(20),
  useCase:           z.enum(['marketing', 'mixed', 'customer_care', '2fa', 'utility']),
  sampleMessages:    z.array(z.string().min(10).max(1600)).min(1).max(10),
})

export type A2PInput = z.infer<typeof a2pSchema>

/** Maps validated form input onto the TenantA2PApplication scalar columns. */
export function a2pScalarFields(data: A2PInput) {
  return {
    legalName:          data.legalName,
    ein:                data.ein || null,
    businessType:       data.businessType,
    vertical:           data.vertical,
    websiteUrl:         data.websiteUrl || null,
    addressLine1:       data.addressLine1,
    addressLine2:       data.addressLine2 || null,
    city:               data.city,
    region:             data.region,
    postalCode:         data.postalCode,
    country:            data.country,
    contactFirstName:   data.contactFirstName,
    contactLastName:    data.contactLastName,
    contactEmail:       data.contactEmail,
    contactPhone:       data.contactPhone,
    useCase:            data.useCase,
    sampleMessagesJson: data.sampleMessages,
  }
}

/** Fields reset whenever the form is edited — a new edit invalidates any
 *  prior validation gate run + customer authorization. */
export const a2pResetOnEdit = {
  status:               'DRAFT' as const,
  rejectionReason:      null,
  validationReportJson: Prisma.DbNull,
  validatedAt:          null,
  authorizedAt:         null,
  authorizedByUserId:   null,
}

// GET /api/a2p — fetch the tenant's current application (or null if not started)
router.get('/a2p', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  res.json({ data: app })
}))

// PUT /api/a2p — upsert the application as DRAFT. Editing clears any prior
// validation/authorization (those must be re-run on the new data).
router.put('/a2p', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const data = a2pSchema.parse(req.body)

  const existing = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (existing && !(A2P_EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new AppError('CONFLICT', `Application is in ${existing.status} status — cannot edit`, 409)
  }

  const fields = a2pScalarFields(data)
  const app = await prisma.tenantA2PApplication.upsert({
    where: { tenantId },
    create: { tenantId, ...fields, status: 'DRAFT' },
    update: { ...fields, ...a2pResetOnEdit },
  })
  res.json({ data: app })
}))

// POST /api/a2p/validate — run the 4-layer pre-submission gate.
router.post('/a2p/validate', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await runValidationGate(app.id)
  res.json({ data: updated })
}))

// POST /api/a2p/authorize — record the customer's explicit consent to submit.
router.post('/a2p/authorize', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await authorizeA2PApplication(app.id, req.user!.id)
  writeAuditLogFromRequest(req, {
    actorType: 'USER', actorUserId: req.user!.id, tenantId,
    action: 'a2p.authorized',
    targetType: 'TenantA2PApplication', targetId: updated.id,
  }).catch(() => null)
  res.json({ data: updated })
}))

// POST /api/a2p/submit — run the Trust Hub submission pipeline.
router.post('/a2p/submit', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await submitA2PApplication(app.id)
  writeAuditLogFromRequest(req, {
    actorType: 'USER', actorUserId: req.user!.id, tenantId,
    action: 'a2p.submitted',
    targetType: 'TenantA2PApplication', targetId: updated.id,
    metadataJson: { mode: updated.submissionMode, useCase: updated.useCase, vertical: updated.vertical },
  }).catch(() => null)
  res.json({ data: updated })
}))

// POST /api/a2p/sync — refresh the application status from Twilio.
router.post('/a2p/sync', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (!app) throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  const updated = await syncA2PStatus(app.id)
  res.json({ data: updated })
}))

export default router
