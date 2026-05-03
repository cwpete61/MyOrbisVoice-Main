import crypto from 'crypto'
import { getPlatformGeminiKey } from './twilio-auth.js'

const ALG = 'aes-256-gcm'
const _authSecret = process.env['AUTH_SECRET']
if (!_authSecret) throw new Error('AUTH_SECRET env var is required')
const SECRET_KEY: string = _authSecret

// Decrypts a per-tenant IntegrationConnection.metadata.encryptedApiKey
// (legacy scrypt+gemini-salt format). Returns null on bad input.
export function getGeminiApiKey(stored: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = stored.split('.')
    if (!ivHex || !tagHex || !encHex) return null
    const k   = crypto.scryptSync(SECRET_KEY, 'gemini-salt', 32)
    const dec = crypto.createDecipheriv(ALG, k, Buffer.from(ivHex, 'hex'))
    dec.setAuthTag(Buffer.from(tagHex, 'hex'))
    return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
  } catch {
    return null
  }
}

// Resolve the effective Gemini key for a session: tenant override first,
// then platform-wide key from SystemConfig, then env.GEMINI_API_KEY.
export async function resolveGeminiApiKey(tenantOverride?: string): Promise<string | undefined> {
  if (tenantOverride) return tenantOverride
  const platform = await getPlatformGeminiKey()
  if (platform) return platform
  return process.env['GEMINI_API_KEY']
}
