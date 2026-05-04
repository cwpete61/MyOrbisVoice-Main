import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const kpiPeriodSchema = z.object({
  period: z.enum(['7d', '30d']).default('7d'),
})

export type KpiPeriod = z.infer<typeof kpiPeriodSchema>['period']

export interface DashboardKpiResult {
  period: KpiPeriod
  rangeStart: string  // ISO
  rangeEnd: string    // ISO
  totalCalls: number
  missedCallRate: number  // 0-100, one decimal place
  inboundCalls: number    // denominator for the rate
  missedInboundCalls: number
  avgCallDurationSecs: number  // 0 if no completed calls
  appointmentsBooked: number
  followupEmailsSent: number
  topDispositions: Array<{ code: string; count: number }>
}

function rangeStartFor(period: KpiPeriod, now: Date): Date {
  const days = period === '30d' ? 30 : 7
  // Take a clean day boundary so the window is "the last N full days" inclusive of today.
  // 7d means: today + the previous 6 calendar days.
  const start = new Date(now)
  start.setDate(now.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Compute dashboard KPIs for a tenant over a 7d or 30d window.
 *
 * Aggregation is done in SQL via Prisma's count / aggregate / groupBy — we never
 * pull raw rows into JS. Avg call duration uses Prisma's `_avg` over an Int field
 * (recordingDurationSecs) rather than a raw SQL EXTRACT(EPOCH …) so the query stays
 * inside the ORM and Prisma's Decimal/null handling does the right thing for us.
 *
 * "Missed" inbound calls = ConversationStatus.ABANDONED on channelType=INBOUND. The
 * Conversation enum has no MISSED member; our Twilio inbound webhook maps Twilio's
 * `busy`/`no-answer` to ABANDONED (see twilio-inbound.service.ts).
 */
export async function getDashboardKpis(
  tenantId: string,
  period: KpiPeriod,
): Promise<DashboardKpiResult> {
  const now = new Date()
  const start = rangeStartFor(period, now)
  const periodFilter = { gte: start, lte: now }

  const baseWhere = { tenantId, startedAt: periodFilter }
  const inboundWhere = { ...baseWhere, channelType: 'INBOUND' as const }

  const [
    totalCalls,
    inboundCalls,
    missedInboundCalls,
    durationAgg,
    appointmentsBooked,
    followupEmailsSent,
    dispositionGroups,
  ] = await Promise.all([
    prisma.conversation.count({ where: baseWhere }),

    prisma.conversation.count({ where: inboundWhere }),

    prisma.conversation.count({
      where: { ...inboundWhere, status: 'ABANDONED' },
    }),

    // recordingDurationSecs is an Int — Prisma _avg returns a Decimal | null
    prisma.conversation.aggregate({
      where: { ...baseWhere, recordingDurationSecs: { not: null } },
      _avg: { recordingDurationSecs: true },
    }),

    prisma.appointment.count({
      where: { tenantId, createdAt: periodFilter },
    }),

    // Counted from MessageLog. Channel = EMAIL, direction = OUTBOUND covers any
    // outbound email written by either an agent action or a campaign step. Today
    // the Gmail send paths (appointment confirmation, missed-call follow-up,
    // manual conversation follow-up) do not write a MessageLog row, so this will
    // read 0 until those code paths are wired to log. The aggregation is correct;
    // the data feeding it is the gap. See report below.
    prisma.messageLog.count({
      where: {
        tenantId,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        createdAt: periodFilter,
      },
    }),

    prisma.conversation.groupBy({
      by: ['outcomeCode'],
      where: {
        ...baseWhere,
        outcomeCode: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { outcomeCode: 'desc' } },
      take: 3,
    }),
  ])

  const avgRaw = durationAgg._avg.recordingDurationSecs
  const avgCallDurationSecs =
    avgRaw == null ? 0 : Math.round(typeof avgRaw === 'number' ? avgRaw : (avgRaw as Prisma.Decimal).toNumber())

  const missedCallRate =
    inboundCalls === 0 ? 0 : Math.round((missedInboundCalls / inboundCalls) * 1000) / 10

  const topDispositions = dispositionGroups
    .filter((g) => g.outcomeCode != null)
    .map((g) => ({
      code: g.outcomeCode as string,
      count: g._count._all,
    }))

  return {
    period,
    rangeStart: start.toISOString(),
    rangeEnd: now.toISOString(),
    totalCalls,
    inboundCalls,
    missedInboundCalls,
    missedCallRate,
    avgCallDurationSecs,
    appointmentsBooked,
    followupEmailsSent,
    topDispositions,
  }
}
