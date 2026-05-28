/**
 * Phase 2 — Twilio number transfer between user-owned subaccounts.
 *
 * Mechanically supported by Twilio: same-parent subaccounts can move a
 * number via:
 *   client.incomingPhoneNumbers(numberSid).update({ accountSid: targetSid })
 *
 * Where this gets nuanced is around side effects after the move:
 *   - A2P 10DLC registration is brand-scoped — re-registration required on
 *     the receiving subaccount before SMS works again
 *   - Webhook URLs are config on the subaccount level — they need to be
 *     re-established on the receiving subaccount (Phase 2.5 — we just warn)
 *   - Voice minute pool and SMS credit balance don't transfer with the
 *     number; they remain on the source subaccount
 *   - Brief routing gap during the actual API call (~5-30s)
 *
 * Permission rule: source AND target subaccount must both be owned by the
 * requesting user. We re-run the inventory query to confirm before any
 * Twilio API call.
 */

import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getTwilioClient } from './twilio.service.js'
import { listMyTwilioInventory } from './twilio-inventory.service.js'
import type { SubaccountInventory } from './twilio-inventory.service.js'

export type TransferTarget =
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'partner'; partnerId: string }

export interface PreviewWarning {
  code:
    | 'A2P_REREGISTRATION'
    | 'WEBHOOK_REROUTE'
    | 'CREDIT_LEDGER_STAYS'
    | 'BRIEF_ROUTING_GAP'
    | 'CHANGES_AGENT_OWNER'
  message: string
}

export interface PreviewBlocker {
  code:
    | 'NUMBER_NOT_FOUND'
    | 'SOURCE_NOT_OWNED'
    | 'TARGET_NOT_OWNED'
    | 'SAME_SUBACCOUNT'
    | 'NOT_PURCHASED'
    | 'MISSING_TWILIO_SID'
    | 'A2P_PENDING_REVIEW'
  message: string
}

export interface TransferPreview {
  numberId: string
  e164Number: string
  source: { kind: 'tenant' | 'partner'; sid: string; label: string }
  target: { kind: 'tenant' | 'partner'; sid: string; label: string }
  warnings: PreviewWarning[]
  blockers: PreviewBlocker[]
  ok: boolean // true ⇔ blockers.length === 0
}

function findSubaccountForNumber(
  inventory: SubaccountInventory[],
  numberId: string,
): { sub: SubaccountInventory; number: SubaccountInventory['numbers'][number] } | null {
  for (const sub of inventory) {
    const n = sub.numbers.find((x) => x.id === numberId)
    if (n) return { sub, number: n }
  }
  return null
}

function findTargetSubaccount(
  inventory: SubaccountInventory[],
  target: TransferTarget,
): SubaccountInventory | null {
  return inventory.find((sub) => {
    if (sub.kind !== target.kind) return false
    if (sub.kind === 'tenant') return sub.ownerEntityId === (target as { tenantId: string }).tenantId
    return sub.ownerEntityId === (target as { partnerId: string }).partnerId
  }) ?? null
}

export async function previewNumberTransfer(
  userId: string,
  numberId: string,
  target: TransferTarget,
): Promise<TransferPreview> {
  const { subaccounts } = await listMyTwilioInventory(userId)

  // 1. Resolve source and target. Either missing = ownership error.
  const sourceHit = findSubaccountForNumber(subaccounts, numberId)
  if (!sourceHit) {
    throw new AppError('NOT_FOUND', 'Number not found in your subaccounts', 404)
  }
  const targetSub = findTargetSubaccount(subaccounts, target)
  if (!targetSub) {
    return buildBlockedPreview(sourceHit, null, target, {
      code: 'TARGET_NOT_OWNED',
      message: "Target subaccount isn't owned by you",
    })
  }

  const { sub: sourceSub, number } = sourceHit

  // 2. Blockers
  const blockers: PreviewBlocker[] = []
  if (sourceSub.subaccountRecordId === targetSub.subaccountRecordId) {
    blockers.push({ code: 'SAME_SUBACCOUNT', message: 'Source and target are the same subaccount' })
  }
  if (number.purchaseStatus !== 'PURCHASED') {
    blockers.push({
      code: 'NOT_PURCHASED',
      message: `Number is in ${number.purchaseStatus} state — only PURCHASED numbers can transfer`,
    })
  }
  if (!number.twilioNumberSid) {
    blockers.push({
      code: 'MISSING_TWILIO_SID',
      message: 'Number has no Twilio SID on file (not yet provisioned)',
    })
  }
  if (number.a2pStatus === 'PENDING_QUEUE' || number.a2pStatus === 'SUBMITTED') {
    blockers.push({
      code: 'A2P_PENDING_REVIEW',
      message: `A2P registration is ${number.a2pStatus} — wait for the current review to clear before transferring`,
    })
  }

  // 3. Warnings (informational, don't block)
  const warnings: PreviewWarning[] = []
  if (number.a2pStatus === 'APPROVED') {
    warnings.push({
      code: 'A2P_REREGISTRATION',
      message:
        'This number is currently A2P 10DLC registered. After transfer, the registration is invalidated. You will need to re-register the number under the target subaccount’s brand + campaign before SMS works again.',
    })
  }
  if (number.isSmsEnabled) {
    warnings.push({
      code: 'WEBHOOK_REROUTE',
      message:
        'SMS routing will switch to the target subaccount. Make sure the target side has webhook URLs configured before transferring high-volume numbers.',
    })
  }
  warnings.push({
    code: 'BRIEF_ROUTING_GAP',
    message:
      'Inbound calls / SMS during the transfer call (~5–30 seconds) may experience a brief routing gap.',
  })
  warnings.push({
    code: 'CREDIT_LEDGER_STAYS',
    message:
      'Voice-minute history and SMS credit balance stay on the source subaccount — they do not transfer with the number.',
  })
  warnings.push({
    code: 'CHANGES_AGENT_OWNER',
    message:
      'After transfer, this number will route to the target subaccount’s agent (or fall back to default). Re-point the agent profile if you want the same conversation behavior.',
  })

  return {
    numberId: number.id,
    e164Number: number.e164Number,
    source: { kind: sourceSub.kind, sid: sourceSub.twilioSubaccountSid, label: sourceSub.label },
    target: { kind: targetSub.kind, sid: targetSub.twilioSubaccountSid, label: targetSub.label },
    warnings,
    blockers,
    ok: blockers.length === 0,
  }
}

function buildBlockedPreview(
  sourceHit: { sub: SubaccountInventory; number: SubaccountInventory['numbers'][number] },
  targetSub: SubaccountInventory | null,
  target: TransferTarget,
  blocker: PreviewBlocker,
): TransferPreview {
  const { sub: sourceSub, number } = sourceHit
  return {
    numberId: number.id,
    e164Number: number.e164Number,
    source: { kind: sourceSub.kind, sid: sourceSub.twilioSubaccountSid, label: sourceSub.label },
    target: {
      kind: targetSub?.kind ?? target.kind,
      sid: targetSub?.twilioSubaccountSid ?? '',
      label: targetSub?.label ?? '(not owned)',
    },
    warnings: [],
    blockers: [blocker],
    ok: false,
  }
}

// ─── Execute transfer ────────────────────────────────────────────────────────

export interface TransferResult {
  numberId: string
  e164Number: string
  fromSubaccountSid: string
  toSubaccountSid: string
}

export async function transferNumber(
  userId: string,
  numberId: string,
  target: TransferTarget,
  actorIpHash?: string | null,
): Promise<TransferResult> {
  // 1. Re-run preflight inside the same request — never trust a stale preview.
  const preview = await previewNumberTransfer(userId, numberId, target)
  if (!preview.ok) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot transfer: ${preview.blockers.map((b) => b.message).join('; ')}`,
      422,
    )
  }

  // 2. Re-fetch the live row + Twilio SIDs in case anything raced.
  const number = await prisma.phoneNumber.findUnique({
    where: { id: numberId },
    select: {
      id: true,
      e164Number: true,
      twilioNumberSid: true,
      tenantId: true,
      partnerId: true,
      a2pStatus: true,
    },
  })
  if (!number) throw new AppError('NOT_FOUND', 'Number not found', 404)
  if (!number.twilioNumberSid) throw new AppError('VALIDATION_ERROR', 'Missing Twilio SID', 422)

  // 3. Hit Twilio first — DB swap commits only after Twilio confirms. If
  //    Twilio fails, we don't desync our state. Conversely if Twilio
  //    succeeds and the DB swap fails, we still have a usable Twilio state +
  //    a follow-up reconcile job can catch it. (We accept that risk for v1;
  //    Phase 3 can add a worker that compares Twilio truth → DB.)
  const masterClient = await getTwilioClient('live')
  try {
    await masterClient.incomingPhoneNumbers(number.twilioNumberSid).update({
      accountSid: preview.target.sid,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Twilio update failed'
    throw new AppError('PROVIDER_ERROR', `Twilio transfer failed: ${msg}`, 502)
  }

  // 4. DB swap inside a transaction. We:
  //    - For tenant target: set tenantId=targetTenantId, partnerId=null
  //    - For partner target: set partnerId=targetPartnerId, tenantId stays
  //      at the platform tenant (so existing tenant-keyed queries still work
  //      per the schema comment on PhoneNumber.tenantId)
  //    - Reset twilioSubaccountSid to target's SID
  //    - Reset a2pStatus to NOT_REQUIRED — brand registration is invalidated
  //      by the move; partner re-registers under target side's brand
  //    - Clear agentProfileId — old agent belongs to old subaccount's owner
  //    Audit log written same transaction.
  const platformTenant = await prisma.tenant.findFirst({
    where: { slug: 'orbis-platform' },
    select: { id: true },
  })

  let updateData: {
    tenantId: string
    partnerId: string | null
    twilioSubaccountSid: string
    a2pStatus: 'NOT_REQUIRED'
    agentProfileId: null
  }

  if (target.kind === 'tenant') {
    updateData = {
      tenantId: target.tenantId,
      partnerId: null,
      twilioSubaccountSid: preview.target.sid,
      a2pStatus: 'NOT_REQUIRED',
      agentProfileId: null,
    }
  } else {
    if (!platformTenant) {
      throw new AppError('SERVER_ERROR', 'Platform tenant missing — cannot host partner number', 500)
    }
    updateData = {
      tenantId: platformTenant.id,
      partnerId: target.partnerId,
      twilioSubaccountSid: preview.target.sid,
      a2pStatus: 'NOT_REQUIRED',
      agentProfileId: null,
    }
  }

  await prisma.$transaction([
    prisma.phoneNumber.update({
      where: { id: number.id },
      data: updateData,
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'USER',
        actorUserId: userId,
        action: 'twilio.number.transfer',
        targetType: 'PhoneNumber',
        targetId: number.id,
        metadataJson: {
          e164: number.e164Number,
          fromSubaccountSid: preview.source.sid,
          toSubaccountSid: preview.target.sid,
          fromKind: preview.source.kind,
          toKind: preview.target.kind,
          fromLabel: preview.source.label,
          toLabel: preview.target.label,
          twilioNumberSid: number.twilioNumberSid,
          previousA2pStatus: number.a2pStatus,
        },
        ipHash: actorIpHash ?? null,
      },
    }),
  ])

  return {
    numberId: number.id,
    e164Number: number.e164Number,
    fromSubaccountSid: preview.source.sid,
    toSubaccountSid: preview.target.sid,
  }
}
