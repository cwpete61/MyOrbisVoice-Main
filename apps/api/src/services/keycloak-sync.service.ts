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

export async function syncUserToKeycloak(userId: string): Promise<void> {
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
        username: user.email,
        email: user.email,
        enabled: true,
        emailVerified: true,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        requiredActions: ['UPDATE_PASSWORD'],
      }),
    })
    if (res.status !== 201) throw new Error(`kc create user ${res.status}`)
  } catch (err) {
    console.warn('[kc-sync] user provision failed (non-fatal):', userId, (err as Error).message)
  }
}
