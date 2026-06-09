import { Router, type IRouter } from 'express'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { issueTokensForUserId } from '../services/auth.service.js'

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
  if (!ENABLED || !ISSUER || !CLIENT_ID) return res.redirect(`${WEB}/login`)
  const state = randomBytes(16).toString('hex')
  const next = safeNext(req.query.next)
  const cookies = [
    `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
    `${NEXT_COOKIE}=${encodeURIComponent(next)}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
  ]
  res.setHeader('Set-Cookie', cookies)
  const u = new URL(`${ISSUER}/protocol/openid-connect/auth`)
  u.searchParams.set('client_id', CLIENT_ID)
  u.searchParams.set('redirect_uri', CALLBACK)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('state', state)
  res.redirect(u.toString())
})

router.get('/callback', async (req, res) => {
  if (!ENABLED) return res.redirect(`${WEB}/login`)
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const expected = readCookie(req.headers.cookie, STATE_COOKIE)
  if (!code || !state || !expected || state !== expected) {
    return res.redirect(`${WEB}/login?error=oidc_state`)
  }
  try {
    const tokRes = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: CALLBACK,
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
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
    if (!user) return res.redirect(`${WEB}/login?error=oidc_nouser`)

    const { accessToken, refreshToken } = await issueTokensForUserId(user.id)
    // Hand tokens to the SPA via URL fragment (not query — keeps them out of logs).
    const next = safeNext(decodeURIComponent(readCookie(req.headers.cookie, NEXT_COOKIE) ?? ''))
    const nextFrag = next ? `&next=${encodeURIComponent(next)}` : ''
    return res.redirect(`${WEB}/oidc-complete#access_token=${accessToken}&refresh_token=${refreshToken}${nextFrag}`)
  } catch (err) {
    console.warn('[oidc] callback error:', (err as Error).message)
    return res.redirect(`${WEB}/login?error=oidc`)
  }
})

export default router
