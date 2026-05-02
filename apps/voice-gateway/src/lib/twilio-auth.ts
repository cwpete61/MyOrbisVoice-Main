import crypto from 'crypto'
import { prisma } from './prisma.js'

const ALG = 'aes-256-gcm'
const _authSecret = process.env['AUTH_SECRET']
if (!_authSecret) throw new Error('AUTH_SECRET env var is required')
const SECRET_KEY: string = _authSecret

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid stored secret')
  const k   = crypto.scryptSync(SECRET_KEY, 'twilio-salt', 32)
  const dec = crypto.createDecipheriv(ALG, k, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

export async function getTwilioAuthToken(tenantId: string): Promise<string | null> {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO', status: 'CONNECTED' },
    include: { twilioDetail: true },
  })
  const enc = conn?.twilioDetail?.encryptedAuthToken
  if (!enc) return null
  try { return decrypt(enc) } catch { return null }
}
