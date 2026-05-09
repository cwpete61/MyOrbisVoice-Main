// Marketing voice intensity — operationalizes the 4-tier Aggression Spectrum
// defined in docs/marketing-style-guide.md. Stored on:
//   - BusinessProfile.aggressionTier         (tenant default)
//   - AffiliateAccount.aggressionTier        (partner default)
//   - Campaign.aggressionTier (nullable)     (per-campaign override)
//
// Resolution for any given outbound dispatch: campaign override (if non-null)
// → tenant default → 'balanced'. Same resolver also feeds AI-Assist generated
// copy + future Bunny-hosted partner assets.

import { prisma } from './prisma.js'

export const AGGRESSION_TIERS = ['conservative', 'balanced', 'direct', 'aggressive'] as const
export type AggressionTier = (typeof AGGRESSION_TIERS)[number]

export const DEFAULT_AGGRESSION_TIER: AggressionTier = 'balanced'

export function isValidAggressionTier(value: unknown): value is AggressionTier {
  return typeof value === 'string' && (AGGRESSION_TIERS as readonly string[]).includes(value)
}

// Resolve the effective tier for a tenant + optional campaign. Used by the
// AI-Assist injection layer and the campaign-scheduler when generating per-
// dispatch copy.
export async function resolveAggressionTier(
  tenantId: string,
  campaignId?: string | null,
): Promise<AggressionTier> {
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { aggressionTier: true },
    })
    if (campaign?.aggressionTier && isValidAggressionTier(campaign.aggressionTier)) {
      return campaign.aggressionTier
    }
  }
  const profile = await prisma.businessProfile.findUnique({
    where: { tenantId },
    select: { aggressionTier: true },
  })
  if (profile?.aggressionTier && isValidAggressionTier(profile.aggressionTier)) {
    return profile.aggressionTier
  }
  return DEFAULT_AGGRESSION_TIER
}

// Resolve the partner-side tier for AffiliateAccount-scoped content generation
// (pitch templates, prospect-facing one-pagers, future Bunny landing pages).
export async function resolvePartnerAggressionTier(
  affiliateAccountId: string,
): Promise<AggressionTier> {
  const account = await prisma.affiliateAccount.findUnique({
    where: { id: affiliateAccountId },
    select: { aggressionTier: true },
  })
  if (account?.aggressionTier && isValidAggressionTier(account.aggressionTier)) {
    return account.aggressionTier
  }
  return DEFAULT_AGGRESSION_TIER
}
