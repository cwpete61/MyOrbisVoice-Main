import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import * as authService from '../services/auth.service.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLogFromRequest } from '../lib/audit.js'

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
    writeAuditLogFromRequest(req, { actorType: 'USER', actorUserId: result.user.id, action: 'auth.signup', targetType: 'User', targetId: result.user.id, metadataJson: { email: result.user.email, affiliateSignup: true, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
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
    writeAuditLogFromRequest(req, { actorType: 'USER', actorUserId: result.user.id, action: 'auth.signup', targetType: 'User', targetId: result.user.id, metadataJson: { email: result.user.email, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))

    // Welcome email — fire-and-forget, never block signup on SMTP issues
    const { sendWelcomeEmail } = await import('../services/email.service.js')
    const { getEnv } = await import('@voiceautomation/config')
    sendWelcomeEmail({
      to: result.user.email,
      firstName: result.user.firstName,
      tenantName: result.tenant.displayName,
      appBaseUrl: getEnv().APP_BASE_URL,
    }).catch(e => console.error('[welcome-email] send failed (non-fatal):', e?.message ?? e))

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
    writeAuditLogFromRequest(req, { actorType: 'USER', actorUserId: result.user.id, action: 'auth.login', targetType: 'User', targetId: result.user.id, metadataJson: { ip: req.ip, userAgent: req.headers['user-agent'] } }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: result })
  } catch (err) {
    // Log failed login attempts (non-fatal)
    writeAuditLogFromRequest(req, { actorType: 'SYSTEM', action: 'auth.login_failed', metadataJson: { login: req.body?.login, ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
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
    writeAuditLogFromRequest(req, { actorType: 'USER', action: 'auth.logout', metadataJson: { ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
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
    writeAuditLogFromRequest(req, { actorType: 'USER', actorUserId: req.user!.id, action: 'auth.password_changed', targetType: 'User', targetId: req.user!.id, metadataJson: { ip: req.ip } }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Forgot-password / reset-password (public, no auth) ────────────────────
//
// Step 1: user submits email at /forgot-password → /api/auth/forgot-password.
// We send them a one-time reset link IF the email exists. The response is
// always success-shaped to defend against account-enumeration attacks.
//
// Step 2: user clicks the link → /reset-password?token=… → submits new
// password → /api/auth/reset-password. We verify token, set password,
// revoke all refresh tokens (forces re-login on every device).

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      // Even validation errors return success-shaped — don't leak whether
      // the email format was valid via a different response code.
      res.json({ data: { ok: true } })
      return
    }

    const result = await authService.startPasswordReset(parsed.data.email)
    if (result) {
      // Email exists — fire the reset email asynchronously. .catch wraps so
      // SMTP failure doesn't fail the request (we still return success-
      // shaped to the caller).
      const { sendPasswordResetEmail } = await import('../services/email.service.js')
      const { getEnv } = await import('@voiceautomation/config')
      const appBase = getEnv().APP_BASE_URL
      const resetUrl = `${appBase}/reset-password?token=${encodeURIComponent(result.rawToken)}`
      sendPasswordResetEmail({
        to:                result.email,
        firstName:         result.firstName,
        resetUrl,
        expiresInMinutes:  15,
      }).catch(e => console.error('[forgot-password] email send failed (non-fatal):', e?.message ?? e))

      writeAuditLogFromRequest(req, {
        actorType:    'USER',
        action:       'auth.password_reset_requested',
        targetType:   'User',
        metadataJson: { email: result.email, ip: req.ip },
      }).catch(e => console.error('[audit] write failed:', e))
    }
    // Same shape regardless — protect against enumeration.
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

const resetPasswordSchema = z.object({
  token:       z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    await authService.completePasswordReset(parsed.data.token, parsed.data.newPassword)
    writeAuditLogFromRequest(req, {
      actorType:    'USER',
      action:       'auth.password_reset_completed',
      targetType:   'User',
      metadataJson: { ip: req.ip },
    }).catch(e => console.error('[audit] write failed:', e))
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
