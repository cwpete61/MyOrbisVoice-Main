/**
 * GMB Evaluation service — OrbisVoice glue around the portable gmb-audit engine.
 *
 * Responsibilities that DON'T belong in the engine: fetching the Serper key from
 * SystemConfig, enforcing a per-partner monthly cap (bounds Serper spend), and
 * persisting results to the GmbEvaluation table.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { evaluate, SerperProvider, type AuditInput, type AuditResult } from './gmb-audit/index.js'
import { getSerperApiKey, getConfigValue } from './system-config.service.js'

const DEFAULT_MONTHLY_CAP = 100

async function monthlyCap(): Promise<number> {
  const raw = await getConfigValue('gmb_eval_monthly_cap')
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_CAP
}

/** Evaluations this partner has run in the trailing 30 days. */
export async function countRecentForPartner(partnerId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return prisma.gmbEvaluation.count({
    where: { partnerId, createdAt: { gte: since } },
  })
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
  const used = await countRecentForPartner(partnerId)
  if (used >= cap) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Monthly GMB Evaluation limit reached (${cap}). It resets on a rolling 30-day window.`,
      429,
    )
  }

  const auditInput: AuditInput = {
    businessName: input.businessName.trim(),
    city: input.city.trim(),
    website: input.website?.trim() || undefined,
    keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean),
  }

  const result: AuditResult = await evaluate(auditInput, new SerperProvider(apiKey))

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
