import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as appointmentService from '../services/appointment.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root'
      fields[key] = [...(fields[key] ?? []), issue.message]
    }
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fields)
  }
  return result.data
}

const availabilitySchema = z.object({
  appointmentType: z.string().optional(),
  preferredStartRange: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  timezone: z.string(),
  durationMinutes: z.number().int().min(5).max(480),
})

router.post('/appointments/availability/search', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const params = validate(availabilitySchema, req.body)
    const result = await appointmentService.searchAvailability(tenantId, params)
    res.json({ data: result })
  } catch (err) { next(err) }
})

const createSchema = z.object({
  contactId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  appointmentType: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
  attendeeEmail: z.string().email().optional(),
})

router.post('/appointments', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    const data = validate(createSchema, req.body)
    const appointment = await appointmentService.createAppointment(tenantId, userId, data)
    res.status(201).json({ data: appointment })
  } catch (err) { next(err) }
})

const rescheduleSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string(),
})

router.patch('/appointments/:id/reschedule', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    const data = validate(rescheduleSchema, req.body)
    const updated = await appointmentService.rescheduleAppointment(tenantId, userId, req.params.id, data)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

router.patch('/appointments/:id/cancel', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    const canceled = await appointmentService.cancelAppointment(tenantId, userId, req.params.id)
    res.json({ data: canceled })
  } catch (err) { next(err) }
})

const listSchema = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

router.get('/appointments', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const query = validate(listSchema, req.query)
    const result = await appointmentService.listAppointments(tenantId, query)
    res.json({ data: result.appointments, meta: { total: result.total, limit: result.limit, offset: result.offset } })
  } catch (err) { next(err) }
})

export default router
