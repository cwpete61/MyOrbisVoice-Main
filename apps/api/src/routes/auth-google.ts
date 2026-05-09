/**
 * Google Sign-In routes — anonymous OAuth flow distinct from
 * /api/integrations/google/* (which connects an authenticated tenant's Gmail
 * to the agent). See google-signin.service.ts for the flow shape.
 *
 * Routes mounted at /api on the public surface (BEFORE auth-gated routers in
 * routes/index.ts) so anonymous visitors can hit them.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'
import { asyncHandler } from '../lib/async-handler.js'
import { startGoogleSignIn, handleGoogleCallback, verifyPendingProfile } from '../services/google-signin.service.js'
import { issueTokensForUserId, signupUserFromGoogle } from '../services/auth.service.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'

const router: IRouter = Router()

// GET /api/auth/google/start
// Returns a Google consent URL. Frontend redirects the browser to it.
router.get('/auth/google/start', asyncHandler(async (req, res) => {
  const { url } = await startGoogleSignIn({})
  res.json({ data: { url } })
}))

// GET /api/auth/google/callback
// Google redirects the browser here after consent. We exchange code+state,
// then redirect the browser back to the frontend with either tokens (signin)
// or a pending-profile token (new user). Tokens go in URL fragment so they
// don't hit server logs or referer headers.
router.get('/auth/google/callback', asyncHandler(async (req, res) => {
  const code  = (req.query['code']  as string | undefined) ?? ''
  const state = (req.query['state'] as string | undefined) ?? ''
  const error = (req.query['error'] as string | undefined)

  const appBase = getEnv().APP_BASE_URL.replace(/\/$/, '')

  // Google sometimes sends users back with ?error=access_denied if the user
  // clicked Cancel on the consent screen. Send them to /login with a flag.
  if (error) {
    res.redirect(302, `${appBase}/login?google=${encodeURIComponent(error)}`)
    return
  }
  if (!code || !state) {
    res.redirect(302, `${appBase}/login?google=missing_params`)
    return
  }

  try {
    const result = await handleGoogleCallback(code, state)

    if (result.kind === 'signin') {
      // Existing user — issue tokens, write audit, redirect to dashboard with
      // tokens in fragment.
      const { accessToken, refreshToken } = await issueTokensForUserId(result.userId)
      writeAuditLogFromRequest(req, {
        actorType:   'USER',
        actorUserId: result.userId,
        action:      'auth.login',
        targetType:  'User',
        targetId:    result.userId,
        metadataJson: { method: 'google', ip: req.ip, userAgent: req.headers['user-agent'] },
      }).catch(() => null)

      // Tokens in URL fragment — never hits server logs, not exposed to
      // intermediate proxies. Frontend reads them from window.location.hash
      // on /login then strips them via history.replaceState.
      const params = new URLSearchParams({ at: accessToken, rt: refreshToken })
      res.redirect(302, `${appBase}/login#google=signin&${params.toString()}`)
      return
    }

    // New user — send pending-profile token, frontend collects username+biz
    const params = new URLSearchParams({ pt: result.pendingToken })
    res.redirect(302, `${appBase}/finish-profile#google=new&${params.toString()}`)
  } catch (e) {
    const message = e instanceof AppError ? e.message : 'OAuth callback failed'
    res.redirect(302, `${appBase}/login?google=${encodeURIComponent('error: ' + message)}`)
  }
}))

// POST /api/auth/google/finish-profile
// Frontend submits the pending-profile token plus the missing fields
// (username, businessName) collected from the user. We verify the token
// (it's our own JWT, signed with AUTH_SECRET, 15min TTL), then create the
// User + Tenant.
const finishProfileSchema = z.object({
  pendingToken:    z.string().min(1),
  username:        z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  businessName:    z.string().min(2),
  affiliateCode:   z.string().optional(),
  preferredLocale: z.enum(['en', 'es']).optional(),
})

router.post('/auth/google/finish-profile', asyncHandler(async (req, res) => {
  const parsed = finishProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'root'
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fieldErrors)
  }

  const profile = verifyPendingProfile(parsed.data.pendingToken)
  const result  = await signupUserFromGoogle({
    username:        parsed.data.username,
    email:           profile.email,
    googleId:        profile.googleId,
    businessName:    parsed.data.businessName,
    firstName:       profile.firstName,
    lastName:        profile.lastName,
    affiliateCode:   parsed.data.affiliateCode,
    preferredLocale: parsed.data.preferredLocale,
  })

  writeAuditLogFromRequest(req, {
    actorType:   'USER',
    actorUserId: (result.user as { id: string }).id,
    action:      'auth.signup',
    targetType:  'User',
    targetId:    (result.user as { id: string }).id,
    metadataJson: { email: profile.email, method: 'google', ip: req.ip },
  }).catch(() => null)

  res.status(201).json({ data: result })
}))

export default router
