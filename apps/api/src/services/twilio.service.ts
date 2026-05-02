import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'

const ALG = 'aes-256-gcm'

function encryptSecret(plain: string, key: string): string {
  const k   = crypto.scryptSync(key, 'twilio-salt', 32)
  const iv  = crypto.randomBytes(12)
  const cip = crypto.createCipheriv(ALG, k, iv)
  const enc = Buffer.concat([cip.update(plain, 'utf8'), cip.final()])
  const tag = cip.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.')
}

function decryptSecret(stored: string, key: string): string {
  const [ivHex, tagHex, encHex] = stored.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid stored secret')
  const k   = crypto.scryptSync(key, 'twilio-salt', 32)
  const dec = crypto.createDecipheriv(ALG, k, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

const _authSecret = process.env['AUTH_SECRET']
if (!_authSecret) throw new Error('AUTH_SECRET env var is required')
const SECRET_KEY: string = _authSecret

export async function saveTwilioCredentials(tenantId: string, accountSid: string, authToken: string) {
  const encrypted = encryptSecret(authToken, SECRET_KEY)

  const existing = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO' },
    include: { twilioDetail: true },
  })

  if (existing) {
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: { status: 'CONNECTED', externalAccountId: accountSid, lastVerifiedAt: new Date() },
    })
    if (existing.twilioDetail) {
      await prisma.twilioConnectionDetail.update({
        where: { id: existing.twilioDetail.id },
        data: { accountSid, encryptedAuthToken: encrypted },
      })
    } else {
      await prisma.twilioConnectionDetail.create({
        data: { integrationConnectionId: existing.id, accountSid, encryptedAuthToken: encrypted },
      })
    }
  } else {
    await prisma.integrationConnection.create({
      data: {
        tenantId, provider: 'TWILIO', status: 'CONNECTED',
        label: 'Twilio', externalAccountId: accountSid, lastVerifiedAt: new Date(),
        twilioDetail: { create: { accountSid, encryptedAuthToken: encrypted } },
      },
    })
  }
}

export async function getTwilioConnection(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO' },
    include: { twilioDetail: true },
  })
  if (!conn || conn.status !== 'CONNECTED') {
    return { status: 'NOT_CONNECTED', accountSid: null, lastVerifiedAt: null }
  }
  return {
    status:         conn.status,
    accountSid:     conn.twilioDetail?.accountSid ?? null,
    lastVerifiedAt: conn.lastVerifiedAt,
  }
}

export async function disconnectTwilio(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO' },
  })
  if (!conn) return
  await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: { status: 'NOT_CONNECTED', externalAccountId: null, lastVerifiedAt: null },
  })
  await prisma.twilioConnectionDetail.deleteMany({
    where: { integrationConnectionId: conn.id },
  })
}

export async function getTwilioAuthToken(tenantId: string): Promise<string | null> {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO' },
    include: { twilioDetail: true },
  })
  const enc = conn?.twilioDetail?.encryptedAuthToken
  if (!enc) return null
  try { return decryptSecret(enc, SECRET_KEY) } catch { return null }
}
