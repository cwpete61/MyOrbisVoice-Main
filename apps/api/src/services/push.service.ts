/**
 * Web Push notifications.
 *
 * VAPID keys live in SystemConfig (vapid_public_key, vapid_private_key,
 * vapid_subject). The public key is non-secret and exposed via
 * GET /api/push/vapid-public-key. The private key is encrypted with the
 * standard sha256(AUTH_SECRET) AES-256-GCM scheme.
 *
 * Subscriptions are stored per-(tenant,user,device) in PushSubscription
 * and pruned on send-failure (404/410 = subscription dead).
 */
import webPush from 'web-push'
import { google } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { getConfigValue } from './system-config.service.js'

let vapidConfigured = false
async function ensureVapid(): Promise<boolean> {
  if (vapidConfigured) return true
  const [pub, priv, subject] = await Promise.all([
    getConfigValue('vapid_public_key'),
    getConfigValue('vapid_private_key'),
    getConfigValue('vapid_subject'),
  ])
  if (!pub || !priv || !subject) {
    console.warn('[push] VAPID keys not configured — push disabled')
    return false
  }
  webPush.setVapidDetails(subject, pub, priv)
  vapidConfigured = true
  return true
}

export async function getVapidPublicKey(): Promise<string | null> {
  return getConfigValue('vapid_public_key')
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string         // path to navigate to when clicked
  tag?:  string         // dedupe key
  icon?: string         // URL to icon image
}

// Send a push to every device subscribed by a specific user.
export async function sendToUser(userId: string, payload: PushPayload): Promise<{ delivered: number; pruned: number }> {
  const ok = await ensureVapid()
  if (!ok) return { delivered: 0, pruned: 0 }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  return sendToSubscriptions(subs, payload)
}

// Send to every member of a tenant. Useful for "new call came in" alerts
// where every team member with notifications enabled should hear it.
export async function sendToTenant(tenantId: string, payload: PushPayload): Promise<{ delivered: number; pruned: number }> {
  const ok = await ensureVapid()
  if (!ok) return { delivered: 0, pruned: 0 }

  const subs = await prisma.pushSubscription.findMany({ where: { tenantId } })
  return sendToSubscriptions(subs, payload)
}

interface StoredSubscription {
  id:       string
  endpoint: string
  p256dh:   string
  auth:     string
}

async function sendToSubscriptions(subs: StoredSubscription[], payload: PushPayload): Promise<{ delivered: number; pruned: number }> {
  if (subs.length === 0) return { delivered: 0, pruned: 0 }

  const body = JSON.stringify(payload)
  let delivered = 0
  let pruned = 0
  const deadIds: string[] = []

  await Promise.all(subs.map(async (s) => {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      )
      delivered++
      // Update lastUsedAt — best-effort, don't block on it
      prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => null)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      // 404/410 = subscription is permanently gone (user revoked, browser cleared).
      // Anything else is transient — leave it for the next call.
      if (status === 404 || status === 410) {
        deadIds.push(s.id)
      } else {
        console.warn('[push] send failed', status, (err as Error)?.message)
      }
    }
  }))

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } })
    pruned = deadIds.length
  }

  return { delivered, pruned }
}

// ── Native (Capacitor) push via FCM v1 ─────────────────────────────────────
// The native app registers an FCM token in PushDevice; we send through the FCM
// HTTP v1 API using a service-account JSON stored (encrypted) in SystemConfig
// under `fcm_service_account`. FCM delivers to Android natively and to iOS via
// the APNs key configured in the Firebase project. Guarded — no-ops until set.
interface FcmCreds { projectId: string; clientEmail: string; privateKey: string }
let fcmCreds: FcmCreds | null = null
let fcmChecked = false
async function ensureFcm(): Promise<FcmCreds | null> {
  if (fcmChecked) return fcmCreds
  fcmChecked = true
  const raw = await getConfigValue('fcm_service_account')
  if (!raw) { console.warn('[push] FCM service account not configured — native push disabled'); return null }
  try {
    const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string }
    fcmCreds = { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }
  } catch { console.warn('[push] fcm_service_account is not valid JSON'); fcmCreds = null }
  return fcmCreds
}
async function fcmAccessToken(c: FcmCreds): Promise<string | null> {
  try {
    const jwt = new google.auth.JWT({ email: c.clientEmail, key: c.privateKey, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
    const { access_token } = await jwt.authorize()
    return access_token ?? null
  } catch (e) { console.warn('[push] FCM auth failed:', (e as Error).message); return null }
}
async function sendFcm(devices: { id: string; token: string }[], payload: PushPayload): Promise<{ delivered: number; pruned: number }> {
  const creds = await ensureFcm()
  if (!creds || devices.length === 0) return { delivered: 0, pruned: 0 }
  const accessToken = await fcmAccessToken(creds)
  if (!accessToken) return { delivered: 0, pruned: 0 }
  let delivered = 0
  const deadIds: string[] = []
  await Promise.all(devices.map(async (dv) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: dv.token,
          notification: { title: payload.title, body: payload.body },
          data: payload.url ? { url: payload.url } : undefined,
          android: { priority: 'high', notification: { sound: 'default' } },
          apns: { payload: { aps: { sound: 'default' } } },
        },
      }),
    }).catch(() => null)
    if (!res) return
    if (res.ok) {
      delivered++
      prisma.pushDevice.update({ where: { id: dv.id }, data: { lastUsedAt: new Date() } }).catch(() => null)
      return
    }
    const txt = await res.text().catch(() => '')
    if (res.status === 404 || /UNREGISTERED|NotRegistered|InvalidRegistration/i.test(txt)) deadIds.push(dv.id)
    else console.warn('[push] FCM send failed', res.status, txt.slice(0, 140))
  }))
  if (deadIds.length > 0) await prisma.pushDevice.deleteMany({ where: { id: { in: deadIds } } })
  return { delivered, pruned: deadIds.length }
}

/** Native push to one user (all their registered devices). */
export async function sendNativeToUser(userId: string, payload: PushPayload) {
  return sendFcm(await prisma.pushDevice.findMany({ where: { userId }, select: { id: true, token: true } }), payload)
}
/** Native push to every device on a tenant. */
export async function sendNativeToTenant(tenantId: string, payload: PushPayload) {
  return sendFcm(await prisma.pushDevice.findMany({ where: { tenantId }, select: { id: true, token: true } }), payload)
}
