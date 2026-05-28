/**
 * Commission tiers — admin-customizable, locked-at-signup-for-life.
 *
 * Model: three CommissionTier rows (level 1/2/3). A new partner snapshots
 * Tier 1's current recurringPct onto AffiliateAccount.commissionRatePct at
 * signup. That frozen rate is the source of truth for recordConversion —
 * editing a tier later never touches a locked partner. Admin can re-assign
 * a partner to another tier (re-snapshots that tier's CURRENT rate) or set
 * a fully custom rate (commissionTierId → null).
 *
 * Legacy partners (created before this feature) have commissionRatePct =
 * null; recordConversion falls back to the global AffiliateSettings rate
 * for them until an admin assigns a tier.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

// Seed values used only on FIRST read when the table is empty. Admin edits
// these via the Settings UI afterward. Recurring % of subscription.
const DEFAULT_TIERS = [
  { level: 1, name: 'Standard', recurringPct: 20 },
  { level: 2, name: 'Silver',   recurringPct: 25 },
  { level: 3, name: 'Gold',     recurringPct: 30 },
] as const

/** Returns all three tiers ordered by level, seeding defaults if the table
 *  is empty. Idempotent — safe to call on every request. */
export async function listCommissionTiers() {
  const existing = await prisma.commissionTier.findMany({ orderBy: { level: 'asc' } })
  if (existing.length > 0) return existing
  // Seed. createMany is safe under the unique(level) constraint; if a race
  // double-seeds we just re-read.
  await prisma.commissionTier.createMany({ data: DEFAULT_TIERS.map((t) => ({ ...t })), skipDuplicates: true })
  return prisma.commissionTier.findMany({ orderBy: { level: 'asc' } })
}

/** The signup-default tier (lowest level). Guaranteed to exist after
 *  listCommissionTiers() seeds. */
export async function getSignupTier() {
  const tiers = await listCommissionTiers()
  return tiers[0]! // level 1
}

/** Snapshot fields to spread onto a NEW AffiliateAccount at creation so the
 *  partner is locked to Tier 1's current rate for life. */
export async function getSignupCommissionSnapshot(): Promise<{
  commissionTierId: string
  commissionRatePct: number
  commissionLockedAt: Date
}> {
  const tier = await getSignupTier()
  return {
    commissionTierId:   tier.id,
    commissionRatePct:  tier.recurringPct,
    commissionLockedAt: new Date(),
  }
}

/** Update a tier's name and/or recurringPct. Does NOT touch already-locked
 *  partners — by design (the "for life" guarantee). */
export async function updateCommissionTier(
  id: string,
  patch: { name?: string; recurringPct?: number },
) {
  if (patch.recurringPct !== undefined) {
    if (!Number.isFinite(patch.recurringPct) || patch.recurringPct < 0 || patch.recurringPct > 100) {
      throw new AppError('VALIDATION_ERROR', 'recurringPct must be between 0 and 100', 422)
    }
  }
  if (patch.name !== undefined && patch.name.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'name cannot be empty', 422)
  }
  const data: { name?: string; recurringPct?: number } = {}
  if (patch.name !== undefined) data.name = patch.name.trim()
  if (patch.recurringPct !== undefined) data.recurringPct = patch.recurringPct
  try {
    return await prisma.commissionTier.update({ where: { id }, data })
  } catch {
    throw new AppError('NOT_FOUND', 'Commission tier not found', 404)
  }
}

/** Assign a partner to a tier — re-snapshots that tier's CURRENT rate onto
 *  the partner's frozen commissionRatePct. */
export async function assignPartnerToTier(partnerId: string, tierId: string) {
  const tier = await prisma.commissionTier.findUnique({ where: { id: tierId } })
  if (!tier) throw new AppError('NOT_FOUND', 'Commission tier not found', 404)
  return prisma.affiliateAccount.update({
    where: { id: partnerId },
    data: {
      commissionTierId:   tier.id,
      commissionRatePct:  tier.recurringPct,
      commissionLockedAt: new Date(),
    },
    select: { id: true, commissionTierId: true, commissionRatePct: true, commissionLockedAt: true },
  })
}

/** Set a fully custom recurring % on a single partner (clears the tier link).
 *  Used when a partner negotiated a one-off rate that doesn't match any tier. */
export async function setPartnerCustomRate(partnerId: string, recurringPct: number) {
  if (!Number.isFinite(recurringPct) || recurringPct < 0 || recurringPct > 100) {
    throw new AppError('VALIDATION_ERROR', 'recurringPct must be between 0 and 100', 422)
  }
  return prisma.affiliateAccount.update({
    where: { id: partnerId },
    data: {
      commissionTierId:   null,
      commissionRatePct:  recurringPct,
      commissionLockedAt: new Date(),
    },
    select: { id: true, commissionTierId: true, commissionRatePct: true, commissionLockedAt: true },
  })
}
