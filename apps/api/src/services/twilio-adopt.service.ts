/**
 * Adopt a Twilio number into our DB.
 *
 * Background: a subaccount's `incomingPhoneNumbers` on Twilio is the source
 * of truth for what physically exists. Our PhoneNumber rows track ownership
 * + agent binding + capabilities + lifecycle. Occasionally Twilio has a
 * number that our DB never wrote a row for — legacy import, manual buy
 * outside the app, or a row that got dropped. "Adopt" creates the missing
 * PhoneNumber row so the number shows up in the partner / tenant management
 * surfaces and can be assigned to an agent.
 *
 * Adopt is always to the NATIVE side of the subaccount: a tenant subaccount
 * adopts to that tenant, a partner subaccount adopts to that partner. Use
 * the cross-side Move button (twilio-transfer.service.ts) to reassign
 * afterwards.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getSubaccountAuthTokenBySid } from './twilio-subaccount.service.js'
import { writeAuditLog } from '../lib/audit.js'

export interface AdoptResult {
  phoneNumberId: string
  e164Number: string
  side: 'tenant' | 'partner'
  ownerEntityId: string
}

/** Caller must already own (be an owner of) the subaccount this number lives
 *  under — checked here against TenantMember.isOwner / AffiliateAccount.userId.
 *  Returns the created PhoneNumber row id. */
export async function adoptTwilioNumber(
  userId: string,
  subaccountRecordId: string,
  twilioPhoneSid: string,
): Promise<AdoptResult> {
  // 1. Resolve subaccount + verify ownership.
  const tenantSub = await prisma.tenantTwilioSubaccount.findUnique({
    where: { id: subaccountRecordId },
    select: {
      id: true, twilioSubaccountSid: true, status: true, tenantId: true,
      tenant: { select: { id: true, members: { where: { userId, isOwner: true }, select: { userId: true } } } },
    },
  })
  const partnerSub = tenantSub ? null : await prisma.partnerTwilioSubaccount.findUnique({
    where: { id: subaccountRecordId },
    select: {
      id: true, twilioSubaccountSid: true, status: true, partnerId: true,
      partner: { select: { id: true, userId: true } },
    },
  })
  if (!tenantSub && !partnerSub) {
    throw new AppError('NOT_FOUND', 'Subaccount not found', 404)
  }

  let subaccountSid: string
  let side: 'tenant' | 'partner'
  let ownerEntityId: string
  let writeData: { tenantId: string; partnerId: string | null }

  if (tenantSub) {
    if (tenantSub.tenant.members.length === 0) {
      throw new AppError('FORBIDDEN', 'You are not an owner of this tenant', 403)
    }
    subaccountSid = tenantSub.twilioSubaccountSid
    side = 'tenant'
    ownerEntityId = tenantSub.tenantId
    writeData = { tenantId: tenantSub.tenantId, partnerId: null }
  } else {
    if (partnerSub!.partner.userId !== userId) {
      throw new AppError('FORBIDDEN', 'You are not the owner of this partner subaccount', 403)
    }
    // Partner-owned numbers ride on the platform tenant per the PhoneNumber.tenantId
    // schema comment — keep existing tenant-keyed queries working.
    const platformTenant = await prisma.tenant.findFirst({ where: { slug: 'orbis-platform' }, select: { id: true } })
    if (!platformTenant) {
      throw new AppError('SERVER_ERROR', 'Platform tenant missing', 500)
    }
    subaccountSid = partnerSub!.twilioSubaccountSid
    side = 'partner'
    ownerEntityId = partnerSub!.partnerId
    writeData = { tenantId: platformTenant.id, partnerId: partnerSub!.partnerId }
  }

  // 2. Refuse if a PhoneNumber row already tracks this SID — adopt is for
  //    untracked numbers only. If the row exists but is on the wrong side,
  //    use the Move flow, not adopt.
  const existing = await prisma.phoneNumber.findFirst({ where: { twilioNumberSid: twilioPhoneSid }, select: { id: true } })
  if (existing) {
    throw new AppError('CONFLICT', 'This number already has a DB record — use Move to reassign', 409)
  }

  // 3. Fetch the live number from Twilio so we capture E.164 + capabilities
  //    accurately (don't trust caller-passed values).
  const authToken = await getSubaccountAuthTokenBySid(subaccountSid)
  if (!authToken) {
    throw new AppError('SERVER_ERROR', 'No auth token on file for this subaccount', 500)
  }
  const Twilio = (await import('twilio')).default
  const client = Twilio(subaccountSid, authToken)
  const ln = await client.incomingPhoneNumbers(twilioPhoneSid).fetch().catch(() => null)
  if (!ln) {
    throw new AppError('NOT_FOUND', 'Twilio does not report this number under your subaccount', 404)
  }

  // 4. Create the PhoneNumber row.
  const row = await prisma.phoneNumber.create({
    data: {
      ...writeData,
      twilioNumberSid:     twilioPhoneSid,
      twilioSubaccountSid: subaccountSid,
      e164Number:          ln.phoneNumber,
      displayLabel:        ln.friendlyName || null,
      isInboundEnabled:    !!ln.capabilities?.voice,
      isOutboundEnabled:   !!ln.capabilities?.voice,
      isSmsEnabled:        !!ln.capabilities?.sms,
      purchaseStatus:      'PURCHASED',
      a2pStatus:           'NOT_REQUIRED',
    },
    select: { id: true, e164Number: true },
  })

  await writeAuditLog({
    actorUserId:  userId,
    actorType:    'USER',
    action:       'twilio.number.adopted',
    targetType:   'PhoneNumber',
    targetId:     row.id,
    metadataJson: {
      side,
      ownerEntityId,
      subaccountSid,
      twilioNumberSid: twilioPhoneSid,
      e164Number:      ln.phoneNumber,
    },
  })

  return {
    phoneNumberId: row.id,
    e164Number:    row.e164Number,
    side,
    ownerEntityId,
  }
}
