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
