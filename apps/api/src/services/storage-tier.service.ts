import { prisma } from '../lib/prisma.js'

export const TIERS = ['LTD', 'BASIC', 'ESSENTIALS', 'PREMIUM', 'ENTERPRISE'] as const
export type StorageTier = typeof TIERS[number]

const GB = BigInt(1024 * 1024 * 1024)

const TIER_DEFAULTS: Record<StorageTier, { quotaBytes: bigint; retentionDays: number | null; gracePeriodDays: number }> = {
  LTD:        { quotaBytes: BigInt(10)  * GB, retentionDays: null, gracePeriodDays: 30 },
  BASIC:      { quotaBytes: BigInt(2)   * GB, retentionDays: 90,   gracePeriodDays: 30 },
  ESSENTIALS: { quotaBytes: BigInt(5)   * GB, retentionDays: 180,  gracePeriodDays: 30 },
  PREMIUM:    { quotaBytes: BigInt(20)  * GB, retentionDays: 365,  gracePeriodDays: 30 },
  ENTERPRISE: { quotaBytes: BigInt(100) * GB, retentionDays: null, gracePeriodDays: 30 },
}

export async function getTierConfigs() {
  const rows = await prisma.storageTierConfig.findMany({ orderBy: { tier: 'asc' } })
  // Merge DB rows with hardcoded defaults (DB wins)
  return TIERS.map(tier => {
    const row = rows.find(r => r.tier === tier)
    const def = TIER_DEFAULTS[tier]
    const qb = row ? row.quotaBytes : def.quotaBytes
    return {
      tier,
      quotaBytes:      qb,
      retentionDays:   row ? row.retentionDays   : def.retentionDays,
      gracePeriodDays: row ? row.gracePeriodDays : def.gracePeriodDays,
      quotaGb:         Number(qb) / Number(GB),
    }
  })
}

export async function updateTierConfig(
  tier: StorageTier,
  data: { quotaGb?: number; retentionDays?: number | null; gracePeriodDays?: number },
  updatedBy: string,
) {
  const existing = await prisma.storageTierConfig.findUnique({ where: { tier } })
  const def      = TIER_DEFAULTS[tier]
  const base     = existing ?? { quotaBytes: def.quotaBytes, retentionDays: def.retentionDays, gracePeriodDays: def.gracePeriodDays }

  return prisma.storageTierConfig.upsert({
    where:  { tier },
    create: {
      tier,
      quotaBytes:      data.quotaGb !== undefined ? BigInt(Math.round(data.quotaGb * 1024 * 1024 * 1024)) : base.quotaBytes,
      retentionDays:   data.retentionDays  !== undefined ? data.retentionDays  : base.retentionDays,
      gracePeriodDays: data.gracePeriodDays !== undefined ? data.gracePeriodDays : base.gracePeriodDays,
      updatedBy,
    },
    update: {
      ...(data.quotaGb        !== undefined && { quotaBytes:      BigInt(Math.round(data.quotaGb * 1024 * 1024 * 1024)) }),
      ...(data.retentionDays  !== undefined && { retentionDays:   data.retentionDays }),
      ...(data.gracePeriodDays!== undefined && { gracePeriodDays: data.gracePeriodDays }),
      updatedBy,
    },
  })
}

// Apply a tier to a tenant — call this on signup, upgrade, or manual assignment
export async function applyTierToTenant(tenantId: string, tier: StorageTier) {
  const configs  = await getTierConfigs()
  const config   = configs.find(c => c.tier === tier)!
  const tenant   = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { storageTier: true, storageQuotaBytes: true },
  })

  const isDowngrade = tenant?.storageTier
    && TIERS.indexOf(tier) < TIERS.indexOf(tenant.storageTier as StorageTier)

  if (isDowngrade) {
    // Start grace period — keep current quota active until grace ends
    const graceDays      = config.gracePeriodDays
    const graceEndsAt    = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        storageTier:               tier,
        storageGracePeriodEndsAt:  graceEndsAt,
        storagePreviousQuotaBytes: tenant.storageQuotaBytes,
        recordingRetentionDays:    config.retentionDays,
        // Do NOT update storageQuotaBytes yet — grace period protects existing quota
      },
    })
    return { tier, gracePeriod: true, graceEndsAt, quotaBytes: tenant.storageQuotaBytes }
  }

  // Upgrade or fresh assignment — apply immediately
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      storageTier:               tier,
      storageQuotaBytes:         config.quotaBytes,
      storageGracePeriodEndsAt:  null,
      storagePreviousQuotaBytes: null,
      recordingRetentionDays:    config.retentionDays,
    },
  })
  return { tier, gracePeriod: false, graceEndsAt: null, quotaBytes: config.quotaBytes }
}

// Called on quota check — resolves effective quota (grace period aware)
export async function getEffectiveQuota(tenantId: string): Promise<{
  quotaBytes: bigint
  usedBytes: bigint
  pct: number
  canRecord: boolean
  nearLimit: boolean
  inGracePeriod: boolean
  graceEndsAt: Date | null
  tier: string | null
}> {
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: {
      storageQuotaBytes:         true,
      storageUsedBytes:          true,
      storageTier:               true,
      storageGracePeriodEndsAt:  true,
      storagePreviousQuotaBytes: true,
    },
  })

  const now              = new Date()
  const inGracePeriod    = !!(tenant?.storageGracePeriodEndsAt && tenant.storageGracePeriodEndsAt > now)
  const defaultQuota     = BigInt(1) * GB

  let quotaBytes: bigint
  if (inGracePeriod && tenant?.storagePreviousQuotaBytes) {
    // Still in grace period — honour old (larger) quota
    quotaBytes = tenant.storagePreviousQuotaBytes
  } else {
    if (!inGracePeriod && tenant?.storageGracePeriodEndsAt && tenant.storageGracePeriodEndsAt <= now) {
      // Grace period just expired — enforce new quota now
      const configs = await getTierConfigs()
      const config  = configs.find(c => c.tier === tenant.storageTier)
      if (config) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            storageQuotaBytes:         config.quotaBytes,
            storageGracePeriodEndsAt:  null,
            storagePreviousQuotaBytes: null,
          },
        })
        quotaBytes = config.quotaBytes
      } else {
        quotaBytes = tenant?.storageQuotaBytes ?? defaultQuota
      }
    } else {
      quotaBytes = tenant?.storageQuotaBytes ?? defaultQuota
    }
  }

  const usedBytes = tenant?.storageUsedBytes ?? BigInt(0)
  const pct       = Number(usedBytes) / Number(quotaBytes) * 100

  return {
    quotaBytes,
    usedBytes,
    pct,
    canRecord:     pct < 100,
    nearLimit:     pct >= 90 && pct < 100,
    inGracePeriod,
    graceEndsAt:   tenant?.storageGracePeriodEndsAt ?? null,
    tier:          tenant?.storageTier ?? null,
  }
}
