import { Router, type IRouter, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { issueTokensForUserId } from '../services/auth.service.js'
import { authenticate } from '../middleware/authenticate.js'
import { logoutUserFromKeycloak } from '../services/keycloak-sync.service.js'

/**
 * Phase 2.4 — "Sign in with MyOrbis" (Keycloak OIDC), server-side auth-code flow.
 *
 * FEATURE-FLAGGED OFF by default (OIDC_ENABLED !== 'true'): the routes exist but
 * /login bounces to the normal login page, so deploying this changes nothing for
 * users. Flipping the flag (after a one-account browser test) enables it.
 *
 * Flow: /login -> Keycloak authorize -> /callback -> code exchange (confidential
 * client) -> userinfo (KC-verified email) -> find Voice user by email -> issue a
 * normal Voice session -> hand tokens to the web app via URL fragment.
 */
const router: IRouter = Router()

const ENABLED = process.env.OIDC_ENABLED === 'true'
const ISSUER = process.env.OIDC_ISSUER ?? ''
const CLIENT_ID = process.env.OIDC_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET ?? ''
const WEB = process.env.WEB_ORIGIN ?? 'https://app.myorbisvoice.com'
const CALLBACK = 'https://api.myorbisvoice.com/api/auth/oidc/callback'
const STATE_COOKIE = 'ov_oidc_state'
const NEXT_COOKIE = 'ov_oidc_next'

// MyOrbisAgents runs on its own hostnames so agent logins/logouts are isolated
// from the rest of the ecosystem (separate localStorage origin + its own KC
// client, redirect, post-logout, and a forced fresh prompt so an existing Hub
// SSO session never silently carries in). Everything is derived from the
// request host, so the SAME API serves both without leaking one into the other.
const AGENTS_API_HOST      = 'api.myorbisagents.com'
const AGENTS_WEB           = 'https://app.myorbisagents.com'
const AGENTS_CLIENT_ID     = process.env.OIDC_AGENTS_CLIENT_ID ?? 'myorbis-agents'
const AGENTS_CLIENT_SECRET = process.env.OIDC_AGENTS_CLIENT_SECRET ?? ''

type OidcCtx = { web: string; callback: string; clientId: string; clientSecret: string; forcePrompt: boolean }
function resolveCtx(req: Request): OidcCtx {
  if (req.hostname === AGENTS_API_HOST) {
    return {
      web:          AGENTS_WEB,
      callback:     `https://${AGENTS_API_HOST}/api/auth/oidc/callback`,
      clientId:     AGENTS_CLIENT_ID,
      clientSecret: AGENTS_CLIENT_SECRET,
      forcePrompt:  true, // app-session-only isolation: always ask on the agents door
    }
  }
  return { web: WEB, callback: CALLBACK, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, forcePrompt: false }
}

// Only allow same-app relative paths as a post-login destination (no open redirect).
function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : ''
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

router.get('/login', (req, res) => {
  const ctx = resolveCtx(req)
  if (!ENABLED || !ISSUER || !ctx.clientId) return res.redirect(`${ctx.web}/login`)
  const state = randomBytes(16).toString('hex')
  const next = safeNext(req.query.next)
  const cookies = [
    `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
    `${NEXT_COOKIE}=${encodeURIComponent(next)}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
  ]
  res.setHeader('Set-Cookie', cookies)
  const u = new URL(`${ISSUER}/protocol/openid-connect/auth`)
  u.searchParams.set('client_id', ctx.clientId)
  u.searchParams.set('redirect_uri', ctx.callback)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('state', state)
  // Agents door forces a fresh login (never inherit a Hub/Voice SSO session).
  if (ctx.forcePrompt) u.searchParams.set('prompt', 'login')
  res.redirect(u.toString())
})

router.get('/callback', async (req, res) => {
  const ctx = resolveCtx(req)
  if (!ENABLED) return res.redirect(`${ctx.web}/login`)
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const expected = readCookie(req.headers.cookie, STATE_COOKIE)
  if (!code || !state || !expected || state !== expected) {
    return res.redirect(`${ctx.web}/login?error=oidc_state`)
  }
  try {
    const tokRes = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: ctx.callback,
        client_id: ctx.clientId, client_secret: ctx.clientSecret,
      }),
    })
    if (!tokRes.ok) throw new Error(`token ${tokRes.status}`)
    const { access_token } = (await tokRes.json()) as { access_token: string }

    const uiRes = await fetch(`${ISSUER}/protocol/openid-connect/userinfo`, {
      headers: { authorization: `Bearer ${access_token}` },
    })
    if (!uiRes.ok) throw new Error(`userinfo ${uiRes.status}`)
    const { email } = (await uiRes.json()) as { email?: string }
    if (!email) throw new Error('no email in userinfo')

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    if (!user) return res.redirect(`${ctx.web}/login?error=oidc_nouser`)

    const { accessToken, refreshToken } = await issueTokensForUserId(user.id)
    // Hand tokens to the SPA via URL fragment (not query — keeps them out of logs).
    const next = safeNext(decodeURIComponent(readCookie(req.headers.cookie, NEXT_COOKIE) ?? ''))
    const nextFrag = next ? `&next=${encodeURIComponent(next)}` : ''
    return res.redirect(`${ctx.web}/oidc-complete#access_token=${accessToken}&refresh_token=${refreshToken}${nextFrag}`)
  } catch (err) {
    console.warn('[oidc] callback error:', (err as Error).message)
    return res.redirect(`${ctx.web}/login?error=oidc`)
  }
})

// Back-channel SSO logout — revoke the Keycloak session server-side so the SPA
// never has to hit KC's browser /logout endpoint (which 500s on an expired
// confirm code without an id_token_hint). Best-effort; the SPA clears local
// tokens + redirects regardless.
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const ctx = resolveCtx(req)
  const userId = (req as any).user?.id as string | undefined
  let revoked = false
  // Agents = app-session-only logout: do NOT revoke the shared Keycloak session
  // (that logs the user out of every MyOrbis product). The forced prompt on the
  // agents login makes the next sign-in ask for credentials anyway, so it still
  // feels like a clean, isolated logout. Voice/Hub keep the full SSO logout.
  if (userId && !ctx.forcePrompt) revoked = await logoutUserFromKeycloak(userId)
  res.json({ data: { ok: true, revoked, appSessionOnly: ctx.forcePrompt } })
})

export default router
