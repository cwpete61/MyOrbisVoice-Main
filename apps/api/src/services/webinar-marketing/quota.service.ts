/**
 * Per-partner verification quota.
 *
 * Platform commitment: 50 Reoon verifications per partner per day, baked
 * into the $10/mo cost. Computed by counting WebinarEmailVerification
 * rows from a Reoon provider in the last 24 hours, scoped to lists owned
 * by the partner.
 *
 * Quota check is advisory — when used up, the worker degrades gracefully
 * to internal-DNS-only verification (SYNTAX_DNS_ONLY mode) for the rest
 * of the day. Day boundary is rolling 24h, not midnight, to avoid burst
 * loads at the top of UTC.
 */

import { prisma } from '../../lib/prisma.js'

const DAILY_QUOTA = 50

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  resetAtIso: string
}

export async function getReoonQuotaStatus(partnerId: string): Promise<QuotaStatus> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Count Reoon verification rows in the rolling 24h window for this partner.
  // Verifications join up via extractedEmail → leadList → partnerId.
  const used = await prisma.webinarEmailVerification.count({
    where: {
      provider: 'reoon',
      verifiedAt: { gte: since },
      extractedEmail: {
        leadList: { partnerId },
      },
    },
  })

  return {
    used,
    limit: DAILY_QUOTA,
    remaining: Math.max(0, DAILY_QUOTA - used),
    resetAtIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

export async function canCallReoon(partnerId: string): Promise<boolean> {
  const status = await getReoonQuotaStatus(partnerId)
  return status.remaining > 0
}
