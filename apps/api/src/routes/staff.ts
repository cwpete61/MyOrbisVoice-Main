import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import {
  listStaff,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  startStaffGoogleOAuth,
  handleStaffGoogleCallback,
  disconnectStaffGoogle,
} from '../services/staff.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.errors[0]?.message ?? 'Invalid input', 400)
  return result.data
}

function ok(res: any, data: unknown, status = 200) { res.status(status).json({ data }) }
function fail(res: any, e: unknown) {
  if (e instanceof AppError) return res.status(e.status ?? 400).json({ errors: [{ code: e.code, message: e.message }] })
  res.status(500).json({ errors: [{ code: 'INTERNAL_ERROR', message: 'Internal server error' }] })
}

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  timezone: z.string().max(60).optional(),
  phoneExtension: z.string().max(20).optional(),
})

const updateSchema = profileSchema.partial().extend({
  isActive: z.boolean().optional(),
  availabilityJson: z.record(z.unknown()).optional(),
})

// List
router.get('/staff', authenticate, requireTenantContext, async (req, res) => {
  try { ok(res, await listStaff(req.user!.currentTenantId!)) }
  catch (e) { fail(res, e) }
})

// Get one
router.get('/staff/:staffId', authenticate, requireTenantContext, async (req, res) => {
  try { ok(res, await getStaffMember(req.user!.currentTenantId!, req.params['staffId']!)) }
  catch (e) { fail(res, e) }
})

// Create
router.post('/staff', authenticate, requireTenantContext, async (req, res) => {
  try {
    const data = await createStaffMember(req.user!.currentTenantId!, validate(profileSchema, req.body))
    ok(res, data, 201)
  } catch (e) { fail(res, e) }
})

// Update
router.patch('/staff/:staffId', authenticate, requireTenantContext, async (req, res) => {
  try {
    ok(res, await updateStaffMember(req.user!.currentTenantId!, req.params['staffId']!, validate(updateSchema, req.body)))
  } catch (e) { fail(res, e) }
})

// Delete
router.delete('/staff/:staffId', authenticate, requireTenantContext, async (req, res) => {
  try {
    await deleteStaffMember(req.user!.currentTenantId!, req.params['staffId']!, req.user!.id)
    ok(res, { deleted: true })
  } catch (e) { fail(res, e) }
})

// Connect Google Calendar
router.post('/staff/:staffId/google/connect', authenticate, requireTenantContext, async (req, res) => {
  try {
    ok(res, await startStaffGoogleOAuth(req.user!.currentTenantId!, req.params['staffId']!, req.user!.id))
  } catch (e) { fail(res, e) }
})

// OAuth callback — browser redirect
router.get('/staff/google/callback', async (req, res) => {
  const code = req.query['code'] as string | undefined
  const state = req.query['state'] as string | undefined
  const error = req.query['error'] as string | undefined
  if (error || !code || !state) return res.redirect(`/staff?google=error&reason=${error ?? 'missing_params'}`)
  try {
    const result = await handleStaffGoogleCallback(code, state)
    res.redirect(`/staff/${result.staffMemberId}?tab=calendar&google=success&email=${encodeURIComponent(result.email)}`)
  } catch (e) {
    res.redirect(`/staff?google=error&reason=${encodeURIComponent(e instanceof Error ? e.message : 'oauth_failed')}`)
  }
})

// Disconnect Google Calendar
router.delete('/staff/:staffId/google', authenticate, requireTenantContext, async (req, res) => {
  try {
    await disconnectStaffGoogle(req.user!.currentTenantId!, req.params['staffId']!, req.user!.id)
    ok(res, { disconnected: true })
  } catch (e) { fail(res, e) }
})

export default router
