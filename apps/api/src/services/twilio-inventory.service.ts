/**
 * Cross-account Twilio inventory.
 *
 * A user who signed up both as a tenant owner AND as a partner ends up with
 * two parallel Twilio subaccounts (one per role). This service joins the
 * identity links so a single user can see both subaccounts + their numbers
 * in one combined view.
 *
 * Phase 1: read-only — listing only. Phase 2 adds preflight + transfer.
 * Phase 3 (2026-05-27): live Twilio sync — for each known subaccount we
 * also pull the LIVE list of incomingPhoneNumbers from Twilio's API and
 * merge with our DB rows so numbers that exist on Twilio but were never
 * adopted into our DB (legacy, manually purchased outside our flow) show
 * up here with an Adopt button. Twilio is the source of truth for what
 * physically exists; our DB is the source of truth for assignment + agent
 * binding.
 *
 * Permission rule: a user qualifies for a tenant subaccount only when
 * TenantMember.isOwner=true. Regular tenant members don't manage Twilio
 * inventory through this surface.
 */
import { prisma } from '../lib/prisma.js'
import { getSubaccountAuthTokenBySid } from './twilio-subaccount.service.js'

export interface SubaccountInventoryNumber {
  id: string
  e164Number: string
  displayLabel: string | null
  notes: string | null
  twilioNumberSid: string | null
  isInboundEnabled: boolean
  isOutboundEnabled: boolean
  isSmsEnabled: boolean
  monthlyPriceCents: number | null
  partnerCapabilityTier: string | null
  a2pStatus: string
  purchaseStatus: string
  agentProfileId: string | null
  createdAt: Date
  /** True if this row exists in the PhoneNumber DB table. False = Twilio
   *  reports the number but our DB has no row → caller can adopt it. */
  dbTracked: boolean
}

/** A Twilio-side number that wasn't matched to any DB PhoneNumber row.
 *  Surfaced separately so the UI can render an Adopt button. */
export interface UntrackedTwilioNumber {
  twilioNumberSid: string
  e164Number: string
  friendlyName: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean; fax: boolean }
  dateCreated: string | null
}

export type SubaccountKind = 'tenant' | 'partner'

export interface SubaccountInventory {
  kind: SubaccountKind
  /** Subaccount row id (TenantTwilioSubaccount or PartnerTwilioSubaccount). */
  subaccountRecordId: string
  /** Twilio Subaccount SID — AC...xxxx. */
  twilioSubaccountSid: string
  /** Owning entity id (tenantId for tenant kind, affiliateAccountId for partner). */
  ownerEntityId: string
  /** Human label — tenant name OR partner display name + business. */
  label: string
  /** Status from the subaccount row (ACTIVE / PENDING_CLOSURE / etc). */
  status: string
  numbers: SubaccountInventoryNumber[]
  /** Numbers Twilio reports under this subaccount that DON'T have a DB row.
   *  UI shows these in a separate "Untracked" group with an Adopt button. */
  untracked: UntrackedTwilioNumber[]
  /** Set when live Twilio fetch failed for this subaccount. UI shows a warning
   *  ribbon; DB-known numbers still render so the page isn't useless. */
  liveSyncError: string | null
}

export interface EligibleLinkTarget {
  kind: 'tenant' | 'partner'
  id: string
  label: string
}

export interface MyTwilioInventory {
  subaccounts: SubaccountInventory[]
  /** True only when this user owns 2+ subaccounts — drives whether the
   *  transfer UI surface is even relevant for them. */
  canTransfer: boolean
  /** Tenants / partner profile the user owns that don't yet have a Twilio
   *  subaccount linked. UI uses these to populate the "Link existing
   *  subaccount" modal's target-side dropdown. */
  eligibleLinkTargets: EligibleLinkTarget[]
}

export async function listMyTwilioInventory(userId: string): Promise<MyTwilioInventory> {
  // 1. Tenant subaccounts: user must be the tenant OWNER (not just a member)
  //    AND the tenant must have provisioned a TenantTwilioSubaccount.
  const ownedTenants = await prisma.tenantMember.findMany({
    where: { userId, isOwner: true },
    include: {
      tenant: {
        select: {
          id: true,
          displayName: true,
          twilioSubaccount: {
            select: {
              id: true,
              twilioSubaccountSid: true,
              status: true,
            },
          },
        },
      },
    },
  })

  const tenantSubs: SubaccountInventory[] = []
  for (const tm of ownedTenants) {
    const t = tm.tenant
    if (!t.twilioSubaccount) continue
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId: t.id, partnerId: null },
      orderBy: { createdAt: 'desc' },
      select: numberSelect,
    })
    const merged = await mergeWithLiveTwilio(
      t.twilioSubaccount.twilioSubaccountSid,
      numbers.map((n) => ({ ...n, dbTracked: true })),
    )
    tenantSubs.push({
      kind: 'tenant',
      subaccountRecordId: t.twilioSubaccount.id,
      twilioSubaccountSid: t.twilioSubaccount.twilioSubaccountSid,
      ownerEntityId: t.id,
      label: t.displayName || 'Tenant',
      status: t.twilioSubaccount.status,
      numbers: merged.numbers,
      untracked: merged.untracked,
      liveSyncError: merged.liveSyncError,
    })
  }

  // 2. Partner subaccount: at most one per user (AffiliateAccount.userId is
  //    @unique).
  const partner = await prisma.affiliateAccount.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      businessName: true,
      deletedAt: true,
      twilioSubaccount: {
        select: {
          id: true,
          twilioSubaccountSid: true,
          status: true,
        },
      },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const partnerSubs: SubaccountInventory[] = []
  if (partner && !partner.deletedAt && partner.twilioSubaccount) {
    const numbers = await prisma.phoneNumber.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' },
      select: numberSelect,
    })
    const label =
      partner.displayName ||
      partner.businessName ||
      [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ') ||
      partner.user.email ||
      'Partner'
    const merged = await mergeWithLiveTwilio(
      partner.twilioSubaccount.twilioSubaccountSid,
      numbers.map((n) => ({ ...n, dbTracked: true })),
    )
    partnerSubs.push({
      kind: 'partner',
      subaccountRecordId: partner.twilioSubaccount.id,
      twilioSubaccountSid: partner.twilioSubaccount.twilioSubaccountSid,
      ownerEntityId: partner.id,
      label,
      status: partner.twilioSubaccount.status,
      numbers: merged.numbers,
      untracked: merged.untracked,
      liveSyncError: merged.liveSyncError,
    })
  }

  const subaccounts = [...tenantSubs, ...partnerSubs]

  // Eligible link targets = sides the user owns but hasn't linked yet.
  const eligibleLinkTargets: EligibleLinkTarget[] = []
  for (const tm of ownedTenants) {
    if (!tm.tenant.twilioSubaccount) {
      eligibleLinkTargets.push({ kind: 'tenant', id: tm.tenant.id, label: tm.tenant.displayName || 'Tenant' })
    }
  }
  if (partner && !partner.deletedAt && !partner.twilioSubaccount) {
    const label =
      partner.displayName ||
      partner.businessName ||
      [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ') ||
      partner.user.email ||
      'Partner'
    eligibleLinkTargets.push({ kind: 'partner', id: partner.id, label })
  }

  return {
    subaccounts,
    canTransfer: subaccounts.length >= 2,
    eligibleLinkTargets,
  }
}

const numberSelect = {
  id: true,
  e164Number: true,
  displayLabel: true,
  notes: true,
  twilioNumberSid: true,
  isInboundEnabled: true,
  isOutboundEnabled: true,
  isSmsEnabled: true,
  monthlyPriceCents: true,
  partnerCapabilityTier: true,
  a2pStatus: true,
  purchaseStatus: true,
  agentProfileId: true,
  createdAt: true,
} as const

/**
 * Fetch the live list of incomingPhoneNumbers from Twilio for a given
 * subaccount and reconcile against our DB rows. Returns:
 *   - numbers:     DB rows (each tagged dbTracked: true)
 *   - untracked:   Twilio-side numbers with NO matching DB row
 *   - liveSyncError: if the Twilio fetch fails for any reason, populated
 *                  with a short message; numbers + untracked still return
 *                  cleanly (untracked = [] on error).
 *
 * Match key is twilioNumberSid (the PN... SID), not E.164 — same number
 * can technically appear with different SIDs after a port/release/re-buy.
 *
 * Twilio calls happen with the subaccount's own auth token (not master),
 * so we get isolation semantics — a misconfigured token can't read across
 * subaccounts. Encrypted token lives in TenantTwilioSubaccount /
 * PartnerTwilioSubaccount; fetched via getSubaccountAuthTokenBySid().
 */
async function mergeWithLiveTwilio(
  subaccountSid: string,
  dbNumbers: SubaccountInventoryNumber[],
): Promise<{
  numbers: SubaccountInventoryNumber[]
  untracked: UntrackedTwilioNumber[]
  liveSyncError: string | null
}> {
  try {
    const authToken = await getSubaccountAuthTokenBySid(subaccountSid)
    if (!authToken) {
      return { numbers: dbNumbers, untracked: [], liveSyncError: 'No auth token on file for this subaccount' }
    }
    const Twilio = (await import('twilio')).default
    const client = Twilio(subaccountSid, authToken)
    const liveNumbers = await client.incomingPhoneNumbers.list({ limit: 200 })
    const dbBySid = new Map(dbNumbers.filter((n) => n.twilioNumberSid).map((n) => [n.twilioNumberSid as string, n]))
    const untracked: UntrackedTwilioNumber[] = []
    for (const ln of liveNumbers) {
      if (dbBySid.has(ln.sid)) continue
      untracked.push({
        twilioNumberSid: ln.sid,
        e164Number:      ln.phoneNumber,
        friendlyName:    ln.friendlyName ?? null,
        capabilities: {
          voice: !!ln.capabilities?.voice,
          sms:   !!ln.capabilities?.sms,
          mms:   !!ln.capabilities?.mms,
          fax:   !!ln.capabilities?.fax,
        },
        dateCreated: ln.dateCreated ? new Date(ln.dateCreated).toISOString() : null,
      })
    }
    return { numbers: dbNumbers, untracked, liveSyncError: null }
  } catch (err) {
    return {
      numbers: dbNumbers,
      untracked: [],
      liveSyncError: (err as Error).message?.slice(0, 200) ?? 'Twilio sync failed',
    }
  }
}
