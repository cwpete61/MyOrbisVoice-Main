/**
 * Voice gateway: read the platform Twilio auth token from SystemConfig.
 *
 * As of 2026-05-02 OrbisVoice operates in managed-Twilio mode: one master
 * account, all tenants share it. The tenantId arg accepted by
 * getTwilioAuthToken() is preserved for backwards compatibility but ignored.
 *
 * SystemConfig encryption uses sha256(AUTH_SECRET) as the AES-256-GCM key,
 * 12-byte random IV, and a `iv:tag:enc` colon-separated hex format. This
 * is DIFFERENT from the legacy per-tenant TwilioConnectionDetail format
 * (scrypt-derived key, period-separated). The gateway needs its own
 * SystemConfig decryptor since it doesn't share code with the API.
 */
import crypto from 'crypto'
import { prisma } from './prisma.js'

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

async function readSystemConfig(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  if (!row) return null
  if (!row.isSecret) return row.value
  try { return decryptSystemConfig(row.value) } catch { return null }
}

export async function getTwilioAuthToken(_tenantId?: string): Promise<string | null> {
  return readSystemConfig('twilio_auth_token')
}

export async function getTwilioAccountSid(): Promise<string | null> {
  return readSystemConfig('twilio_account_sid')
}
