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
import { getPlatformTwilioClient, getPlatformTwilioCredentials } from './twilio.service.js'

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

// ──────────────────────────────────────────────────────────────────────────────
// Platform-wide reconcile (admin) — diff every DB PhoneNumber row against what
// Twilio ACTUALLY reports across the master account + every subaccount.
//
// The admin phone-numbers page shows tenant-assigned numbers straight from the
// DB with no Twilio check, so the "inventory" can silently drift from reality:
// released numbers still listed (GHOST), numbers living on a different account
// than the DB claims (MISPLACED), voice webhook not pointing at our gateway so
// calls never reach Orby (WEBHOOK_DRIFT), or DB capability flags that disagree
// with the number's real Twilio capabilities (CAP_DRIFT). Numbers Twilio has on
// a subaccount that we never tracked show up as ORPHAN rows.
//
// Read-only: this flags drift, it never mutates Twilio or the DB.
// ──────────────────────────────────────────────────────────────────────────────

export type NumberSyncStatus =
  | 'IN_SYNC'
  | 'GHOST'          // DB row, no matching live Twilio number
  | 'MISPLACED'      // exists on Twilio but on a different account than DB says
  | 'WEBHOOK_DRIFT'  // inbound-enabled but voice webhook not pointing at our gateway
  | 'CAP_DRIFT'      // DB capability flags disagree with Twilio's real capabilities

export interface TenantNumberSync {
  status: NumberSyncStatus
  issues: string[]
  liveAccountSid: string | null
  /** Friendly name of the Twilio account the number actually lives on
   *  (e.g. "CapturedByPeterson"). Null for ghosts / unnamed accounts. */
  liveAccountLabel: string | null
  liveVoiceUrl: string | null
}

export interface OrphanTwilioNumber {
  twilioNumberSid: string
  e164Number: string
  accountSid: string
  ownerLabel: string | null
  friendlyName: string | null
  voiceUrl: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
}

export interface PhoneInventoryReconcile {
  /** Per-DB-row sync verdict, keyed by PhoneNumber.id. */
  byId: Record<string, TenantNumberSync>
  /** Live subaccount numbers with no DB row. */
  orphans: OrphanTwilioNumber[]
  summary: {
    total: number
    inSync: number
    ghost: number
    misplaced: number
    webhookDrift: number
    capDrift: number
    orphans: number
  }
  /** Set when the live Twilio pull failed; verdicts fall back to UNKNOWN-safe
   *  (everything marked IN_SYNC is suppressed, page shows the error instead). */
  syncError: string | null
  /** ISO timestamp the reconcile ran (server clock). */
  checkedAt: string
}

interface LiveNumber {
  sid: string
  phoneNumber: string
  accountSid: string
  voiceUrl: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
  friendlyName: string | null
}

/** Does a Twilio voiceUrl point at our own API host (→ inbound reaches Orby)? */
function pointsAtGateway(voiceUrl: string | null, apiHost: string): boolean {
  if (!voiceUrl) return false
  return voiceUrl.includes(apiHost)
}

/** Pull every incomingPhoneNumber across the master account and all
 *  subaccounts, using master credentials (parent creds can read subaccount
 *  resources by scoping the account SID in the path). */
async function fetchAllLiveTwilioNumbers(): Promise<{
  numbers: LiveNumber[]
  labelByAccount: Map<string, string>
  masterSid: string | null
}> {
  const [client, creds] = await Promise.all([
    getPlatformTwilioClient(),
    getPlatformTwilioCredentials(),
  ])
  const masterSid = creds?.accountSid ?? null

  // Every account under this project: the master itself + all subaccounts.
  const accounts = await client.api.accounts.list({ limit: 200 })
  const labelByAccount = new Map<string, string>()
  const numbers: LiveNumber[] = []

  for (const acct of accounts) {
    labelByAccount.set(acct.sid, acct.friendlyName ?? acct.sid)
    try {
      const live = await client.api.accounts(acct.sid).incomingPhoneNumbers.list({ limit: 200 })
      for (const ln of live) {
        numbers.push({
          sid:          ln.sid,
          phoneNumber:  ln.phoneNumber,
          accountSid:   acct.sid,
          voiceUrl:     ln.voiceUrl ?? null,
          friendlyName: ln.friendlyName ?? null,
          capabilities: {
            voice: !!ln.capabilities?.voice,
            sms:   !!ln.capabilities?.sms,
            mms:   !!ln.capabilities?.mms,
          },
        })
      }
    } catch {
      // Suspended / closed subaccounts can 20xxx here. Skip; its numbers just
      // won't appear as live matches (DB rows for it will read GHOST, which is
      // itself a signal worth surfacing).
    }
  }
  return { numbers, labelByAccount, masterSid }
}

/** Reconcile the DB's tenant-assigned PhoneNumber rows against live Twilio. */
export async function reconcilePhoneInventory(): Promise<PhoneInventoryReconcile> {
  const dbNumbers = await prisma.phoneNumber.findMany({
    select: {
      id: true,
      e164Number: true,
      twilioNumberSid: true,
      twilioSubaccountSid: true,
      isInboundEnabled: true,
      isSmsEnabled: true,
    },
  })

  const apiHost = (() => {
    try { return new URL(process.env['API_BASE_URL'] ?? 'https://api.myorbisvoice.com').host }
    catch { return 'api.myorbisvoice.com' }
  })()

  const empty = (syncError: string | null): PhoneInventoryReconcile => ({
    byId: {},
    orphans: [],
    summary: { total: dbNumbers.length, inSync: 0, ghost: 0, misplaced: 0, webhookDrift: 0, capDrift: 0, orphans: 0 },
    syncError,
    checkedAt: nowIso(),
  })

  let live: Awaited<ReturnType<typeof fetchAllLiveTwilioNumbers>>
  try {
    live = await fetchAllLiveTwilioNumbers()
  } catch (err) {
    return empty((err as Error).message?.slice(0, 200) ?? 'Twilio sync failed')
  }

  const bySid = new Map(live.numbers.map((n) => [n.sid, n]))
  const byE164 = new Map(live.numbers.map((n) => [n.phoneNumber, n]))
  const dbSids = new Set(dbNumbers.map((n) => n.twilioNumberSid).filter(Boolean) as string[])
  const dbE164 = new Set(dbNumbers.map((n) => n.e164Number))

  const byId: Record<string, TenantNumberSync> = {}
  const summary = { total: dbNumbers.length, inSync: 0, ghost: 0, misplaced: 0, webhookDrift: 0, capDrift: 0, orphans: 0 }

  for (const n of dbNumbers) {
    const match = (n.twilioNumberSid && bySid.get(n.twilioNumberSid)) || byE164.get(n.e164Number) || null
    const issues: string[] = []

    if (!match) {
      byId[n.id] = { status: 'GHOST', issues: ['Not found on Twilio — released, ported out, or never provisioned.'], liveAccountSid: null, liveAccountLabel: null, liveVoiceUrl: null }
      summary.ghost++
      continue
    }
    const liveAccountLabel = live.labelByAccount.get(match.accountSid) ?? null

    let misplaced = false, webhookDrift = false, capDrift = false

    if (n.twilioSubaccountSid && match.accountSid !== n.twilioSubaccountSid) {
      misplaced = true
      const liveLabel = live.labelByAccount.get(match.accountSid) ?? match.accountSid
      issues.push(`Lives on Twilio account ${match.accountSid.slice(0, 14)}… (${liveLabel}) but DB assigns it to ${n.twilioSubaccountSid.slice(0, 14)}…`)
    }
    if (n.isInboundEnabled && !pointsAtGateway(match.voiceUrl, apiHost)) {
      webhookDrift = true
      issues.push(`Voice webhook does not point at ${apiHost} — inbound calls won't reach Orby (currently: ${match.voiceUrl ? match.voiceUrl.slice(0, 60) : 'unset'}).`)
    }
    if (n.isInboundEnabled && !match.capabilities.voice) {
      capDrift = true
      issues.push('DB has inbound enabled but the Twilio number has no Voice capability.')
    }
    if (n.isSmsEnabled && !match.capabilities.sms) {
      capDrift = true
      issues.push('DB has SMS enabled but the Twilio number has no SMS capability.')
    }

    // Worst-first: MISPLACED > WEBHOOK_DRIFT > CAP_DRIFT > IN_SYNC.
    let status: NumberSyncStatus = 'IN_SYNC'
    if (misplaced) { status = 'MISPLACED'; summary.misplaced++ }
    else if (webhookDrift) { status = 'WEBHOOK_DRIFT'; summary.webhookDrift++ }
    else if (capDrift) { status = 'CAP_DRIFT'; summary.capDrift++ }
    else summary.inSync++

    byId[n.id] = { status, issues, liveAccountSid: match.accountSid, liveAccountLabel, liveVoiceUrl: match.voiceUrl }
  }

  // Orphans: live numbers on a SUBACCOUNT (not the master) that we don't track.
  // Master-owned numbers are legitimately shown in the platform section, so
  // they're excluded here.
  const orphans: OrphanTwilioNumber[] = []
  for (const ln of live.numbers) {
    if (live.masterSid && ln.accountSid === live.masterSid) continue
    if (dbSids.has(ln.sid) || dbE164.has(ln.phoneNumber)) continue
    orphans.push({
      twilioNumberSid: ln.sid,
      e164Number:      ln.phoneNumber,
      accountSid:      ln.accountSid,
      ownerLabel:      live.labelByAccount.get(ln.accountSid) ?? null,
      friendlyName:    ln.friendlyName,
      voiceUrl:        ln.voiceUrl,
      capabilities:    ln.capabilities,
    })
  }
  summary.orphans = orphans.length

  return { byId, orphans, summary, syncError: null, checkedAt: nowIso() }
}

/** Server clock as ISO — isolated so the reconcile has one timestamp source. */
function nowIso(): string {
  return new Date().toISOString()
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
