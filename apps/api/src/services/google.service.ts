import { google, type Auth } from 'googleapis'
import { prisma } from '../lib/prisma.js'
import { writeAuditLog } from '../lib/audit.js'
import { AppError } from '@voiceautomation/shared'
import { getGoogleConfig } from './system-config.service.js'
import crypto from 'node:crypto'

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
]

async function buildOAuthClient() {
  const config = await getGoogleConfig()
  if (!config) {
    throw new AppError('CONFIGURATION_ERROR', 'Google OAuth is not configured on this server', 503)
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
}

export async function startGoogleOAuth(tenantId: string, userId: string): Promise<{ url: string; state: string }> {
  const state = crypto.randomBytes(24).toString('hex')

  // Store state in DB so callback can validate it — find-then-create-or-update pattern
  const oauthMeta = { oauthState: state, oauthInitiatedBy: userId, oauthStartedAt: new Date().toISOString() }
  const existing = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GOOGLE' },
    select: { id: true },
  })
  if (existing) {
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: { status: 'NOT_CONNECTED', metadataJson: oauthMeta },
    })
  } else {
    await prisma.integrationConnection.create({
      data: { tenantId, provider: 'GOOGLE', label: 'Google Workspace', status: 'NOT_CONNECTED', metadataJson: oauthMeta },
    })
  }

  const client = await buildOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: REQUIRED_SCOPES,
    state,
  })

  await writeAuditLog({
    tenantId,
    actorType: 'USER',
    actorUserId: userId,
    action: 'integration.google.oauth_started',
    targetType: 'IntegrationConnection',
    metadataJson: { provider: 'GOOGLE' },
  })

  return { url, state }
}

export async function handleGoogleCallback(code: string, state: string): Promise<{
  tenantId: string
  email: string
}> {
  // Find integration by state token
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      provider: 'GOOGLE',
      metadataJson: { path: ['oauthState'], equals: state },
    },
  })

  if (!connection || !connection.tenantId) {
    throw new AppError('BAD_REQUEST', 'Invalid OAuth state — connection not found', 400)
  }

  const tenantId = connection.tenantId

  const client = await buildOAuthClient()
  let tokens: Auth.Credentials
  try {
    const resp = await client.getToken(code)
    tokens = resp.tokens as Auth.Credentials
  } catch {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: 'ERROR', metadataJson: { oauthState: state, error: 'token_exchange_failed' } },
    })
    await writeAuditLog({
      tenantId,
      actorType: 'SYSTEM',
      action: 'integration.google.oauth_failed',
      targetType: 'IntegrationConnection',
      targetId: connection.id,
      metadataJson: { reason: 'token_exchange_failed' },
    })
    throw new AppError('BAD_GATEWAY', 'Failed to exchange authorization code with Google', 502)
  }

  // Get user email from Google
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email ?? ''

  if (!email) {
    throw new AppError('BAD_GATEWAY', 'Could not retrieve email from Google', 502)
  }

  // Get calendar IDs
  const calendarClient = google.calendar({ version: 'v3', auth: client })
  let calendarIds: string[] = []
  try {
    const calList = await calendarClient.calendarList.list()
    calendarIds = (calList.data.items ?? []).map(c => c.id ?? '').filter(Boolean)
  } catch {
    // Non-fatal — calendar scope may not be granted
  }

  // Store encrypted ref stub — externalRef is a placeholder until a real vault is wired in
  const secretRef = await prisma.secretRef.upsert({
    where: {
      ownerType_ownerId_secretType_label: {
        ownerType: 'INTEGRATION',
        ownerId: connection.id,
        secretType: 'google_oauth_tokens',
        label: 'primary',
      },
    },
    create: {
      ownerType: 'INTEGRATION',
      ownerId: connection.id,
      secretType: 'google_oauth_tokens',
      label: 'primary',
      provider: 'local',
      // Encrypt tokens using AES-256-GCM with AUTH_SECRET as key material
      externalRef: encryptTokens(tokens),
      rotationStatus: 'VALID',
      lastValidatedAt: new Date(),
    },
    update: {
      externalRef: encryptTokens(tokens),
      rotationStatus: 'VALID',
      lastValidatedAt: new Date(),
    },
  })

  // Update connection record
  await prisma.$transaction(async (tx) => {
    await tx.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'CONNECTED',
        externalEmail: email,
        externalAccountId: userInfo.data.id ?? undefined,
        lastVerifiedAt: new Date(),
        metadataJson: { grantedScopes: REQUIRED_SCOPES, secretRefId: secretRef.id },
      },
    })
    await tx.googleConnectionDetail.upsert({
      where: { integrationConnectionId: connection.id },
      create: {
        integrationConnectionId: connection.id,
        mailboxEmail: email,
        grantedScopesJson: REQUIRED_SCOPES,
        calendarIdsJson: calendarIds,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        mailboxEmail: email,
        grantedScopesJson: REQUIRED_SCOPES,
        calendarIdsJson: calendarIds,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })
  })

  await writeAuditLog({
    tenantId,
    actorType: 'SYSTEM',
    action: 'integration.google.connected',
    targetType: 'IntegrationConnection',
    targetId: connection.id,
    metadataJson: { email, calendarCount: calendarIds.length },
  })

  return { tenantId, email }
}

export async function getGoogleConnection(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GOOGLE' },
    include: { googleDetail: true },
  })
  if (!conn) return null
  return {
    id: conn.id,
    status: conn.status,
    email: conn.externalEmail,
    lastVerifiedAt: conn.lastVerifiedAt,
    calendarIds: conn.googleDetail?.calendarIdsJson ?? [],
    grantedScopes: conn.googleDetail?.grantedScopesJson ?? [],
  }
}

export async function disconnectGoogle(tenantId: string, userId: string): Promise<void> {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GOOGLE' },
  })
  if (!conn) return

  // Revoke token if possible
  try {
    const ref = await prisma.secretRef.findFirst({
      where: { ownerType: 'INTEGRATION', ownerId: conn.id, secretType: 'google_oauth_tokens' },
    })
    const tokens = decryptTokens(ref?.externalRef ?? '')
    const accessToken = tokens?.access_token
    if (typeof accessToken === 'string' && accessToken) {
      const client = await buildOAuthClient()
      await client.revokeToken(accessToken).catch(() => {})
    }
  } catch {
    // Non-fatal — continue disconnect regardless
  }

  await prisma.$transaction(async (tx) => {
    await tx.integrationConnection.update({
      where: { id: conn.id },
      data: { status: 'NOT_CONNECTED', externalEmail: null, lastVerifiedAt: null },
    })
    await tx.googleConnectionDetail.deleteMany({ where: { integrationConnectionId: conn.id } })
    await tx.secretRef.deleteMany({ where: { ownerType: 'INTEGRATION', ownerId: conn.id } })
  })

  await writeAuditLog({
    tenantId,
    actorType: 'USER',
    actorUserId: userId,
    action: 'integration.google.disconnected',
    targetType: 'IntegrationConnection',
    targetId: conn.id,
  })
}

export async function getAuthenticatedGoogleClient(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'GOOGLE', status: 'CONNECTED' },
  })
  if (!conn) throw new AppError('NOT_FOUND', 'Google account not connected', 404)

  const ref = await prisma.secretRef.findFirst({
    where: { ownerType: 'INTEGRATION', ownerId: conn.id, secretType: 'google_oauth_tokens' },
  })
  if (!ref?.externalRef) throw new AppError('NOT_FOUND', 'Google credentials not found — reconnect required', 404)

  const rawTokens = decryptTokens(ref.externalRef)
  const client = await buildOAuthClient()
  client.setCredentials(rawTokens as Auth.Credentials)

  // Refresh if expired or near expiry
  const expiryDate = typeof rawTokens.expiry_date === 'number' ? rawTokens.expiry_date : null
  if (expiryDate && expiryDate < Date.now() + 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken()
    client.setCredentials(credentials)
    // Persist updated tokens
    await prisma.secretRef.updateMany({
      where: { ownerType: 'INTEGRATION', ownerId: conn.id, secretType: 'google_oauth_tokens' },
      data: { externalRef: encryptTokens(credentials), lastValidatedAt: new Date() },
    })
    if (credentials.expiry_date) {
      await prisma.googleConnectionDetail.updateMany({
        where: { integrationConnectionId: conn.id },
        data: { tokenExpiresAt: new Date(credentials.expiry_date) },
      })
    }
  }

  return client
}

// Simple AES-256-GCM encryption using AUTH_SECRET as key material
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(process.env['AUTH_SECRET'] ?? '').digest()
}

function encryptTokens(tokens: object): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = JSON.stringify(tokens)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decryptTokens(encoded: string): Record<string, unknown> {
  try {
    const buf = Buffer.from(encoded, 'base64')
    const key = getEncryptionKey()
    const iv = buf.subarray(0, 16)
    const tag = buf.subarray(16, 32)
    const encrypted = buf.subarray(32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(plain)
  } catch {
    return {}
  }
}
