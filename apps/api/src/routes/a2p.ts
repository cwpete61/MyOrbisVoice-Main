/**
 * A2P 10DLC application — tenant submits the form, the data is stored,
 * and (once Twilio ISV approval is in place) a follow-up service submits
 * to Twilio Trust Hub APIs.
 *
 * Submit-to-Twilio is intentionally NOT wired here — that requires ISV
 * credentials we don't have yet. The form just persists the data so we
 * can either submit in bulk once approved, or have an ops human post
 * to Trust Hub manually until the automation is built.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

const a2pSchema = z.object({
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

// GET /api/a2p — fetch the tenant's current application (or null if not started)
router.get('/a2p', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  res.json({ data: app })
}))

// PUT /api/a2p — upsert the application (DRAFT). Submitting separately moves to SUBMITTED.
router.put('/a2p', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const data = a2pSchema.parse(req.body)

  const existing = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    throw new AppError('CONFLICT', `Application is in ${existing.status} status — cannot edit`, 409)
  }

  const app = await prisma.tenantA2PApplication.upsert({
    where: { tenantId },
    create: {
      tenantId,
      legalName:         data.legalName,
      ein:               data.ein || null,
      businessType:      data.businessType,
      vertical:          data.vertical,
      websiteUrl:        data.websiteUrl || null,
      addressLine1:      data.addressLine1,
      addressLine2:      data.addressLine2 || null,
      city:              data.city,
      region:            data.region,
      postalCode:        data.postalCode,
      country:           data.country,
      contactFirstName:  data.contactFirstName,
      contactLastName:   data.contactLastName,
      contactEmail:      data.contactEmail,
      contactPhone:      data.contactPhone,
      useCase:           data.useCase,
      sampleMessagesJson: data.sampleMessages,
      status:            'DRAFT',
    },
    update: {
      legalName:         data.legalName,
      ein:               data.ein || null,
      businessType:      data.businessType,
      vertical:          data.vertical,
      websiteUrl:        data.websiteUrl || null,
      addressLine1:      data.addressLine1,
      addressLine2:      data.addressLine2 || null,
      city:              data.city,
      region:            data.region,
      postalCode:        data.postalCode,
      country:           data.country,
      contactFirstName:  data.contactFirstName,
      contactLastName:   data.contactLastName,
      contactEmail:      data.contactEmail,
      contactPhone:      data.contactPhone,
      useCase:           data.useCase,
      sampleMessagesJson: data.sampleMessages,
      status:            'DRAFT',
      rejectionReason:   null,  // clear stale rejection on re-edit
    },
  })

  res.json({ data: app })
}))

// POST /api/a2p/submit — moves the application from DRAFT to SUBMITTED.
// (Until ISV is approved, this just flips the status — the actual Trust Hub
// submission is queued for an admin to fire manually or for the future
// automation to pick up.)
router.post('/a2p/submit', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const userId   = req.user!.id

  const app = await prisma.tenantA2PApplication.findUnique({ where: { tenantId } })
  if (!app)   throw new AppError('NOT_FOUND', 'Fill out the application first', 404)
  if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
    throw new AppError('CONFLICT', `Application is in ${app.status} status — cannot submit`, 409)
  }

  const updated = await prisma.tenantA2PApplication.update({
    where: { tenantId },
    data:  { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
  })

  writeAuditLogFromRequest(req, {
    actorType: 'USER', actorUserId: userId, tenantId,
    action: 'a2p.submitted',
    targetType: 'TenantA2PApplication', targetId: updated.id,
    metadataJson: { useCase: updated.useCase, vertical: updated.vertical },
  }).catch(() => null)

  res.json({ data: updated })
}))

export default router
