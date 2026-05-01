import { createDecipheriv, createHash } from 'crypto'
import { prisma } from './prisma.js'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const secret = process.env['AUTH_SECRET'] ?? ''
  return createHash('sha256').update(secret).digest()
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format')
  const iv   = Buffer.from(ivHex,  'hex')
  const tag  = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex,'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}

export async function getConfigValue(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } })
    if (!row) return null
    return row.isSecret ? decrypt(row.value) : row.value
  } catch {
    return null
  }
}
