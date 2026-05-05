import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import * as authService from '../services/auth.service.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'

const router: IRouter = Router()

const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  selectedPlanCode: z.string().optional(),
  affiliateCode: z.string().optional(),
})

const affiliateSignupSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

router.post('/affiliate-signup', async (req, res, next) => {
  try {
    const parsed = affiliateSignupSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fieldErrors)
    }
    const result = await authService.affiliateSignupUser(parsed.data)
    writeAuditLog({ actorType: 'USER', actorUserId: result.user.id, action: 'auth.signup', targetType: 'User', targetId: result.user.id, metadataJson: { email: result.user.email, affiliateSignup: true, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
})

const loginSchema = z.object({
  login: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1),
})

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fieldErrors)
    }
    const result = await authService.signupUser(parsed.data)
    writeAuditLog({ actorType: 'USER', actorUserId: result.user.id, action: 'auth.signup', targetType: 'User', targetId: result.user.id, metadataJson: { email: result.user.email, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    }
    const result = await authService.loginUser(parsed.data)
    writeAuditLog({ actorType: 'USER', actorUserId: result.user.id, action: 'auth.login', targetType: 'User', targetId: result.user.id, metadataJson: { ip: req.ip, userAgent: req.headers['user-agent'] } }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: result })
  } catch (err) {
    // Log failed login attempts (non-fatal)
    writeAuditLog({ actorType: 'SYSTEM', action: 'auth.login_failed', metadataJson: { login: req.body?.login, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    next(err)
  }
})

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new AppError('BAD_REQUEST', 'refreshToken is required', 400)
    }
    const tokens = await authService.refreshUserTokens(refreshToken)
    res.json({ data: tokens })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (refreshToken && typeof refreshToken === 'string') {
      await authService.logoutUser(refreshToken)
    }
    writeAuditLog({ actorType: 'USER', action: 'auth.logout', metadataJson: { ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: { success: true } })
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user!.id)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

const updateProfileSchema = z.object({
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores').optional(),
  preferredLocale: z.enum(['en', 'es']).optional(),
})

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const result = await authService.updateProfile(req.user!.id, parsed.data)
    res.json({ data: result })
  } catch (err) { next(err) }
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

router.post('/me/change-password', authenticate, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    await authService.changePassword(req.user!.id, parsed.data.currentPassword, parsed.data.newPassword)
    writeAuditLog({ actorType: 'USER', actorUserId: req.user!.id, action: 'auth.password_changed', targetType: 'User', targetId: req.user!.id, metadataJson: { ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
