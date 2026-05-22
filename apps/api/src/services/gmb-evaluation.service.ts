/**
 * GMB Evaluation service — OrbisVoice glue around the portable gmb-audit engine.
 *
 * Responsibilities that DON'T belong in the engine: fetching the Serper key from
 * SystemConfig, enforcing a per-partner monthly cap (bounds Serper spend), and
 * persisting results to the GmbEvaluation table.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { evaluate, type AuditInput, type AuditResult } from './gmb-audit/index.js'
import { getSerperApiKey, getConfigValue } from './system-config.service.js'

const DEFAULT_MONTHLY_CAP = 30

async function monthlyCap(): Promise<number> {
  const raw = await getConfigValue('gmb_eval_monthly_cap')
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_CAP
}

/** The renewal date for a given year/month, anchored to `anchorDay`. If that
 *  day doesn't exist in the month (e.g. the 31st in February), the renewal
 *  rolls to the next available day — the 1st of the following month. */
function renewalOn(year: number, monthIdx: number, anchorDay: number): Date {
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate()
  if (anchorDay <= daysInMonth) return new Date(Date.UTC(year, monthIdx, anchorDay))
  return new Date(Date.UTC(year, monthIdx + 1, 1)) // next available day
}

/** First renewal strictly after `d`. Renewals across months form a monotonic
 *  sequence (overflow months roll to the 1st of the next), so scanning forward
 *  a few months and taking the first one past `d` is correct — and avoids
 *  skipping a real renewal that follows an overflow (e.g. Mar 1 → Mar 31). */
function nextRenewalAfter(d: Date, anchorDay: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  for (let i = 0; i < 4; i++) {
    const r = renewalOn(y, m + i, anchorDay) // Date.UTC rolls month/year past 11
    if (r.getTime() > d.getTime()) return r
  }
  return renewalOn(y, m + 4, anchorDay)
}

/** The current billing period [start, resetsAt) for a partner whose monthly
 *  cap renews on the anniversary of their first evaluation. */
export function currentPeriod(anchor: Date, now: Date): { start: Date; resetsAt: Date } {
  const anchorDay = anchor.getUTCDate()
  let y = now.getUTCFullYear()
  let m = now.getUTCMonth()
  let start = renewalOn(y, m, anchorDay)
  if (start.getTime() > now.getTime()) {
    // this month's renewal hasn't happened yet → the period began last month
    m -= 1
    if (m < 0) { m = 11; y -= 1 }
    start = renewalOn(y, m, anchorDay)
  }
  return { start, resetsAt: nextRenewalAfter(start, anchorDay) }
}

/** Evaluations this partner has run in the current monthly billing period,
 *  anchored to the anniversary of their first-ever evaluation. Counts every
 *  row in the window (a future delete must not free a slot — bounds spend). */
export async function countInCurrentPeriod(partnerId: string): Promise<{ used: number; resetsAt: Date | null }> {
  const first = await prisma.gmbEvaluation.findFirst({
    where: { partnerId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true },
  })
  if (!first) return { used: 0, resetsAt: null }
  const { start, resetsAt } = currentPeriod(first.createdAt, new Date())
  const used = await prisma.gmbEvaluation.count({ where: { partnerId, createdAt: { gte: start } } })
  return { used, resetsAt }
}

export interface RunEvaluationInput {
  businessName: string
  city: string
  website?: string
  keywords?: string[]
}

export async function runEvaluation(partnerId: string, input: RunEvaluationInput) {
  const apiKey = await getSerperApiKey()
  if (!apiKey) {
    throw new AppError(
      'NOT_CONFIGURED',
      'GMB Evaluation is not configured yet. An administrator must add the Serper.dev API key in System Settings.',
      503,
    )
  }

  const cap = await monthlyCap()
  const { used, resetsAt } = await countInCurrentPeriod(partnerId)
  if (used >= cap) {
    const when = resetsAt ? resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'next month'
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Monthly GMB Evaluation limit reached (${cap}). Your limit resets on ${when}.`,
      429,
    )
  }

  const auditInput: AuditInput = {
    businessName: input.businessName.trim(),
    city: input.city.trim(),
    website: input.website?.trim() || undefined,
    keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean),
  }

  // PageSpeed Insights is free; an optional key just lifts the rate limit.
  const pageSpeedApiKey =
    (await getConfigValue('pagespeed_api_key')) || process.env['PAGESPEED_API_KEY'] || undefined
  const result: AuditResult = await evaluate(auditInput, { serperApiKey: apiKey, pageSpeedApiKey })

  const row = await prisma.gmbEvaluation.create({
    data: {
      partnerId,
      businessName: auditInput.businessName,
      city: auditInput.city,
      website: auditInput.website,
      keywords: auditInput.keywords ?? [],
      overallScore: result.overallScore,
      // result is self-contained (business + dimensions + competitors), so the
      // report re-renders from it alone — no rawPayload needed. Prisma Json
      // columns accept plain objects; cast through unknown.
      result: result as unknown as object,
    },
  })

  return { id: row.id, createdAt: row.createdAt, result }
}

export async function listEvaluations(partnerId: string) {
  const rows = await prisma.gmbEvaluation.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      businessName: true,
      city: true,
      overallScore: true,
      createdAt: true,
    },
  })
  return rows
}

export async function getEvaluation(partnerId: string, id: string) {
  const row = await prisma.gmbEvaluation.findFirst({
    where: { id, partnerId },
  })
  if (!row) throw new AppError('NOT_FOUND', 'Evaluation not found', 404)
  return {
    id: row.id,
    businessName: row.businessName,
    city: row.city,
    website: row.website,
    keywords: row.keywords,
    overallScore: row.overallScore,
    createdAt: row.createdAt,
    result: row.result as unknown as AuditResult,
  }
}
