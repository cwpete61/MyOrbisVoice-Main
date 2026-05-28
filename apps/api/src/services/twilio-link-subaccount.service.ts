/**
 * Link an existing Twilio subaccount to a tenant or partner.
 *
 * Used when a user already has a Twilio subaccount (created outside our
 * normal purchase flow, or inherited from a legacy account) and wants
 * MyOrbisVoice to manage its numbers. Caller passes:
 *   - twilioSubaccountSid (AC...)
 *   - authToken (the subaccount's auth token)
 *   - target side: tenant (must be owner) or partner (must own the partner profile)
 *
 * We verify the subaccount exists on Twilio + the auth token works by
 * hitting Twilio's Account.fetch() through it. On success we write a
 * TenantTwilioSubaccount or PartnerTwilioSubaccount row with the auth
 * token encrypted at rest.
 *
 * Refuses if:
 *   - Side already has a subaccount linked (tenant or partner)
 *   - The given subaccount SID is already linked to ANY tenant/partner row
 *   - Twilio rejects the verification call (bad SID, bad token, closed sub)
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'
import { encrypt } from './system-config.service.js'

export type LinkTarget =
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'partner'; partnerId: string }

export interface LinkResult {
  side: 'tenant' | 'partner'
  ownerEntityId: string
  subaccountRecordId: string
  twilioSubaccountSid: string
  twilioFriendlyName: string | null
}

export async function linkExistingSubaccount(
  userId: string,
  twilioSubaccountSid: string,
  authToken: string,
  target: LinkTarget,
): Promise<LinkResult> {
  if (!/^AC[0-9a-f]{32}$/i.test(twilioSubaccountSid)) {
    throw new AppError('VALIDATION_ERROR', 'twilioSubaccountSid must look like ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 422)
  }
  if (authToken.length < 16) {
    throw new AppError('VALIDATION_ERROR', 'authToken looks too short to be valid', 422)
  }

  // 1. Verify ownership of the target side.
  if (target.kind === 'tenant') {
    const membership = await prisma.tenantMember.findFirst({
      where: { tenantId: target.tenantId, userId, isOwner: true },
      select: { userId: true },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', 'You are not an owner of this tenant', 403)
    }
    const already = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId: target.tenantId } })
    if (already) {
      throw new AppError('CONFLICT', 'This tenant already has a Twilio subaccount linked', 409)
    }
  } else {
    const aff = await prisma.affiliateAccount.findUnique({
      where: { id: target.partnerId },
      select: { id: true, userId: true },
    })
    if (!aff || aff.userId !== userId) {
      throw new AppError('FORBIDDEN', 'You do not own this partner profile', 403)
    }
    const already = await prisma.partnerTwilioSubaccount.findUnique({ where: { partnerId: target.partnerId } })
    if (already) {
      throw new AppError('CONFLICT', 'This partner already has a Twilio subaccount linked', 409)
    }
  }

  // 2. Verify the subaccount SID isn't already linked elsewhere.
  const otherTenantSub = await prisma.tenantTwilioSubaccount.findUnique({ where: { twilioSubaccountSid } })
  if (otherTenantSub) {
    throw new AppError('CONFLICT', 'This Twilio subaccount is already linked to a tenant', 409)
  }
  const otherPartnerSub = await prisma.partnerTwilioSubaccount.findUnique({ where: { twilioSubaccountSid } })
  if (otherPartnerSub) {
    throw new AppError('CONFLICT', 'This Twilio subaccount is already linked to a partner', 409)
  }

  // 3. Verify with Twilio that the SID + token are valid + the account is ACTIVE.
  const Twilio = (await import('twilio')).default
  const client = Twilio(twilioSubaccountSid, authToken)
  let twilioFriendlyName: string | null = null
  try {
    const acct = await client.api.accounts(twilioSubaccountSid).fetch()
    if (acct.status !== 'active') {
      throw new AppError('VALIDATION_ERROR', `Twilio reports this subaccount as ${acct.status} — only ACTIVE subaccounts can be linked`, 422)
    }
    twilioFriendlyName = acct.friendlyName ?? null
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('VALIDATION_ERROR', `Twilio verification failed: ${(err as Error).message?.slice(0, 200) ?? 'unknown'}`, 422)
  }

  // 4. Write the link row with encrypted token.
  const encrypted = encrypt(authToken)
  let subaccountRecordId: string
  let ownerEntityId: string
  let side: 'tenant' | 'partner'
  if (target.kind === 'tenant') {
    const row = await prisma.tenantTwilioSubaccount.create({
      data: {
        tenantId:                     target.tenantId,
        twilioSubaccountSid,
        encryptedSubaccountAuthToken: encrypted,
        status:                       'ACTIVE',
      },
      select: { id: true },
    })
    subaccountRecordId = row.id
    ownerEntityId      = target.tenantId
    side               = 'tenant'
  } else {
    const row = await prisma.partnerTwilioSubaccount.create({
      data: {
        partnerId:                    target.partnerId,
        twilioSubaccountSid,
        encryptedSubaccountAuthToken: encrypted,
        status:                       'ACTIVE',
      },
      select: { id: true },
    })
    subaccountRecordId = row.id
    ownerEntityId      = target.partnerId
    side               = 'partner'
  }

  await writeAuditLog({
    actorUserId:  userId,
    actorType:    'USER',
    action:       'twilio.subaccount.linked',
    targetType:   target.kind === 'tenant' ? 'Tenant' : 'AffiliateAccount',
    targetId:     ownerEntityId,
    metadataJson: { twilioSubaccountSid, twilioFriendlyName, subaccountRecordId },
  })

  return { side, ownerEntityId, subaccountRecordId, twilioSubaccountSid, twilioFriendlyName }
}
