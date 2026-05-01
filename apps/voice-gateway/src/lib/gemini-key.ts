import crypto from 'crypto'

const ALG = 'aes-256-gcm'
const SECRET_KEY = process.env['AUTH_SECRET'] ?? 'fallback-key'

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
