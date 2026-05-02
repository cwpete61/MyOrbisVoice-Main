import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const now = new Date()

  // Date boundaries
  const startOf30Days = new Date(now); startOf30Days.setDate(now.getDate() - 29); startOf30Days.setHours(0,0,0,0)
  const startOf7Days  = new Date(now); startOf7Days.setDate(now.getDate() - 6);   startOf7Days.setHours(0,0,0,0)
  const startOfToday  = new Date(now); startOfToday.setHours(0,0,0,0)
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalCallsMonth,
    totalCallsWeek,
    activeConversations,
    appointmentsToday,
    totalContacts,
    conversationsByDay,
    recentConversations,
    storageQuota,
    subscriptionRow,
  ] = await Promise.all([
    // Calls this month
    prisma.conversation.count({
      where: { tenantId, channelType: 'INBOUND', startedAt: { gte: startOfMonth } },
    }),
    // Calls this week
    prisma.conversation.count({
      where: { tenantId, channelType: 'INBOUND', startedAt: { gte: startOf7Days } },
    }),
    // Currently active (no endedAt)
    prisma.conversation.count({
      where: { tenantId, endedAt: null, status: 'OPEN' },
    }),
    // Appointments today
    prisma.appointment.count({
      where: {
        tenantId,
        startAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
        status: { not: 'CANCELED' },
      },
    }),
    // Total contacts
    prisma.contact.count({ where: { tenantId } }),
    // Conversations per day for last 7 days (all channel types)
    prisma.conversation.groupBy({
      by: ['startedAt'],
      where: { tenantId, startedAt: { gte: startOf7Days } },
      _count: { id: true },
    }),
    // Recent 5 conversations
    prisma.conversation.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true, channelType: true, status: true, startedAt: true,
        endedAt: true, summaryText: true, recordingStatus: true,
        contact: { select: { fullName: true, phoneE164: true } },
      },
    }),
    // Storage usage
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { storageUsedBytes: true, storageQuotaBytes: true },
    }),
    // Subscription
    prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
      select: { id: true, status: true, planId: true, plan: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Bucket conversations into day slots for the chart
  const dayMap: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    dayMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const row of conversationsByDay) {
    const key = row.startedAt.toISOString().slice(0, 10)
    if (key in dayMap) dayMap[key] = (dayMap[key] ?? 0) + row._count.id
  }
  const callChart = Object.entries(dayMap).map(([date, count]) => ({
    date,
    label: new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    calls: count,
  }))

  const usedBytes  = Number(storageQuota?.storageUsedBytes  ?? 0)
  const quotaBytes = Number(storageQuota?.storageQuotaBytes ?? 1073741824)
  const storagePct = Math.min(100, Math.round(usedBytes / quotaBytes * 100))

  res.json({
    data: {
      kpi: {
        callsThisMonth: totalCallsMonth,
        callsThisWeek: totalCallsWeek,
        activeNow: activeConversations,
        appointmentsToday,
        totalContacts,
      },
      callChart,
      recentConversations,
      storage: { usedBytes, quotaBytes, pct: storagePct },
      subscription: subscriptionRow
        ? { planName: subscriptionRow.plan.name, status: subscriptionRow.status }
        : null,
    },
  })
}))

export default router
