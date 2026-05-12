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

export async function sendGmailEmail(tenantId: string, params: {
  to: string
  subject: string
  body: string
  isHtml?: boolean
  contactId?: string
  conversationId?: string
}): Promise<void> {
  const client = await getAuthenticatedGoogleClient(tenantId)
  const gmail  = google.gmail({ version: 'v1', auth: client })

  const contentType = params.isHtml ? 'text/html' : 'text/plain'
  const rawEmail = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    params.body,
  ].join('\r\n')

  const encoded = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const sendResponse = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  })

  // Log to MessageLog so the dashboard "follow-up emails sent" KPI sees this send.
  // Non-fatal: if the lookup or write fails, the email itself is still successful.
  try {
    const conn = await prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'GOOGLE' },
      include: { googleDetail: true },
    })
    const sender = conn?.googleDetail?.mailboxEmail ?? 'unknown@gmail'

    await prisma.messageLog.create({
      data: {
        tenantId,
        contactId:         params.contactId ?? null,
        conversationId:    params.conversationId ?? null,
        channel:           'EMAIL',
        direction:         'OUTBOUND',
        sender,
        recipient:         params.to,
        subject:           params.subject,
        bodyText:          params.body,
        providerMessageId: sendResponse.data.id ?? null,
        deliveryStatus:    'sent',
        sentAt:            new Date(),
      },
    })
  } catch (err) {
    console.error('[google.service] MessageLog write failed:', err)
  }
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

// ── Per-staff member Google OAuth ────────────────────────────────────────────

export async function startStaffGoogleOAuth(tenantId: string, staffMemberId: string, actorUserId: string): Promise<{ url: string }> {
  const state = crypto.randomBytes(24).toString('hex')
  const oauthMeta = { oauthState: state, oauthInitiatedBy: actorUserId, staffMemberId, oauthStartedAt: new Date().toISOString() }

  // Create a fresh GOOGLE connection owned by this tenant, labeled for the staff member
  const staff = await prisma.staffMember.findFirst({ where: { id: staffMemberId, tenantId } })
  if (!staff) throw new AppError('NOT_FOUND', 'Staff member not found', 404)

  // If staff already has a connection, reuse and reset it
  if (staff.integrationConnectionId) {
    await prisma.integrationConnection.update({
      where: { id: staff.integrationConnectionId },
      data: { status: 'NOT_CONNECTED', metadataJson: oauthMeta },
    })
  } else {
    const conn = await prisma.integrationConnection.create({
      data: {
        tenantId,
        provider: 'GOOGLE',
        label: `Staff: ${staff.name}`,
        status: 'NOT_CONNECTED',
        metadataJson: oauthMeta,
      },
    })
    await prisma.staffMember.update({ where: { id: staffMemberId }, data: { integrationConnectionId: conn.id } })
  }

  const client = await buildOAuthClient()
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: REQUIRED_SCOPES, state })
  await writeAuditLog({ tenantId, actorType: 'USER', actorUserId, action: 'staff.google.oauth_started', targetType: 'StaffMember', targetId: staffMemberId })
  return { url }
}

export async function handleStaffGoogleCallback(code: string, state: string): Promise<{ tenantId: string; staffMemberId: string; email: string }> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { provider: 'GOOGLE', metadataJson: { path: ['oauthState'], equals: state } },
  })
  if (!connection?.tenantId) throw new AppError('BAD_REQUEST', 'Invalid OAuth state', 400)

  const meta = connection.metadataJson as Record<string, string>
  const staffMemberId = meta['staffMemberId']
  if (!staffMemberId) throw new AppError('BAD_REQUEST', 'State does not reference a staff member', 400)

  const tenantId = connection.tenantId
  const client = await buildOAuthClient()
  let tokens: Auth.Credentials
  try {
    const resp = await client.getToken(code)
    tokens = resp.tokens as Auth.Credentials
  } catch {
    await prisma.integrationConnection.update({ where: { id: connection.id }, data: { status: 'ERROR' } })
    throw new AppError('BAD_GATEWAY', 'Failed to exchange authorization code with Google', 502)
  }

  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email ?? ''

  const calendarClient = google.calendar({ version: 'v3', auth: client })
  let calendarIds: string[] = []
  try {
    const calList = await calendarClient.calendarList.list()
    calendarIds = (calList.data.items ?? []).map(c => c.id ?? '').filter(Boolean)
  } catch { /* non-fatal */ }

  const primaryCalendarId = calendarIds.find(id => id === email) ?? calendarIds[0] ?? null

  const secretRef = await prisma.secretRef.upsert({
    where: { ownerType_ownerId_secretType_label: { ownerType: 'INTEGRATION', ownerId: connection.id, secretType: 'google_oauth_tokens', label: 'primary' } },
    create: { ownerType: 'INTEGRATION', ownerId: connection.id, secretType: 'google_oauth_tokens', label: 'primary', provider: 'local', externalRef: encryptTokens(tokens), rotationStatus: 'VALID', lastValidatedAt: new Date() },
    update: { externalRef: encryptTokens(tokens), rotationStatus: 'VALID', lastValidatedAt: new Date() },
  })

  await prisma.$transaction(async (tx) => {
    await tx.integrationConnection.update({
      where: { id: connection.id },
      data: { status: 'CONNECTED', externalEmail: email, lastVerifiedAt: new Date(), metadataJson: { staffMemberId, secretRefId: secretRef.id } },
    })
    await tx.googleConnectionDetail.upsert({
      where: { integrationConnectionId: connection.id },
      create: { integrationConnectionId: connection.id, mailboxEmail: email, grantedScopesJson: REQUIRED_SCOPES, calendarIdsJson: calendarIds, tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
      update: { mailboxEmail: email, calendarIdsJson: calendarIds, tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
    })
    await tx.staffMember.update({
      where: { id: staffMemberId },
      data: { email: email || undefined, calendarId: primaryCalendarId },
    })
  })

  await writeAuditLog({ tenantId, actorType: 'SYSTEM', action: 'staff.google.connected', targetType: 'StaffMember', targetId: staffMemberId, metadataJson: { email, calendarCount: calendarIds.length } })
  return { tenantId, staffMemberId, email }
}

export async function disconnectStaffGoogle(tenantId: string, staffMemberId: string, actorUserId: string): Promise<void> {
  const staff = await prisma.staffMember.findFirst({ where: { id: staffMemberId, tenantId } })
  if (!staff?.integrationConnectionId) return

  const connId = staff.integrationConnectionId
  try {
    const ref = await prisma.secretRef.findFirst({ where: { ownerType: 'INTEGRATION', ownerId: connId, secretType: 'google_oauth_tokens' } })
    const tokens = decryptTokens(ref?.externalRef ?? '')
    if (typeof tokens['access_token'] === 'string') {
      const client = await buildOAuthClient()
      await client.revokeToken(tokens['access_token'] as string).catch(() => {})
    }
  } catch { /* non-fatal */ }

  await prisma.$transaction(async (tx) => {
    await tx.googleConnectionDetail.deleteMany({ where: { integrationConnectionId: connId } })
    await tx.secretRef.deleteMany({ where: { ownerType: 'INTEGRATION', ownerId: connId } })
    await tx.integrationConnection.delete({ where: { id: connId } })
    await tx.staffMember.update({ where: { id: staffMemberId }, data: { integrationConnectionId: null, calendarId: null } })
  })

  await writeAuditLog({ tenantId, actorType: 'USER', actorUserId, action: 'staff.google.disconnected', targetType: 'StaffMember', targetId: staffMemberId })
}

export async function getAuthenticatedGoogleClientByConnectionId(connectionId: string) {
  const ref = await prisma.secretRef.findFirst({ where: { ownerType: 'INTEGRATION', ownerId: connectionId, secretType: 'google_oauth_tokens' } })
  if (!ref?.externalRef) throw new AppError('NOT_FOUND', 'Google credentials not found — reconnect required', 404)

  const config = await getGoogleConfig()
  if (!config) throw new AppError('CONFIGURATION_ERROR', 'Google OAuth not configured', 503)

  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  const tokens = decryptTokens(ref.externalRef) as Auth.Credentials
  client.setCredentials(tokens)

  if (tokens.expiry_date && Date.now() > (tokens.expiry_date as number) - 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken()
    client.setCredentials(credentials)
    await prisma.secretRef.update({ where: { id: ref.id }, data: { externalRef: encryptTokens(credentials), lastValidatedAt: new Date() } })
  }
  return client
}

// ── Per-partner Google OAuth (Phase E.0) ─────────────────────────────────────
//
// Mirrors the staff-member flow above but scoped to AffiliateAccount instead
// of StaffMember. Partner connections live in IntegrationConnection with
// `tenantId = null` and `affiliateAccount.integrationConnectionId` pointing
// at the row (per AffiliateAccount.integrationConnectionId @unique). The
// same /api/integrations/google/callback route handles all three OAuth flows
// (tenant, staff, partner) — dispatch happens by the state metadata's
// staffMemberId/affiliateAccountId field.

export async function startPartnerGoogleOAuth(affiliateAccountId: string, actorUserId: string): Promise<{ url: string }> {
  const partner = await prisma.affiliateAccount.findUnique({ where: { id: affiliateAccountId } })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const state = crypto.randomBytes(24).toString('hex')
  const oauthMeta = { oauthState: state, oauthInitiatedBy: actorUserId, affiliateAccountId, oauthStartedAt: new Date().toISOString() }

  // Reuse existing connection if present, else create. Same pattern as staff.
  if (partner.integrationConnectionId) {
    await prisma.integrationConnection.update({
      where: { id: partner.integrationConnectionId },
      data:  { status: 'NOT_CONNECTED', metadataJson: oauthMeta },
    })
  } else {
    const conn = await prisma.integrationConnection.create({
      data: {
        tenantId: null,
        provider: 'GOOGLE',
        label:    `Partner: ${partner.displayName ?? partner.slug ?? partner.id}`,
        status:   'NOT_CONNECTED',
        metadataJson: oauthMeta,
      },
    })
    await prisma.affiliateAccount.update({
      where: { id: affiliateAccountId },
      data:  { integrationConnectionId: conn.id },
    })
  }

  const client = await buildOAuthClient()
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: REQUIRED_SCOPES, state })
  await writeAuditLog({
    actorType:   'USER',
    actorUserId,
    action:      'partner.google.oauth_started',
    targetType:  'AffiliateAccount',
    targetId:    affiliateAccountId,
  })
  return { url }
}

export async function handlePartnerGoogleCallback(code: string, state: string): Promise<{ affiliateAccountId: string; email: string }> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { provider: 'GOOGLE', metadataJson: { path: ['oauthState'], equals: state } },
  })
  if (!connection) throw new AppError('BAD_REQUEST', 'Invalid OAuth state', 400)

  const meta = connection.metadataJson as Record<string, string>
  const affiliateAccountId = meta['affiliateAccountId']
  if (!affiliateAccountId) throw new AppError('BAD_REQUEST', 'State does not reference a partner', 400)

  const client = await buildOAuthClient()
  let tokens: Auth.Credentials
  try {
    const resp = await client.getToken(code)
    tokens = resp.tokens as Auth.Credentials
  } catch {
    await prisma.integrationConnection.update({ where: { id: connection.id }, data: { status: 'ERROR' } })
    throw new AppError('BAD_GATEWAY', 'Failed to exchange authorization code with Google', 502)
  }

  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email ?? ''

  const calendarClient = google.calendar({ version: 'v3', auth: client })
  let calendarIds: string[] = []
  try {
    const calList = await calendarClient.calendarList.list()
    calendarIds = (calList.data.items ?? []).map(c => c.id ?? '').filter(Boolean)
  } catch { /* non-fatal */ }

  const primaryCalendarId = calendarIds.find(id => id === email) ?? calendarIds[0] ?? null

  const secretRef = await prisma.secretRef.upsert({
    where: { ownerType_ownerId_secretType_label: { ownerType: 'INTEGRATION', ownerId: connection.id, secretType: 'google_oauth_tokens', label: 'primary' } },
    create: { ownerType: 'INTEGRATION', ownerId: connection.id, secretType: 'google_oauth_tokens', label: 'primary', provider: 'local', externalRef: encryptTokens(tokens), rotationStatus: 'VALID', lastValidatedAt: new Date() },
    update: { externalRef: encryptTokens(tokens), rotationStatus: 'VALID', lastValidatedAt: new Date() },
  })

  await prisma.$transaction(async (tx) => {
    await tx.integrationConnection.update({
      where: { id: connection.id },
      data:  { status: 'CONNECTED', externalEmail: email, lastVerifiedAt: new Date(), metadataJson: { affiliateAccountId, secretRefId: secretRef.id } },
    })
    await tx.googleConnectionDetail.upsert({
      where:  { integrationConnectionId: connection.id },
      create: { integrationConnectionId: connection.id, mailboxEmail: email, grantedScopesJson: REQUIRED_SCOPES, calendarIdsJson: calendarIds, tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
      update: { mailboxEmail: email, calendarIdsJson: calendarIds, tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
    })
    // Auto-populate partner's calendarId field if it wasn't set manually.
    // The agent's book_appointment uses this; an explicit setting from the
    // partner profile editor overrides it.
    const partner = await tx.affiliateAccount.findUnique({ where: { id: affiliateAccountId }, select: { calendarId: true } })
    if (!partner?.calendarId && primaryCalendarId) {
      await tx.affiliateAccount.update({ where: { id: affiliateAccountId }, data: { calendarId: primaryCalendarId } })
    }
  })

  await writeAuditLog({
    actorType:   'SYSTEM',
    action:      'partner.google.connected',
    targetType:  'AffiliateAccount',
    targetId:    affiliateAccountId,
    metadataJson:{ email, calendarCount: calendarIds.length },
  })
  return { affiliateAccountId, email }
}

export async function disconnectPartnerGoogle(affiliateAccountId: string, actorUserId: string): Promise<void> {
  const partner = await prisma.affiliateAccount.findUnique({ where: { id: affiliateAccountId } })
  if (!partner?.integrationConnectionId) return
  const connId = partner.integrationConnectionId

  // Best-effort token revocation at Google. Non-fatal if it fails.
  try {
    const ref = await prisma.secretRef.findFirst({ where: { ownerType: 'INTEGRATION', ownerId: connId, secretType: 'google_oauth_tokens' } })
    const tokens = decryptTokens(ref?.externalRef ?? '')
    if (typeof tokens['access_token'] === 'string') {
      const client = await buildOAuthClient()
      await client.revokeToken(tokens['access_token'] as string).catch(() => {})
    }
  } catch { /* non-fatal */ }

  await prisma.$transaction(async (tx) => {
    await tx.googleConnectionDetail.deleteMany({ where: { integrationConnectionId: connId } })
    await tx.secretRef.deleteMany({ where: { ownerType: 'INTEGRATION', ownerId: connId } })
    await tx.affiliateAccount.update({ where: { id: affiliateAccountId }, data: { integrationConnectionId: null } })
    await tx.integrationConnection.delete({ where: { id: connId } })
  })

  await writeAuditLog({
    actorType:   'USER',
    actorUserId,
    action:      'partner.google.disconnected',
    targetType:  'AffiliateAccount',
    targetId:    affiliateAccountId,
  })
}

/** Returns the partner's Google connection status for the partner-portal UI. */
export async function getPartnerGoogleConnection(affiliateAccountId: string): Promise<{
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'PENDING'
  email: string | null
  lastVerifiedAt: Date | null
  calendarIds: string[]
} | null> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:   { id: affiliateAccountId },
    include: { integrationConnection: { include: { googleDetail: true } } },
  })
  const conn = partner?.integrationConnection
  if (!conn) return { status: 'NOT_CONNECTED', email: null, lastVerifiedAt: null, calendarIds: [] }
  return {
    status:         conn.status as any,
    email:          conn.externalEmail,
    lastVerifiedAt: conn.lastVerifiedAt,
    calendarIds:    (conn.googleDetail?.calendarIdsJson as string[] | null) ?? [],
  }
}

/** Authenticated Google API client for a specific partner — looks up their
 *  IntegrationConnection then delegates to the by-connection helper which
 *  handles token refresh. Throws 404 if the partner hasn't connected yet. */
export async function getAuthenticatedGoogleClientForPartner(affiliateAccountId: string) {
  const partner = await prisma.affiliateAccount.findUnique({ where: { id: affiliateAccountId } })
  if (!partner?.integrationConnectionId) {
    throw new AppError('NOT_FOUND', 'Partner has not connected Google', 404)
  }
  return getAuthenticatedGoogleClientByConnectionId(partner.integrationConnectionId)
}
