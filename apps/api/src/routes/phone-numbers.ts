import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()

const phoneSchema = z.object({
  e164Number:        z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format e.g. +18005551234'),
  displayLabel:      z.string().max(80).optional().nullable(),
  isInboundEnabled:  z.boolean().optional(),
  isOutboundEnabled: z.boolean().optional(),
  isSmsEnabled:      z.boolean().optional(),
  forwardingTarget:  z.string().max(30).optional().nullable(),
  twilioNumberSid:   z.string().max(50).optional().nullable(),
})

router.use(authenticate, requireTenantContext)

router.get('/phone-numbers', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const numbers  = await prisma.phoneNumber.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  res.json({ data: numbers })
}))

router.post('/phone-numbers', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const body     = phoneSchema.parse(req.body)

  const existing = await prisma.phoneNumber.findUnique({ where: { e164Number: body.e164Number } })
  if (existing) throw new AppError('CONFLICT', 'This number is already registered', 409)

  const number = await prisma.phoneNumber.create({
    data: { tenantId, ...body },
  })
  res.status(201).json({ data: number })
}))

router.patch('/phone-numbers/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { id }   = req.params
  const body     = phoneSchema.partial().parse(req.body)

  const existing = await prisma.phoneNumber.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Phone number not found', 404)

  const updated = await prisma.phoneNumber.update({ where: { id }, data: body })
  res.json({ data: updated })
}))

router.delete('/phone-numbers/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { id }   = req.params

  const existing = await prisma.phoneNumber.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Phone number not found', 404)

  await prisma.phoneNumber.delete({ where: { id } })
  res.sendStatus(204)
}))

export { router as phoneNumbersRouter }
