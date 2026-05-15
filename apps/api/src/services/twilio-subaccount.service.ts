/**
 * Twilio subaccount management — managed-Twilio model.
 *
 * Each tenant gets their own Twilio subaccount under the platform's master
 * account, created LAZILY on their first phone-number purchase. Numbers,
 * brands, billing in Twilio are scoped to the tenant's subaccount, which
 * gives us per-tenant isolation for compliance, abuse handling, and
 * usage reporting — while the platform retains overall ownership and
 * pays the Twilio bill.
 *
 * Subaccount auth tokens are encrypted at rest using the same scheme as
 * SystemConfig (sha256(AUTH_SECRET) → AES-256-GCM, colon-separated hex).
 */
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { getPlatformTwilioClient, getPlatformTwilioCredentials } from './twilio.service.js'
import { AppError } from '@voiceautomation/shared'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const secret = process.env['AUTH_SECRET'] ?? ''
  if (!secret) throw new Error('AUTH_SECRET env var is required')
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid ciphertext format')
  const key = getEncryptionKey()
  const dec = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

/**
 * Look up a subaccount's decrypted auth token by its Twilio SID.
 * Used by the webhook signature middleware: when a webhook arrives,
 * its AccountSid form field tells us which subaccount Twilio signed
 * the request with — we need that subaccount's token to validate.
 * Returns null if the SID isn't a known subaccount or status isn't ACTIVE.
 */
export async function getSubaccountAuthTokenBySid(subaccountSid: string): Promise<string | null> {
  const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { twilioSubaccountSid: subaccountSid } })
  if (!sub || sub.status !== 'ACTIVE') return null
  try {
    return decrypt(sub.encryptedSubaccountAuthToken)
  } catch {
    return null
  }
}

/**
 * Get the tenant's existing subaccount, or create one if it doesn't exist.
 * Idempotent — safe to call repeatedly.
 *
 * Returns { subaccountSid, authToken } — the auth token is decrypted in memory
 * for use in subsequent API calls. Don't pass it back through HTTP.
 */
export async function ensureTenantSubaccount(tenantId: string): Promise<{ subaccountSid: string; authToken: string }> {
  // Already exists?
  const existing = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId } })
  if (existing && existing.status === 'ACTIVE') {
    return {
      subaccountSid: existing.twilioSubaccountSid,
      authToken: decrypt(existing.encryptedSubaccountAuthToken),
    }
  }

  // Reactivate? (was closed/suspended — for now, throw and require admin intervention)
  if (existing && existing.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', `Tenant subaccount is in ${existing.status} state — contact support`, 403)
  }

  // Create on Twilio's side under the platform master
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)

  const masterClient = await getPlatformTwilioClient()
  const friendlyName = `OrbisVoice tenant: ${tenant.displayName} (${tenantId.slice(0, 8)})`
  const created = await masterClient.api.v2010.accounts.create({ friendlyName })

  await prisma.tenantTwilioSubaccount.create({
    data: {
      tenantId,
      twilioSubaccountSid: created.sid,
      encryptedSubaccountAuthToken: encrypt(created.authToken),
      status: 'ACTIVE',
    },
  })

  return { subaccountSid: created.sid, authToken: created.authToken }
}

/**
 * Returns a Twilio client scoped to the tenant's subaccount. Use this for any
 * operation on the tenant's resources (numbers, messages, calls, brands).
 *
 * Lazy-imports the twilio package and provisions the subaccount if needed.
 */
export async function getSubaccountClient(tenantId: string) {
  const { subaccountSid, authToken } = await ensureTenantSubaccount(tenantId)
  const Twilio = (await import('twilio')).default
  return Twilio(subaccountSid, authToken)
}

/**
 * Initiates the cancellation grace period for a tenant's subaccount.
 * After `graceDays` (default 14), a separate sweeper job releases all
 * numbers and closes the Twilio subaccount.
 *
 * Idempotent — calling twice just updates the deadline.
 */
export async function scheduleSubaccountClosure(tenantId: string, graceDays: number = 14) {
  const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId } })
  if (!sub || sub.status === 'CLOSED') return null

  const cancellationGraceUntil = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000)
  const releaseScheduledAt = cancellationGraceUntil

  await prisma.$transaction([
    prisma.tenantTwilioSubaccount.update({
      where: { tenantId },
      data: { status: 'PENDING_CLOSURE', cancellationGraceUntil },
    }),
    prisma.phoneNumber.updateMany({
      where: { tenantId },
      data: { releaseScheduledAt },
    }),
  ])

  return { cancellationGraceUntil }
}

/**
 * Cancels a pending closure (e.g. tenant resubscribes within the grace period).
 */
export async function cancelSubaccountClosure(tenantId: string) {
  const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId } })
  if (!sub || sub.status !== 'PENDING_CLOSURE') return

  await prisma.$transaction([
    prisma.tenantTwilioSubaccount.update({
      where: { tenantId },
      data: { status: 'ACTIVE', cancellationGraceUntil: null },
    }),
    prisma.phoneNumber.updateMany({
      where: { tenantId },
      data: { releaseScheduledAt: null },
    }),
  ])
}

/**
 * Hard-release: closes the Twilio subaccount and releases all its numbers.
 * Called by the sweeper after the grace period expires, OR by an admin
 * action for an abusive tenant.
 *
 * Two-step process: release each number individually, then close the
 * subaccount itself. If any number release fails we log and continue —
 * better to leak a $1.15/mo number than to leave the subaccount in a
 * half-closed state.
 */
export async function releaseSubaccountResources(tenantId: string): Promise<{ released: number; failed: number }> {
  const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId } })
  if (!sub) return { released: 0, failed: 0 }

  const subClient = await getSubaccountClient(tenantId)

  // Release each number on the subaccount
  const numbers = await prisma.phoneNumber.findMany({ where: { tenantId } })
  let released = 0
  let failed = 0
  for (const num of numbers) {
    if (!num.twilioNumberSid) continue
    try {
      await subClient.incomingPhoneNumbers(num.twilioNumberSid).remove()
      released++
    } catch (e) {
      console.warn(`[twilio-subaccount] Failed to release ${num.e164Number}:`, (e as Error).message)
      failed++
    }
  }

  // Wipe DB rows for the released numbers
  await prisma.phoneNumber.deleteMany({ where: { tenantId } })

  // Close the subaccount itself (status='closed' tells Twilio to suspend it)
  try {
    const masterClient = await getPlatformTwilioClient()
    await masterClient.api.v2010.accounts(sub.twilioSubaccountSid).update({ status: 'closed' })
  } catch (e) {
    console.warn(`[twilio-subaccount] Failed to close ${sub.twilioSubaccountSid}:`, (e as Error).message)
  }

  await prisma.tenantTwilioSubaccount.update({
    where: { tenantId },
    data: { status: 'CLOSED' },
  })

  return { released, failed }
}

/**
 * Returns the platform's master Twilio account-info shape. Used by the
 * number-search flow which queries the master inventory before transferring
 * to a subaccount.
 */
export async function getMasterCredentials() {
  const creds = await getPlatformTwilioCredentials()
  if (!creds) throw new AppError('INTERNAL_ERROR', 'Platform Twilio not configured (Admin → System Settings)', 500)
  return creds
}

// ─── Partner subaccounts (Phase G.1) ─────────────────────────────────────────
//
// Mirror of ensureTenantSubaccount / getSubaccountClient but partner-scoped.
// Same lifecycle: lazy-create on first resource purchase, status-gated, encrypted
// auth token. Subaccount is parented under the platform master Twilio account,
// just like the tenant variant.

export async function ensurePartnerSubaccount(partnerId: string): Promise<{ subaccountSid: string; authToken: string }> {
  const existing = await prisma.partnerTwilioSubaccount.findUnique({ where: { partnerId } })
  if (existing && existing.status === 'ACTIVE') {
    return {
      subaccountSid: existing.twilioSubaccountSid,
      authToken: decrypt(existing.encryptedSubaccountAuthToken),
    }
  }
  if (existing && existing.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', `Partner subaccount is in ${existing.status} state — contact support`, 403)
  }

  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: { displayName: true, slug: true, user: { select: { firstName: true, lastName: true } } },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const partnerLabel = partner.displayName
    ?? [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ').trim()
    ?? partner.slug
    ?? 'unknown'

  const masterClient = await getPlatformTwilioClient()
  const friendlyName = `OrbisVoice partner: ${partnerLabel} (${partnerId.slice(0, 8)})`
  const created = await masterClient.api.v2010.accounts.create({ friendlyName })

  await prisma.partnerTwilioSubaccount.create({
    data: {
      partnerId,
      twilioSubaccountSid: created.sid,
      encryptedSubaccountAuthToken: encrypt(created.authToken),
      status: 'ACTIVE',
    },
  })

  return { subaccountSid: created.sid, authToken: created.authToken }
}

/** Twilio client scoped to a partner's subaccount. Provisions lazily. */
export async function getPartnerSubaccountClient(partnerId: string) {
  const { subaccountSid, authToken } = await ensurePartnerSubaccount(partnerId)
  const Twilio = (await import('twilio')).default
  return Twilio(subaccountSid, authToken)
}

/** Status read — used by partner portal UI to show "subaccount provisioned" state. */
export async function getPartnerSubaccountStatus(partnerId: string): Promise<{
  exists:        boolean
  subaccountSid: string | null
  status:        string | null
}> {
  const row = await prisma.partnerTwilioSubaccount.findUnique({ where: { partnerId } })
  if (!row) return { exists: false, subaccountSid: null, status: null }
  return { exists: true, subaccountSid: row.twilioSubaccountSid, status: row.status }
}
