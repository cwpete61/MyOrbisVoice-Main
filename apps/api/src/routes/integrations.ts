import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as googleService from '../services/google.service.js'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'

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

router.get('/integrations', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const google = await googleService.getGoogleConnection(tenantId)
    res.json({
      data: {
        google: google
          ? { status: google.status, email: google.email, lastVerifiedAt: google.lastVerifiedAt, calendarCount: (google.calendarIds as string[]).length }
          : { status: 'NOT_CONNECTED', email: null, lastVerifiedAt: null, calendarCount: 0 },
      },
    })
  } catch (err) { next(err) }
})

// Start Google OAuth — returns redirect URL
router.post('/integrations/google/start', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    const { url, state } = await googleService.startGoogleOAuth(tenantId, userId)
    res.json({ data: { url, state } })
  } catch (err) { next(err) }
})

// OAuth callback — redirects browser to frontend with result
router.get('/integrations/google/callback', async (req, res, next) => {
  try {
    const env = getEnv()
    const { code, state, error } = req.query as Record<string, string>

    if (error) {
      res.redirect(`${env.APP_BASE_URL}/integrations?google=error&reason=${encodeURIComponent(error)}`)
      return
    }

    if (!code || !state) {
      res.redirect(`${env.APP_BASE_URL}/integrations?google=error&reason=missing_params`)
      return
    }

    const { email } = await googleService.handleGoogleCallback(code, state)
    res.redirect(`${env.APP_BASE_URL}/integrations?google=success&email=${encodeURIComponent(email)}`)
  } catch (err) {
    const env = getEnv()
    const msg = err instanceof AppError ? err.message : 'oauth_failed'
    res.redirect(`${env.APP_BASE_URL}/integrations?google=error&reason=${encodeURIComponent(msg)}`)
    next // don't forward — we already responded
  }
})

// Re-initiate Google OAuth for reconnect
router.post('/integrations/google/reconnect', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    const { url, state } = await googleService.startGoogleOAuth(tenantId, userId)
    res.json({ data: { url, state } })
  } catch (err) { next(err) }
})

// Disconnect Google
router.delete('/integrations/google', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const userId = req.user!.id
    await googleService.disconnectGoogle(tenantId, userId)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
