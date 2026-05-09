/**
 * Google Sign-In flow (Thing A) — distinct from /api/integrations/google/*
 * which connects an authenticated tenant's Gmail+Calendar to the agent.
 *
 * This flow is for ANONYMOUS visitors hitting /login or /signup with the
 * "Continue with Google" button. After Google consent we either:
 *   - Auto-link to an existing User by googleId or email → issue JWT (sign-in)
 *   - Create no User yet, return a short-lived "pending profile" JWT that
 *     the frontend exchanges for a complete signup (username + businessName)
 *
 * State is the standard CSRF nonce; we cache it in Redis for 10 minutes.
 *
 * Required Google Cloud Console step:
 *   The OAuth client must have https://api.myorbisvoice.com/api/auth/google/callback
 *   listed in Authorized redirect URIs (separate from the integrations URI).
 *   Without that, Google rejects the callback with redirect_uri_mismatch.
 */
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { getRedis } from '../lib/redis.js'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'
import { getConfigValue } from './system-config.service.js'

// 10-minute window for the user to complete the OAuth round-trip
const STATE_TTL_SECONDS = 10 * 60
// 15-minute window for the user to finish their profile after Google consent
const PENDING_PROFILE_TTL_SECONDS = 15 * 60

// Sign-in scopes are deliberately MINIMAL — just enough to identify the user.
// The integrations flow asks for Gmail+Calendar; that's a heavier consent
// screen. Sign-in users should see "MyOrbisVoice wants to know your name and
// email" and nothing else.
const SIGN_IN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

async function getOAuthClient() {
  const clientId     = (await getConfigValue('google_client_id'))     ?? process.env['GOOGLE_CLIENT_ID']     ?? ''
  const clientSecret = (await getConfigValue('google_client_secret')) ?? process.env['GOOGLE_CLIENT_SECRET'] ?? ''
  if (!clientId || !clientSecret) {
    throw new AppError('INTERNAL_ERROR', 'Google OAuth credentials not configured', 500)
  }
  // Sign-in callback URI is separate from the integrations callback URI.
  // Both must be registered in Google Cloud Console as Authorized redirect URIs.
  const apiBase     = getEnv().API_BASE_URL
  const redirectUri = `${apiBase.replace(/\/$/, '')}/api/auth/google/callback`
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

const STATE_PREFIX = 'google-signin-state:'

export async function startGoogleSignIn(opts: { returnTo?: string } = {}): Promise<{ url: string; state: string }> {
  const state = crypto.randomBytes(24).toString('hex')
  // Store the optional returnTo so we can redirect the user back to where
  // they were after callback. Default landing pages are picked by the
  // callback handler based on user role.
  await getRedis().setex(STATE_PREFIX + state, STATE_TTL_SECONDS, JSON.stringify({ returnTo: opts.returnTo ?? null }))

  const client = await getOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'online',                  // no refresh token — sign-in is one-shot
    prompt:      'select_account',          // let user pick the Google account
    scope:       SIGN_IN_SCOPES,
    state,
  })
  return { url, state }
}

export interface GoogleProfile {
  email:      string
  emailVerified: boolean
  googleId:   string                        // Google's stable `sub` claim
  firstName:  string | null
  lastName:   string | null
  pictureUrl: string | null
}

async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const client = await getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const me = await oauth2.userinfo.get()

  if (!me.data.email)             throw new AppError('BAD_REQUEST', 'Google did not return an email', 400)
  if (!me.data.id)                throw new AppError('BAD_REQUEST', 'Google did not return an account ID', 400)
  if (me.data.verified_email !== true) {
    // Reject unverified emails outright — accepting them lets an attacker
    // create a Google account with an arbitrary email they don't control,
    // then "sign in" as a user who legitimately uses that email here.
    throw new AppError('UNAUTHORIZED', 'Google account email is not verified', 401)
  }

  return {
    email:         (me.data.email ?? '').toLowerCase(),
    emailVerified: true,
    googleId:      me.data.id ?? '',
    firstName:     me.data.given_name ?? null,
    lastName:      me.data.family_name ?? null,
    pictureUrl:    me.data.picture ?? null,
  }
}

export interface PendingProfile {
  type:      'pending-google-signup'
  email:     string
  googleId:  string
  firstName: string | null
  lastName:  string | null
}

function signPendingProfile(profile: GoogleProfile): string {
  const payload: PendingProfile = {
    type:      'pending-google-signup',
    email:     profile.email,
    googleId:  profile.googleId,
    firstName: profile.firstName,
    lastName:  profile.lastName,
  }
  const secret = getEnv().AUTH_SECRET
  return jwt.sign(payload, secret, { expiresIn: PENDING_PROFILE_TTL_SECONDS })
}

export function verifyPendingProfile(token: string): PendingProfile {
  try {
    const secret = getEnv().AUTH_SECRET
    const decoded = jwt.verify(token, secret) as PendingProfile
    if (decoded.type !== 'pending-google-signup') {
      throw new AppError('BAD_REQUEST', 'Invalid pending-profile token', 400)
    }
    return decoded
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError('UNAUTHORIZED', 'Pending-profile token expired or invalid', 401)
  }
}

export type GoogleCallbackResult =
  | { kind: 'signin';        userId: string }                 // existing user — caller issues tokens
  | { kind: 'needs-profile'; pendingToken: string }           // new user — frontend collects username+biz

export async function handleGoogleCallback(code: string, state: string): Promise<GoogleCallbackResult> {
  // Validate state to prevent CSRF
  const stateRecord = await getRedis().get(STATE_PREFIX + state)
  if (!stateRecord) {
    throw new AppError('BAD_REQUEST', 'OAuth state expired or invalid', 400)
  }
  await getRedis().del(STATE_PREFIX + state)  // single-use

  const profile = await fetchGoogleProfile(code)

  // Auto-link policy: prefer googleId match, fall back to email match. Either
  // way, an existing user with this email or googleId becomes the signed-in
  // user — no separate "link" step. This is the intentional default; a real
  // attacker with a fresh Google account that happens to share an email with
  // a real user can't sign in because Google requires email verification on
  // their side AND we reject unverified emails above.
  // Case-insensitive email fallback so a user who signed up password-style
  // with "USER@gmail.com" still auto-links when Google reports the same
  // address as "user@gmail.com" (Google sometimes lowercases the local part).
  let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } })
  if (!user) user = await prisma.user.findFirst({ where: { email: { equals: profile.email, mode: 'insensitive' } } })

  if (user) {
    // First-time Google sign-in for an existing password user → save the
    // googleId so subsequent sign-ins are stable even if their Google email
    // changes.
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data:  { googleId: profile.googleId },
      })
    }
    return { kind: 'signin', userId: user.id }
  }

  // No matching user → ship the profile back to the frontend for finish-profile
  const pendingToken = signPendingProfile(profile)
  return { kind: 'needs-profile', pendingToken }
}
