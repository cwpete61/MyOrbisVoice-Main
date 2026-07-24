import { prisma } from '../lib/prisma.js'

/**
 * Provision new Voice users into Keycloak so they can use SSO once the cutover
 * happens. Best-effort, NON-FATAL: no-ops when unconfigured, swallows all errors,
 * never blocks signup. Uses a scoped service-account client (manage-users only) —
 * NOT the Keycloak admin password.
 *
 * Users are created forced-reset (UPDATE_PASSWORD) — they set a password the
 * first time they sign in via Keycloak (matches the Phase 2.2 bulk import).
 */
const ISSUER = process.env.OIDC_ISSUER ?? '' // https://auth.myorbisresults.com/realms/myorbis
const CLIENT_ID = process.env.KC_PROVISION_CLIENT_ID ?? ''
const SECRET = process.env.KC_PROVISION_CLIENT_SECRET ?? ''

const m = ISSUER.match(/^(https?:\/\/[^/]+)\/realms\/([^/]+)$/)
const BASE = m?.[1] ?? '' // https://auth.myorbisresults.com
const REALM = m?.[2] ?? '' // myorbis

async function adminToken(): Promise<string> {
  const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: SECRET }),
  })
  if (!res.ok) throw new Error(`kc token ${res.status}`)
  return (await res.json() as { access_token: string }).access_token
}

/**
 * Provision a Voice user into Keycloak for SSO.
 * When `plaintextPassword` is given (self-serve signup, where we have it in hand),
 * we set it as the KC credential and DROP the UPDATE_PASSWORD action — so the agent
 * logs in immediately with the same password, no set-password email round-trip.
 * Without it (payment-link/Google), the user is created password-less with
 * UPDATE_PASSWORD and gets a set-password email from the caller.
 */
export async function syncUserToKeycloak(userId: string, plaintextPassword?: string): Promise<void> {
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) return // not configured — skip
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.email) return
    // Never provision test/automation accounts (deploy smoke signups etc.) into the IdP.
    if (/(@orbisvoice\.test$)|(\.test$)|(^e2e-)/i.test(user.email)) return
    const token = await adminToken()
    const auth = { authorization: `Bearer ${token}` }

    // already in Keycloak? (match by email)
    const q = await fetch(`${BASE}/admin/realms/${REALM}/users?email=${encodeURIComponent(user.email)}&exact=true`, { headers: auth })
    const found = q.ok ? ((await q.json()) as unknown[]) : []
    if (found.length) return

    const res = await fetch(`${BASE}/admin/realms/${REALM}/users`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        // KC username = the user's chosen app username so they can log in with it
        // OR their email (email login requires realm "Login with email" = ON).
        // Falls back to email for users with no username (e.g. Google-only).
        username: user.username || user.email,
        email: user.email,
        enabled: true,
        emailVerified: true,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        // Carry the user's language so Keycloak sends localized (en/es) emails + UI.
        attributes: { locale: [user.preferredLocale || 'en'] },
        // With a known password → set it and skip UPDATE_PASSWORD so login works
        // immediately. Otherwise require the set-password email flow.
        ...(plaintextPassword
          ? { credentials: [{ type: 'password', value: plaintextPassword, temporary: false }] }
          : { requiredActions: ['UPDATE_PASSWORD'] }),
      }),
    })
    if (res.status !== 201) throw new Error(`kc create user ${res.status}`)
  } catch (err) {
    console.warn('[kc-sync] user provision failed (non-fatal):', userId, (err as Error).message)
  }
}

/**
 * Send a Keycloak "set your password" email (execute-actions-email with
 * UPDATE_PASSWORD). The CORRECT invite for SSO-gated logins: the web funnels to the
 * MyOrbisResults hub (Keycloak), so a local password-reset link is useless — the
 * user must set their password in Keycloak. Used by payment-link onboarding. Default
 * link lifespan: 7 days. Best-effort, non-fatal.
 */
export async function sendKeycloakSetPasswordEmail(userId: string, lifespanSeconds = 7 * 24 * 3600): Promise<boolean> {
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) return false
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.email) return false
    if (/(@orbisvoice\.test$)|(\.test$)|(^e2e-)/i.test(user.email)) return false
    const token = await adminToken()
    const auth = { authorization: `Bearer ${token}` }
    const q = await fetch(`${BASE}/admin/realms/${REALM}/users?email=${encodeURIComponent(user.email)}&exact=true`, { headers: auth })
    const found = q.ok ? ((await q.json()) as { id: string }[]) : []
    const kcId = found[0]?.id
    if (!kcId) return false
    const res = await fetch(`${BASE}/admin/realms/${REALM}/users/${kcId}/execute-actions-email?lifespan=${lifespanSeconds}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(['UPDATE_PASSWORD']),
    })
    if (!res.ok) throw new Error(`kc execute-actions-email ${res.status}`)
    return true
  } catch (err) {
    console.warn('[kc-sync] set-password email failed (non-fatal):', userId, (err as Error).message)
    return false
  }
}

/**
 * Is this email already a Keycloak user? Used by the backfill + the per-partner
 * recovery so we only email people who actually needed provisioning.
 */
export async function keycloakUserExists(email: string): Promise<boolean> {
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) return false
  try {
    const token = await adminToken()
    const q = await fetch(`${BASE}/admin/realms/${REALM}/users?email=${encodeURIComponent(email)}&exact=true`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const found = q.ok ? ((await q.json()) as unknown[]) : []
    return found.length > 0
  } catch { return false }
}

/**
 * Recover partners locked out by the affiliateSignupUser Keycloak gap: for every
 * affiliate whose user is NOT in Keycloak, provision them (forced set-password —
 * we don't hold their plaintext) and send the set-password email so they can log
 * in. Idempotent: partners already in Keycloak are left untouched, so this is
 * safe to re-run.
 */
export async function backfillPartnersToKeycloak(): Promise<{
  scanned: number
  provisioned: string[]
  alreadyInKc: number
  failed: { email: string; reason: string }[]
}> {
  const result = { scanned: 0, provisioned: [] as string[], alreadyInKc: 0, failed: [] as { email: string; reason: string }[] }
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) {
    result.failed.push({ email: '-', reason: 'keycloak not configured' })
    return result
  }
  const affiliates = await prisma.affiliateAccount.findMany({
    select: { user: { select: { id: true, email: true } } },
  })
  for (const a of affiliates) {
    const u = a.user
    if (!u?.email) continue
    if (/(@orbisvoice\.test$)|(\.test$)|(^e2e-)/i.test(u.email)) continue
    result.scanned++
    try {
      if (await keycloakUserExists(u.email)) { result.alreadyInKc++; continue }
      await syncUserToKeycloak(u.id)              // create in KC (UPDATE_PASSWORD)
      const sent = await sendKeycloakSetPasswordEmail(u.id)
      if (sent) result.provisioned.push(u.email)
      else result.failed.push({ email: u.email, reason: 'provisioned but set-password email failed' })
    } catch (e) {
      result.failed.push({ email: u.email, reason: (e as Error).message.slice(0, 120) })
    }
  }
  return result
}

/**
 * One-time migration for username login: set every KC user's username to their
 * app username (KC was provisioned with username = email). After this + the realm
 * "Login with email = ON" setting, users can sign in with EITHER their username or
 * their email. Idempotent — users whose KC username already matches are skipped.
 *
 * PREREQUISITE: the realm MUST have "Login with email" enabled before this runs,
 * otherwise users who currently log in with their email lose that path (KC would
 * only accept the new username). Do not run until that setting is confirmed ON.
 */
export async function backfillKeycloakUsernames(): Promise<{
  scanned: number; updated: string[]; unchanged: number; notInKc: number; failed: { email: string; reason: string }[]
}> {
  const result = { scanned: 0, updated: [] as string[], unchanged: 0, notInKc: 0, failed: [] as { email: string; reason: string }[] }
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) { result.failed.push({ email: '-', reason: 'keycloak not configured' }); return result }
  const users = await prisma.user.findMany({ select: { id: true, email: true, username: true } })
  let token: string
  try { token = await adminToken() } catch (e) { result.failed.push({ email: '-', reason: `kc token: ${(e as Error).message}` }); return result }
  const auth = { authorization: `Bearer ${token}` }
  for (const u of users) {
    if (!u.email || !u.username) continue
    if (/(@orbisvoice\.test$)|(\.test$)|(^e2e-)/i.test(u.email)) continue
    // username == email → KC username already equals it; nothing to migrate.
    if (u.username.toLowerCase() === u.email.toLowerCase()) { result.unchanged++; continue }
    result.scanned++
    try {
      const q = await fetch(`${BASE}/admin/realms/${REALM}/users?email=${encodeURIComponent(u.email)}&exact=true`, { headers: auth })
      const found = q.ok ? ((await q.json()) as { id: string; username?: string }[]) : []
      const kc = found[0]
      if (!kc) { result.notInKc++; continue }
      if ((kc.username ?? '').toLowerCase() === u.username.toLowerCase()) { result.unchanged++; continue }
      const upd = await fetch(`${BASE}/admin/realms/${REALM}/users/${kc.id}`, {
        method: 'PUT',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ username: u.username }),
      })
      if (!upd.ok) throw new Error(`kc update ${upd.status}`)
      result.updated.push(u.email)
    } catch (e) {
      result.failed.push({ email: u.email, reason: (e as Error).message.slice(0, 120) })
    }
  }
  return result
}

/**
 * Back-channel SSO logout: revoke the user's Keycloak sessions via the admin API.
 * Used instead of a browser redirect to KC's /logout endpoint — that endpoint,
 * without an id_token_hint, shows a confirm screen that NPEs (500) on an expired
 * code (KC bug, hit 2026-06-21). Killing the session server-side gives a true
 * cross-product SSO logout with no browser round-trip. Best-effort, non-fatal.
 */
export async function logoutUserFromKeycloak(userId: string): Promise<boolean> {
  if (!CLIENT_ID || !SECRET || !BASE || !REALM) return false
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.email) return false
    const token = await adminToken()
    const auth = { authorization: `Bearer ${token}` }
    const q = await fetch(`${BASE}/admin/realms/${REALM}/users?email=${encodeURIComponent(user.email)}&exact=true`, { headers: auth })
    const found = q.ok ? ((await q.json()) as { id: string }[]) : []
    const kcId = found[0]?.id
    if (!kcId) return false
    const res = await fetch(`${BASE}/admin/realms/${REALM}/users/${kcId}/logout`, { method: 'POST', headers: auth })
    return res.ok
  } catch (err) {
    console.warn('[kc-sync] user logout failed (non-fatal):', userId, (err as Error).message)
    return false
  }
}
