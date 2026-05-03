/**
 * Web Push from the gateway side.
 *
 * Mirrors apps/api/src/services/push.service.ts — same VAPID config in
 * SystemConfig, same encryption, same prune-on-failure behavior. Lives here
 * (rather than calling the API) so the gateway can fire notifications
 * inline at call-start without a network round-trip + auth dance.
 */
import webPush from 'web-push'
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'

const _authSecret = process.env['AUTH_SECRET']
if (!_authSecret) throw new Error('AUTH_SECRET env var is required')
const SECRET_KEY: string = _authSecret

function decryptSystemConfig(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid SystemConfig ciphertext format')
  const key = crypto.createHash('sha256').update(SECRET_KEY).digest()
  const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

async function readConfig(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  if (!row) return null
  if (!row.isSecret) return row.value
  try { return decryptSystemConfig(row.value) } catch { return null }
}

let vapidConfigured = false
async function ensureVapid(): Promise<boolean> {
  if (vapidConfigured) return true
  const [pub, priv, subject] = await Promise.all([
    readConfig('vapid_public_key'),
    readConfig('vapid_private_key'),
    readConfig('vapid_subject'),
  ])
  if (!pub || !priv || !subject) return false
  webPush.setVapidDetails(subject, pub, priv)
  vapidConfigured = true
  return true
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

export async function sendToTenant(tenantId: string, payload: PushPayload): Promise<void> {
  const ok = await ensureVapid()
  if (!ok) return

  const subs = await prisma.pushSubscription.findMany({ where: { tenantId } })
  if (subs.length === 0) return

  const body = JSON.stringify(payload)
  const deadIds: string[] = []

  await Promise.all(subs.map(async (s) => {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      )
      prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => null)
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) deadIds.push(s.id)
      else console.warn('[push] send failed', status, (err as Error)?.message)
    }
  }))

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } })
  }
}
