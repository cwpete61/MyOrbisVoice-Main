import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  return prisma.affiliateSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

export async function updateSettings(data: {
  cookieDurationDays?: number
  commissionRatePct?: number
  commissionType?: string
  minPayoutCents?: number
  autoApproveAfterDays?: number
  programName?: string
  programDescription?: string
  termsUrl?: string | null
}) {
  return prisma.affiliateSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
}

// ── Account management ────────────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode()
    const exists = await prisma.affiliateAccount.findUnique({ where: { referralCode: code } })
    if (!exists) return code
  }
  throw new Error('Could not generate unique referral code')
}

export async function applyForAffiliate(userId: string) {
  const existing = await prisma.affiliateAccount.findUnique({ where: { userId } })
  if (existing) return existing
  const code = await uniqueCode()
  return prisma.affiliateAccount.create({
    data: { userId, referralCode: code, status: 'PENDING' },
  })
}

export async function getAffiliateAccount(userId: string) {
  return prisma.affiliateAccount.findUnique({ where: { userId } })
}

export async function getAffiliateAccountById(id: string) {
  return prisma.affiliateAccount.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  })
}

export async function updatePayoutMethod(userId: string, data: Record<string, unknown>) {
  const account = await prisma.affiliateAccount.findUniqueOrThrow({ where: { userId } })
  return prisma.affiliateAccount.update({
    where: { id: account.id },
    data: { payoutMethodJson: data as never },
  })
}

export async function approveAffiliate(id: string) {
  return prisma.affiliateAccount.update({
    where: { id },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  })
}

export async function pauseAffiliate(id: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { status: 'PAUSED' } })
}

export async function reactivateAffiliate(id: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { status: 'ACTIVE' } })
}

export async function disableAffiliate(id: string, notes?: string) {
  return prisma.affiliateAccount.update({
    where: { id },
    data: { status: 'DISABLED', notes: notes ?? null },
  })
}

export async function updateAffiliateNotes(id: string, notes: string) {
  return prisma.affiliateAccount.update({ where: { id }, data: { notes } })
}

// ── Referral link ─────────────────────────────────────────────────────────────

export async function getReferralLink(userId: string) {
  const account = await prisma.affiliateAccount.findUniqueOrThrow({ where: { userId } })
  const appUrl = process.env.APP_URL ?? 'https://app.myorbisvoice.com'
  return {
    url:  `${appUrl}/r/${account.referralCode}`,
    code: account.referralCode,
  }
}

// ── Click tracking ────────────────────────────────────────────────────────────

export async function trackClick(
  referralCode: string,
  meta: { sessionId?: string; landingPath?: string; referrer?: string; ipHash?: string; userAgent?: string }
) {
  const account = await prisma.affiliateAccount.findUnique({ where: { referralCode } })
  if (!account || account.status !== 'ACTIVE') return null
  return prisma.affiliateClick.create({
    data: {
      affiliateAccountId: account.id,
      sessionId:   meta.sessionId,
      landingPath: meta.landingPath,
      referrer:    meta.referrer,
      ipHash:      meta.ipHash,
      userAgent:   meta.userAgent,
    },
  })
}

// ── Attribution on signup ─────────────────────────────────────────────────────

export async function attributeTenant(tenantId: string, referralCode: string) {
  const account = await prisma.affiliateAccount.findUnique({ where: { referralCode } })
  if (!account || account.status !== 'ACTIVE') return
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { referredByCode: referralCode, attributedAt: new Date() },
  })
}

// ── Conversion recording ──────────────────────────────────────────────────────

export async function recordConversion(opts: {
  referralCode: string
  tenantId: string
  subscriptionId?: string
  conversionType: string
  conversionValueCents?: number
}) {
  const settings = await getSettings()
  const account = await prisma.affiliateAccount.findUnique({ where: { referralCode: opts.referralCode } })
  if (!account || account.status !== 'ACTIVE') return null

  const existing = await prisma.affiliateConversion.findFirst({
    where: { affiliateAccountId: account.id, tenantId: opts.tenantId, conversionType: opts.conversionType },
  })
  if (existing) return existing

  const conversion = await prisma.affiliateConversion.create({
    data: {
      affiliateAccountId: account.id,
      tenantId:           opts.tenantId,
      subscriptionId:     opts.subscriptionId,
      conversionType:     opts.conversionType,
      conversionValue:    opts.conversionValueCents ?? null,
      occurredAt:         new Date(),
    },
  })

  let amountMinor = 0
  if (settings.commissionType === 'PERCENTAGE' && opts.conversionValueCents) {
    amountMinor = Math.round(opts.conversionValueCents * settings.commissionRatePct / 100)
  } else if (settings.commissionType === 'FLAT') {
    amountMinor = settings.minPayoutCents
  }

  if (amountMinor > 0) {
    await prisma.affiliateCommission.create({
      data: {
        affiliateConversionId: conversion.id,
        affiliateAccountId:    account.id,
        tenantId:              opts.tenantId,
        amountMinor,
        currency: 'usd',
        status:   'PENDING',
      },
    })
    await prisma.affiliateAccount.update({
      where: { id: account.id },
      data:  { totalEarnedCents: { increment: amountMinor } },
    })
  }

  return conversion
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getAffiliateStats(affiliateAccountId: string) {
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateAccountId } }),
    prisma.affiliateConversion.count({ where: { affiliateAccountId } }),
    prisma.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateAccountId },
      _sum: { amountMinor: true },
      _count: true,
    }),
  ])

  const byStatus = Object.fromEntries(
    commissions.map(r => [r.status, { count: r._count, cents: r._sum.amountMinor ?? 0 }])
  )
  return {
    clicks,
    conversions,
    pendingCents:    byStatus['PENDING']?.cents   ?? 0,
    approvedCents:   byStatus['APPROVED']?.cents  ?? 0,
    holdCents:       byStatus['HOLD']?.cents      ?? 0,
    paidCents:       byStatus['PAID']?.cents      ?? 0,
    reversedCents:   byStatus['REVERSED']?.cents  ?? 0,
    totalEarnedCents: Object.values(byStatus).reduce((s, v) => s + (v as { cents: number }).cents, 0),
  }
}

/**
 * Period-scoped stats for the partner dashboard's "Last N days" panel.
 * Returns the same shape as getAffiliateStats() but only counts events
 * (clicks, conversions, commissions) created within the trailing window.
 *
 * Conversion rate is computed as conversions/clicks; both 0 returns 0.
 */
export async function getPeriodStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.affiliateClick.count({
      where: { affiliateAccountId, createdAt: { gte: since } },
    }),
    prisma.affiliateConversion.count({
      where: { affiliateAccountId, occurredAt: { gte: since } },
    }),
    prisma.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateAccountId, createdAt: { gte: since } },
      _sum: { amountMinor: true },
      _count: true,
    }),
  ])
  const byStatus = Object.fromEntries(
    commissions.map(r => [r.status, { count: r._count, cents: r._sum.amountMinor ?? 0 }])
  )
  return {
    days,
    clicks,
    conversions,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    pendingCents:     byStatus['PENDING']?.cents  ?? 0,
    approvedCents:    byStatus['APPROVED']?.cents ?? 0,
    paidCents:        byStatus['PAID']?.cents     ?? 0,
    totalEarnedCents: Object.values(byStatus).reduce((s, v) => s + (v as { cents: number }).cents, 0),
  }
}

export async function getDailyClickStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const rows = await prisma.$queryRaw<{ day: string; clicks: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS clicks
    FROM "AffiliateClick"
    WHERE "affiliateAccountId" = ${affiliateAccountId}
      AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return rows.map(r => ({ day: (r.day as unknown as Date).toISOString().slice(0, 10), clicks: Number(r.clicks) }))
}

export async function getDailyConversionStats(affiliateAccountId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const rows = await prisma.$queryRaw<{ day: string; conversions: bigint }[]>`
    SELECT DATE_TRUNC('day', "occurredAt") AS day, COUNT(*) AS conversions
    FROM "AffiliateConversion"
    WHERE "affiliateAccountId" = ${affiliateAccountId}
      AND "occurredAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return rows.map(r => ({ day: (r.day as unknown as Date).toISOString().slice(0, 10), conversions: Number(r.conversions) }))
}

// ── Commission management ─────────────────────────────────────────────────────

export async function getCommissions(affiliateAccountId: string, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where: { affiliateAccountId },
      include: { affiliateConversion: { select: { conversionType: true, conversionValue: true, occurredAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateCommission.count({ where: { affiliateAccountId } }),
  ])
  return { items, total }
}

export async function approveCommission(id: string) {
  return prisma.affiliateCommission.update({
    where: { id },
    data:  { status: 'APPROVED', approvedAt: new Date() },
  })
}

export async function holdCommission(id: string) {
  return prisma.affiliateCommission.update({ where: { id }, data: { status: 'HOLD' } })
}

export async function reverseCommission(id: string) {
  const c = await prisma.affiliateCommission.update({ where: { id }, data: { status: 'REVERSED' } })
  await prisma.affiliateAccount.update({
    where: { id: c.affiliateAccountId },
    data:  { totalEarnedCents: { decrement: c.amountMinor } },
  })
  return c
}

export async function markCommissionPaid(id: string, payoutRef: string) {
  const c = await prisma.affiliateCommission.update({
    where: { id },
    data:  { status: 'PAID', paidAt: new Date(), payoutRef },
  })
  await prisma.affiliateAccount.update({
    where: { id: c.affiliateAccountId },
    data:  { totalPaidCents: { increment: c.amountMinor } },
  })
  return c
}

export async function bulkApproveCommissions(ids: string[]) {
  return prisma.affiliateCommission.updateMany({
    where: { id: { in: ids }, status: 'PENDING' },
    data:  { status: 'APPROVED', approvedAt: new Date() },
  })
}

// ── Payout requests ───────────────────────────────────────────────────────────

export async function requestPayout(userId: string) {
  const settings = await getSettings()
  const account = await prisma.affiliateAccount.findUniqueOrThrow({ where: { userId } })
  if (account.status !== 'ACTIVE') throw new Error('Account not active')

  const agg = await prisma.affiliateCommission.aggregate({
    where: { affiliateAccountId: account.id, status: 'APPROVED' },
    _sum:  { amountMinor: true },
  })
  const available = agg._sum.amountMinor ?? 0
  if (available < settings.minPayoutCents) {
    throw new Error(
      `Minimum payout is $${(settings.minPayoutCents / 100).toFixed(2)}. ` +
      `Available: $${(available / 100).toFixed(2)}`
    )
  }

  const [request] = await prisma.$transaction([
    prisma.affiliatePayoutRequest.create({
      data: {
        id:                 crypto.randomUUID(),
        affiliateAccountId: account.id,
        amountCents:        available,
        currency:           'usd',
        status:             'PENDING',
      },
    }),
    prisma.affiliateCommission.updateMany({
      where: { affiliateAccountId: account.id, status: 'APPROVED' },
      data:  { status: 'HOLD' },
    }),
    prisma.affiliateAccount.update({
      where: { id: account.id },
      data:  { payoutRequestedAt: new Date() },
    }),
  ])
  return request
}

export async function getPayoutRequests(affiliateAccountId: string) {
  return prisma.affiliatePayoutRequest.findMany({
    where:   { affiliateAccountId },
    orderBy: { requestedAt: 'desc' },
  })
}

export async function processPayoutRequest(id: string, payoutRef: string, notes?: string) {
  const req = await prisma.affiliatePayoutRequest.update({
    where: { id },
    data:  { status: 'PROCESSED', processedAt: new Date(), payoutRef, notes },
  })
  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateAccountId: req.affiliateAccountId, status: 'HOLD' },
  })
  for (const c of commissions) {
    await prisma.affiliateCommission.update({
      where: { id: c.id },
      data:  { status: 'PAID', paidAt: new Date(), payoutRef },
    })
  }
  await prisma.affiliateAccount.update({
    where: { id: req.affiliateAccountId },
    data:  { totalPaidCents: { increment: req.amountCents } },
  })
  return req
}

// ── Admin lists ───────────────────────────────────────────────────────────────

export async function listAffiliates(opts: { status?: string; search?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status) where['status'] = opts.status
  if (opts.search) {
    where['user'] = {
      OR: [
        { email:     { contains: opts.search, mode: 'insensitive' } },
        { firstName: { contains: opts.search, mode: 'insensitive' } },
        { lastName:  { contains: opts.search, mode: 'insensitive' } },
      ],
    }
  }
  const [items, total] = await Promise.all([
    prisma.affiliateAccount.findMany({
      where,
      include: {
        user:   { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { clicks: true, conversions: true, commissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliateAccount.count({ where }),
  ])
  return { items, total }
}

export async function listAdminPayoutRequests(opts: { status?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status) where['status'] = opts.status
  const [items, total] = await Promise.all([
    prisma.affiliatePayoutRequest.findMany({
      where,
      include: {
        affiliateAccount: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { requestedAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliatePayoutRequest.count({ where }),
  ])
  return { items, total }
}

export async function listAdminCommissions(opts: { status?: string; affiliateId?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {}
  if (opts.status)      where['status']             = opts.status
  if (opts.affiliateId) where['affiliateAccountId'] = opts.affiliateId
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      include: {
        affiliateAccount: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        affiliateConversion: { select: { conversionType: true, conversionValue: true, occurredAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (opts.page - 1) * opts.limit,
      take:    opts.limit,
    }),
    prisma.affiliateCommission.count({ where }),
  ])
  return { items, total }
}

export async function getRecentClicks(affiliateAccountId: string, limit = 20) {
  return prisma.affiliateClick.findMany({
    where:   { affiliateAccountId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}
