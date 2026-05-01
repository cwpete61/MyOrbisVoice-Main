import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'

const ALG = 'aes-256-gcm'
const SECRET_KEY = process.env['AUTH_SECRET'] ?? 'fallback-key'

function encrypt(plain: string): string {
  const k   = crypto.scryptSync(SECRET_KEY, 'gemini-salt', 32)
  const iv  = crypto.randomBytes(12)
  const cip = crypto.createCipheriv(ALG, k, iv)
  const enc = Buffer.concat([cip.update(plain, 'utf8'), cip.final()])
  const tag = cip.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.')
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid stored secret')
  const k   = crypto.scryptSync(SECRET_KEY, 'gemini-salt', 32)
  const dec = crypto.createDecipheriv(ALG, k, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

export async function saveGeminiApiKey(tenantId: string, apiKey: string) {
  const encrypted = encrypt(apiKey.trim())

  const existing = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GEMINI' },
  })

  if (existing) {
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        status: 'CONNECTED',
        lastVerifiedAt: new Date(),
        metadataJson: { encryptedApiKey: encrypted },
      },
    })
  } else {
    await prisma.integrationConnection.create({
      data: {
        tenantId,
        provider: 'GEMINI',
        label: 'Gemini Live API',
        status: 'CONNECTED',
        lastVerifiedAt: new Date(),
        metadataJson: { encryptedApiKey: encrypted },
      },
    })
  }
}

export async function getGeminiConnection(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GEMINI' },
  })
  if (!conn || conn.status !== 'CONNECTED') {
    return { status: 'NOT_CONNECTED' as const, lastVerifiedAt: null }
  }
  return { status: 'CONNECTED' as const, lastVerifiedAt: conn.lastVerifiedAt }
}

export async function getGeminiApiKey(tenantId: string): Promise<string | null> {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GEMINI' },
  })
  if (!conn || conn.status !== 'CONNECTED') return null
  const meta = conn.metadataJson as Record<string, string> | null
  const enc = meta?.['encryptedApiKey']
  if (!enc) return null
  try { return decrypt(enc) } catch { return null }
}

export async function disconnectGemini(tenantId: string) {
  await prisma.integrationConnection.deleteMany({
    where: { tenantId, provider: 'GEMINI' },
  })
}
