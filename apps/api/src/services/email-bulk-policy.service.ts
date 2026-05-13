/**
 * Bulk-email policy — admin-controlled, partners read-only.
 *
 * Phase F.4. Three layers:
 *
 *   1. Hard-coded fallbacks (this file).
 *   2. Platform defaults — SystemConfig keys editable at /admin/email-policy.
 *   3. Per-partner overrides — fields on AffiliateAccount, editable by admin
 *      on the partner detail page. Null = inherit platform default.
 *
 * Read order on resolve: per-partner override → platform default → hard-coded.
 * Partners themselves never edit any layer; the partner portal shows the
 * resolved values as a read-only "your limits" panel.
 *
 * Also owns the auto-suspend logic: when a partner's hard-bounce or complaint
 * rate over the last N sends crosses the configured threshold, set
 * AffiliateAccount.emailBulkSuspendedAt + reason and write a notification.
 */
import { prisma } from '../lib/prisma.js'
import { getConfigValue, setConfigValue } from './system-config.service.js'

// ── Hard-coded fallbacks (the floor) ────────────────────────────────────────
// Used when neither platform-config nor per-partner override is set.
const FALLBACKS = {
  dailyCap:                 50,
  sendWindowStartHour:      9,
  sendWindowEndHour:        17,
  dripIntervalSecs:         60,
  // Auto-suspend thresholds applied to the rolling window of the partner's
  // last 100 bulk sends. Numbers picked to match common ESP guidance — a
  // 5% hard-bounce rate is usually where ESPs send a "clean your list"
  // warning; 0.1% complaint rate is the "we'll throttle your account"
  // threshold for most providers.
  bounceAutoPauseRate:      0.05,
  complaintAutoPauseRate:   0.001,
  warningBounceRate:        0.02,
  warningComplaintRate:     0.0005,
  bulkEvaluationWindow:     100,
} as const

// ── SystemConfig keys ───────────────────────────────────────────────────────
const KEY = {
  dailyCap:                 'email.bulk.default.dailyCap',
  sendWindowStartHour:      'email.bulk.default.sendWindowStartHour',
  sendWindowEndHour:        'email.bulk.default.sendWindowEndHour',
  dripIntervalSecs:         'email.bulk.default.dripIntervalSecs',
  bounceAutoPauseRate:      'email.bulk.policy.bounceAutoPauseRate',
  complaintAutoPauseRate:   'email.bulk.policy.complaintAutoPauseRate',
  warningBounceRate:        'email.bulk.policy.warningBounceRate',
  warningComplaintRate:     'email.bulk.policy.warningComplaintRate',
  bulkEvaluationWindow:     'email.bulk.policy.evaluationWindow',
} as const

export type PlatformPolicy = {
  dailyCap:                int
  sendWindowStartHour:     int
  sendWindowEndHour:       int
  dripIntervalSecs:        int
  bounceAutoPauseRate:     number
  complaintAutoPauseRate:  number
  warningBounceRate:       number
  warningComplaintRate:    number
  bulkEvaluationWindow:    int
}

type int = number  // mild type-alias for readability — TS doesn't have a built-in int

async function getNumber(key: string, fallback: number): Promise<number> {
  const raw = await getConfigValue(key)
  if (raw == null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Resolve current platform-wide defaults. Reads SystemConfig and falls back
 *  to the FALLBACKS table for any unset key. */
export async function getPlatformPolicy(): Promise<PlatformPolicy> {
  const [
    dailyCap, startH, endH, drip, bouncePause, complaintPause,
    bounceWarn, complaintWarn, window,
  ] = await Promise.all([
    getNumber(KEY.dailyCap,               FALLBACKS.dailyCap),
    getNumber(KEY.sendWindowStartHour,    FALLBACKS.sendWindowStartHour),
    getNumber(KEY.sendWindowEndHour,      FALLBACKS.sendWindowEndHour),
    getNumber(KEY.dripIntervalSecs,       FALLBACKS.dripIntervalSecs),
    getNumber(KEY.bounceAutoPauseRate,    FALLBACKS.bounceAutoPauseRate),
    getNumber(KEY.complaintAutoPauseRate, FALLBACKS.complaintAutoPauseRate),
    getNumber(KEY.warningBounceRate,      FALLBACKS.warningBounceRate),
    getNumber(KEY.warningComplaintRate,   FALLBACKS.warningComplaintRate),
    getNumber(KEY.bulkEvaluationWindow,   FALLBACKS.bulkEvaluationWindow),
  ])
  return {
    dailyCap:               dailyCap,
    sendWindowStartHour:    startH,
    sendWindowEndHour:      endH,
    dripIntervalSecs:       drip,
    bounceAutoPauseRate:    bouncePause,
    complaintAutoPauseRate: complaintPause,
    warningBounceRate:      bounceWarn,
    warningComplaintRate:   complaintWarn,
    bulkEvaluationWindow:   window,
  }
}

/** Admin writes platform defaults. Validates numeric ranges before
 *  persisting so a stray "9999%" can't accidentally disable safeguards. */
export async function setPlatformPolicy(
  patch: Partial<PlatformPolicy>,
  updatedBy: string,
): Promise<PlatformPolicy> {
  // Validate ranges
  if (patch.dailyCap            != null && (patch.dailyCap < 1 || patch.dailyCap > 100_000))   throw new Error('dailyCap out of range')
  if (patch.sendWindowStartHour != null && (patch.sendWindowStartHour < 0 || patch.sendWindowStartHour > 23)) throw new Error('sendWindowStartHour out of range')
  if (patch.sendWindowEndHour   != null && (patch.sendWindowEndHour   < 0 || patch.sendWindowEndHour   > 23)) throw new Error('sendWindowEndHour out of range')
  if (patch.dripIntervalSecs    != null && (patch.dripIntervalSecs    < 1 || patch.dripIntervalSecs > 86_400)) throw new Error('dripIntervalSecs out of range')
  for (const k of ['bounceAutoPauseRate', 'complaintAutoPauseRate', 'warningBounceRate', 'warningComplaintRate'] as const) {
    const v = patch[k]
    if (v != null && (v < 0 || v > 1)) throw new Error(`${k} must be between 0 and 1`)
  }
  if (patch.bulkEvaluationWindow != null && (patch.bulkEvaluationWindow < 10 || patch.bulkEvaluationWindow > 10_000)) {
    throw new Error('bulkEvaluationWindow out of range')
  }

  const entries: [string, number | undefined][] = [
    [KEY.dailyCap,               patch.dailyCap],
    [KEY.sendWindowStartHour,    patch.sendWindowStartHour],
    [KEY.sendWindowEndHour,      patch.sendWindowEndHour],
    [KEY.dripIntervalSecs,       patch.dripIntervalSecs],
    [KEY.bounceAutoPauseRate,    patch.bounceAutoPauseRate],
    [KEY.complaintAutoPauseRate, patch.complaintAutoPauseRate],
    [KEY.warningBounceRate,      patch.warningBounceRate],
    [KEY.warningComplaintRate,   patch.warningComplaintRate],
    [KEY.bulkEvaluationWindow,   patch.bulkEvaluationWindow],
  ]
  for (const [key, value] of entries) {
    if (value !== undefined) await setConfigValue(key, String(value), false, updatedBy)
  }
  return getPlatformPolicy()
}

// ── Per-partner resolved view ────────────────────────────────────────────────
// What the bulk worker uses on every send decision. Resolves overrides over
// platform defaults over fallbacks. Returns the suspended state too so the
// worker can short-circuit before doing any work.

export type ResolvedPartnerPolicy = {
  partnerId:              string
  bulkEnabled:            boolean
  suspended:              boolean
  suspendedReason:        string | null
  dailyCap:               number
  sendWindowStartHour:    number
  sendWindowEndHour:      number
  dripIntervalSecs:       number
  /** From platform defaults; surfaced here so callers don't need a second
   *  policy read on every send. */
  bounceAutoPauseRate:    number
  complaintAutoPauseRate: number
  warningBounceRate:      number
  warningComplaintRate:   number
  bulkEvaluationWindow:   number
}

export async function getPartnerPolicy(partnerId: string): Promise<ResolvedPartnerPolicy | null> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: {
      id: true,
      emailBulkEnabled: true,
      emailBulkSuspendedAt: true,
      emailBulkSuspendedReason: true,
      emailDailyCap: true,
      emailSendWindowStartHour: true,
      emailSendWindowEndHour: true,
      emailDripIntervalSecs: true,
    },
  })
  if (!partner) return null

  const platform = await getPlatformPolicy()
  return {
    partnerId:              partner.id,
    bulkEnabled:            partner.emailBulkEnabled,
    suspended:              partner.emailBulkSuspendedAt != null,
    suspendedReason:        partner.emailBulkSuspendedReason,
    dailyCap:               partner.emailDailyCap            ?? platform.dailyCap,
    sendWindowStartHour:    partner.emailSendWindowStartHour ?? platform.sendWindowStartHour,
    sendWindowEndHour:      partner.emailSendWindowEndHour   ?? platform.sendWindowEndHour,
    dripIntervalSecs:       partner.emailDripIntervalSecs    ?? platform.dripIntervalSecs,
    bounceAutoPauseRate:    platform.bounceAutoPauseRate,
    complaintAutoPauseRate: platform.complaintAutoPauseRate,
    warningBounceRate:      platform.warningBounceRate,
    warningComplaintRate:   platform.warningComplaintRate,
    bulkEvaluationWindow:   platform.bulkEvaluationWindow,
  }
}

/** Admin sets per-partner overrides. Pass null to clear a field back to the
 *  platform default. Setting bulkEnabled false also pauses any RUNNING
 *  campaigns for that partner (handled by the bulk worker on next scan). */
export async function setPartnerOverrides(opts: {
  partnerId: string
  patch: Partial<{
    bulkEnabled:          boolean
    dailyCap:             number | null
    sendWindowStartHour:  number | null
    sendWindowEndHour:    number | null
    dripIntervalSecs:     number | null
  }>
}): Promise<void> {
  const { partnerId, patch } = opts
  const data: Record<string, unknown> = {}
  if (patch.bulkEnabled         !== undefined) data['emailBulkEnabled']         = patch.bulkEnabled
  if (patch.dailyCap            !== undefined) data['emailDailyCap']            = patch.dailyCap
  if (patch.sendWindowStartHour !== undefined) data['emailSendWindowStartHour'] = patch.sendWindowStartHour
  if (patch.sendWindowEndHour   !== undefined) data['emailSendWindowEndHour']   = patch.sendWindowEndHour
  if (patch.dripIntervalSecs    !== undefined) data['emailDripIntervalSecs']    = patch.dripIntervalSecs
  if (Object.keys(data).length === 0) return
  await prisma.affiliateAccount.update({ where: { id: partnerId }, data })
}

/** Admin manually suspends or unsuspends a partner's bulk sending. Suspended
 *  partners' RUNNING campaigns auto-pause on the next worker scan. */
export async function setPartnerBulkSuspension(opts: {
  partnerId: string
  suspended: boolean
  reason?: string
}): Promise<void> {
  await prisma.affiliateAccount.update({
    where: { id: opts.partnerId },
    data: opts.suspended
      ? { emailBulkSuspendedAt: new Date(), emailBulkSuspendedReason: opts.reason ?? 'admin_action' }
      : { emailBulkSuspendedAt: null,       emailBulkSuspendedReason: null },
  })
}

// ── Reputation evaluation ────────────────────────────────────────────────────
// Called from the bulk worker after each send and from the bounce webhook
// handler. Computes the partner's recent rates over the policy's
// bulkEvaluationWindow and acts on threshold crossings:
//   - exceeds bounceAutoPauseRate / complaintAutoPauseRate → suspend bulk
//   - exceeds warningBounceRate / warningComplaintRate → write notification
//     (deduped via AffiliateAccount.emailLastBulkWarningAt)
//
// Idempotent — repeated calls in the same evaluation window don't double-fire.

export type ReputationCheck = {
  windowSize:    number
  hardBounces:   number
  complaints:    number
  bounceRate:    number
  complaintRate: number
  /** Action just taken by this call. */
  action: 'none' | 'warned' | 'suspended'
}

export async function evaluatePartnerReputation(partnerId: string): Promise<ReputationCheck> {
  const policy = await getPartnerPolicy(partnerId)
  if (!policy) return { windowSize: 0, hardBounces: 0, complaints: 0, bounceRate: 0, complaintRate: 0, action: 'none' }

  const window = policy.bulkEvaluationWindow
  // Look at the partner's last N outbound EMAILs.
  const recent = await prisma.messageLog.findMany({
    where:   { partnerId, channel: 'EMAIL', direction: 'OUTBOUND' },
    orderBy: { createdAt: 'desc' },
    take:    window,
    select:  { bounceType: true, complainedAt: true },
  })
  if (recent.length === 0) {
    return { windowSize: 0, hardBounces: 0, complaints: 0, bounceRate: 0, complaintRate: 0, action: 'none' }
  }

  const hardBounces = recent.filter(r => r.bounceType === 'hard').length
  const complaints  = recent.filter(r => r.complainedAt != null).length
  const bounceRate  = hardBounces / recent.length
  const complaintRate = complaints / recent.length

  // Auto-suspend takes priority over warning.
  if (bounceRate >= policy.bounceAutoPauseRate || complaintRate >= policy.complaintAutoPauseRate) {
    if (!policy.suspended) {
      const reason = bounceRate >= policy.bounceAutoPauseRate
        ? `auto_suspended_bounce_rate:${(bounceRate * 100).toFixed(2)}%`
        : `auto_suspended_complaint_rate:${(complaintRate * 100).toFixed(2)}%`
      await setPartnerBulkSuspension({ partnerId, suspended: true, reason })
      return { windowSize: recent.length, hardBounces, complaints, bounceRate, complaintRate, action: 'suspended' }
    }
    return { windowSize: recent.length, hardBounces, complaints, bounceRate, complaintRate, action: 'none' }
  }

  if (bounceRate >= policy.warningBounceRate || complaintRate >= policy.warningComplaintRate) {
    // Dedupe: at most one warning per partner per 24h.
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      select: { emailLastBulkWarningAt: true, userId: true },
    })
    const since = partner?.emailLastBulkWarningAt
    if (!since || Date.now() - since.getTime() > 24 * 60 * 60 * 1000) {
      await prisma.affiliateAccount.update({
        where: { id: partnerId },
        data:  { emailLastBulkWarningAt: new Date() },
      })
      // Notification surface — the existing Notification table is tenant-keyed,
      // so partner notifications need a tenantId. Use the partner's hosting
      // tenant via their most recent campaign or fall back to platform tenant.
      const recentCamp = await prisma.emailCampaign.findFirst({
        where:   { partnerId },
        orderBy: { createdAt: 'desc' },
        select:  { tenantId: true },
      })
      const tenantId = recentCamp?.tenantId
        ?? (await prisma.tenant.findFirst({ where: { slug: 'orbis-platform' }, select: { id: true } }))?.id
      if (tenantId) {
        await prisma.notification.create({
          data: {
            tenantId,
            type:     'email_bulk_warning',
            priority: 'warning',
            title:    'Email reputation warning',
            body:     `Recent hard-bounce rate ${(bounceRate * 100).toFixed(2)}% / complaint rate ${(complaintRate * 100).toFixed(2)}%. Pause sending and review your list before continuing.`,
            linkPath: '/partner-portal/campaigns',
          },
        }).catch(() => null)
      }
      return { windowSize: recent.length, hardBounces, complaints, bounceRate, complaintRate, action: 'warned' }
    }
  }

  return { windowSize: recent.length, hardBounces, complaints, bounceRate, complaintRate, action: 'none' }
}
