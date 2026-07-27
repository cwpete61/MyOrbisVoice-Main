// Agent Qualifier (MyOrbisAgents operator tooling).
//  • Public: an RE agent (INDIVIDUAL) or team/broker (TEAM) submits an intake form.
//  • Scoring: deterministic target-vs-result rubric (thresholds are ADJUSTABLE via
//    SystemConfig 'agent_qualifier_config'), producing a fit score + verdict +
//    per-metric breakdown. Applicants never see it.
//  • Operator: reviews (Targets view), accepts/rejects (overriding the verdict),
//    and on accept generates a full Proposal (plan + pricing + ROI + onboarding).
import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { getConfigValue, setConfigValue } from './system-config.service.js'
import { AppError } from '@voiceautomation/shared'

const CONFIG_KEY = 'agent_qualifier_config'

// Adjustable defaults (operator can override in the qualifier settings).
export const DEFAULT_CONFIG = {
  weights: { volume: 40, leads: 30, budget: 15, commitment: 15 },
  verdict: { qualified: 70, borderline: 50 },
  individual: { dealsLast12: 12, avgPriceUsd: 200000, monthlyLeads: 20, budgetMo: 97, timelineDays: 90 },
  team:       { seats: 5, teamDeals: 60, monthlyLeads: 50, budgetMo: 385 },
  pricing: {
    setup: 250,
    // Real MyOrbisAgents plans. Annual = 50% off, LOCKED FOR LIFE (annual billing only).
    plans: {
      capture: { name: 'Solo Capture', monthly: 297, annual: 2282 },
      power:   { name: 'Solo Power',   monthly: 497, annual: 3482 },
    },
    teamSeat: [ { min: 100, price: 57 }, { min: 25, price: 67 }, { min: 5, price: 77 } ], // highest-min first
    gciPct: 2.5,       // commission % of sale price
    closeRate: 0.2,    // recovered-call → deal conversion for the ROI projection
    missedShare: 0.35, // share of monthly leads currently missed (after-hours/busy)
  },
  demo: { basicDemoUrl: 'https://myorbisagents.com/', demoNumber: '' },
} as const

export type QualifierConfig = typeof DEFAULT_CONFIG

export async function getConfig(): Promise<QualifierConfig> {
  const raw = await getConfigValue(CONFIG_KEY)
  if (!raw) return DEFAULT_CONFIG
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } } catch { return DEFAULT_CONFIG }
}
export async function saveConfig(cfg: Partial<QualifierConfig>, byUserId: string): Promise<QualifierConfig> {
  const merged = { ...DEFAULT_CONFIG, ...cfg }
  await setConfigValue(CONFIG_KEY, JSON.stringify(merged), false, byUserId)
  return merged
}

type Metrics = Record<string, unknown>
const num = (m: Metrics, k: string) => { const v = Number(m[k]); return Number.isFinite(v) ? v : 0 }
const bool = (m: Metrics, k: string) => m[k] === true || m[k] === 'true' || m[k] === 'yes'

export interface ScoreRow { label: string; target: string; result: string; pass: boolean }
export interface ScoreResult { score: number; verdict: 'QUALIFIED' | 'BORDERLINE' | 'PASS'; rows: ScoreRow[]; recommendedTier: string }

// Ratio helper: result/target capped at 1, times the weight.
const pts = (result: number, target: number, weight: number) =>
  Math.round(Math.max(0, Math.min(1, target > 0 ? result / target : 0)) * weight)

export function scoreApplication(type: string, m: Metrics, cfg: QualifierConfig): ScoreResult {
  const w = cfg.weights
  const rows: ScoreRow[] = []
  let score = 0

  if (type === 'TEAM') {
    const t = cfg.team
    const deals = num(m, 'teamDeals'); const leads = num(m, 'monthlyLeads'); const seats = num(m, 'seats')
    const budget = num(m, 'budgetMo'); const dm = bool(m, 'decisionMaker'); const office = bool(m, 'deployOfficeWide')
    const volPts = pts(deals, t.teamDeals, w.volume); score += volPts
    const leadPts = pts(leads, t.monthlyLeads, w.leads); score += leadPts
    const budgetPts = budget >= t.budgetMo ? w.budget : pts(budget, t.budgetMo, w.budget); score += budgetPts
    const commitPts = (dm ? w.commitment / 2 : 0) + (office ? w.commitment / 2 : 0); score += Math.round(commitPts)
    rows.push({ label: 'Team deals / yr', target: `≥ ${t.teamDeals}`, result: String(deals), pass: deals >= t.teamDeals })
    rows.push({ label: 'Seats', target: `≥ ${t.seats}`, result: String(seats), pass: seats >= t.seats })
    rows.push({ label: 'Monthly leads', target: `≥ ${t.monthlyLeads}`, result: String(leads), pass: leads >= t.monthlyLeads })
    rows.push({ label: 'Budget / mo', target: `≥ $${t.budgetMo}`, result: `$${budget}`, pass: budget >= t.budgetMo })
    rows.push({ label: 'Decision-maker', target: 'yes', result: dm ? 'yes' : 'no', pass: dm })
    rows.push({ label: 'Deploy office-wide', target: 'yes', result: office ? 'yes' : 'no', pass: office })
  } else {
    const t = cfg.individual
    const deals = num(m, 'dealsLast12'); const avg = num(m, 'avgPriceUsd'); const leads = num(m, 'monthlyLeads')
    const budget = num(m, 'budgetMo'); const timeline = num(m, 'timelineDays'); const missing = bool(m, 'missingAfterHours')
    const volPts = pts(deals, t.dealsLast12, w.volume); score += volPts
    const leadPts = pts(leads, t.monthlyLeads, w.leads); score += leadPts
    const budgetPts = budget >= t.budgetMo ? w.budget : pts(budget, t.budgetMo, w.budget); score += budgetPts
    const commitPts = (missing ? w.commitment / 2 : 0) + (timeline > 0 && timeline <= t.timelineDays ? w.commitment / 2 : 0); score += Math.round(commitPts)
    rows.push({ label: 'Deals / 12 mo', target: `≥ ${t.dealsLast12}`, result: String(deals), pass: deals >= t.dealsLast12 })
    rows.push({ label: 'Avg sale price', target: `≥ $${t.avgPriceUsd.toLocaleString()}`, result: `$${avg.toLocaleString()}`, pass: avg >= t.avgPriceUsd })
    rows.push({ label: 'Monthly leads', target: `≥ ${t.monthlyLeads}`, result: String(leads), pass: leads >= t.monthlyLeads })
    rows.push({ label: 'Budget / mo', target: `≥ $${t.budgetMo}`, result: `$${budget}`, pass: budget >= t.budgetMo })
    rows.push({ label: 'Missing after-hours calls', target: 'yes', result: missing ? 'yes' : 'no', pass: missing })
    rows.push({ label: 'Start within', target: `≤ ${t.timelineDays}d`, result: timeline ? `${timeline}d` : '—', pass: timeline > 0 && timeline <= t.timelineDays })
  }

  score = Math.max(0, Math.min(100, score))
  const verdict = score >= cfg.verdict.qualified ? 'QUALIFIED' : score >= cfg.verdict.borderline ? 'BORDERLINE' : 'PASS'
  const avg = num(m, 'avgPriceUsd'); const deals = num(m, type === 'TEAM' ? 'teamDeals' : 'dealsLast12')
  const recommendedTier = type === 'TEAM' ? 'Team' : (avg >= 750000 || deals >= 20 ? 'Solo Power' : 'Solo Capture')
  return { score, verdict, rows, recommendedTier }
}

export async function submitApplication(input: { type: string; fullName: string; email: string; phone?: string; market?: string; metrics: Metrics }) {
  const cfg = await getConfig()
  const type = input.type === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'
  const s = scoreApplication(type, input.metrics, cfg)
  return prisma.agentApplication.create({
    data: {
      type, fullName: input.fullName, email: input.email, phone: input.phone ?? null, market: input.market ?? null,
      metricsJson: input.metrics as object, score: s.score, verdict: s.verdict,
      scoreJson: { rows: s.rows, recommendedTier: s.recommendedTier } as object,
    },
    select: { id: true },
  })
}

export async function listApplications(filter?: { status?: string; verdict?: string }) {
  return prisma.agentApplication.findMany({
    where: { ...(filter?.status ? { status: filter.status } : {}), ...(filter?.verdict ? { verdict: filter.verdict } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { proposal: { select: { id: true, status: true } } },
  })
}

export async function decideApplication(id: string, status: 'ACCEPTED' | 'REJECTED', byUserId: string, notes?: string) {
  return prisma.agentApplication.update({
    where: { id },
    data: { status, decidedById: byUserId, decidedAt: new Date(), ...(notes !== undefined ? { notes } : {}) },
  })
}

function perSeatFor(seats: number, cfg: QualifierConfig): number {
  for (const tier of cfg.pricing.teamSeat) if (seats >= tier.min) return tier.price
  return cfg.pricing.teamSeat[cfg.pricing.teamSeat.length - 1]!.price
}

export async function generateProposal(applicationId: string, byUserId: string) {
  const app = await prisma.agentApplication.findUnique({ where: { id: applicationId } })
  if (!app) throw new AppError('NOT_FOUND', 'Application not found', 404)
  const cfg = await getConfig()
  const m = app.metricsJson as Metrics
  const isTeam = app.type === 'TEAM'
  const firstName = (app.fullName || 'there').split(/\s+/)[0]

  // Recommended plan + pricing (real MyOrbisAgents plans; annual = 50% off for life).
  const avg = num(m, 'avgPriceUsd') || (isTeam ? 400000 : 300000)
  const dealsForTier = num(m, isTeam ? 'teamDeals' : 'dealsLast12')
  let tier: string
  let pricing: Record<string, unknown>
  if (isTeam) {
    const seats = Math.max(1, num(m, 'seats'))
    const perSeat = perSeatFor(seats, cfg)
    tier = 'Team'
    pricing = { plan: 'Team', seats, perSeat, monthly: seats * perSeat, annual: null, setup: cfg.pricing.setup }
  } else {
    const p = (avg >= 750000 || dealsForTier >= 20) ? cfg.pricing.plans.power : cfg.pricing.plans.capture
    tier = p.name
    pricing = { plan: p.name, monthly: p.monthly, annual: p.annual, setup: cfg.pricing.setup }
  }

  // ROI — per-deal payback, the credible framing (avoid a hype monthly number).
  const leads = num(m, 'monthlyLeads')
  const missedCallsMo = Math.max(1, Math.round(leads * cfg.pricing.missedShare))
  const commissionPerDeal = Math.round(avg * (cfg.pricing.gciPct / 100))
  const annualCost = typeof pricing['annual'] === 'number' ? (pricing['annual'] as number) : (pricing['monthly'] as number) * 12
  const roi = { avgPrice: avg, gciPct: cfg.pricing.gciPct, commissionPerDeal, missedCallsMo, annualCost }

  const heading = 'Stop losing after-hours buyers on your listings'
  const intro = `${firstName}, you've done the hard part: active listings that pull in buyers. The leak is what happens when one calls and you're mid-showing, with family, or asleep. This is a plan to close that gap without adding a person to your payroll.`
  const whatOrby = [
    'Answers every listing call in seconds, 24/7, in English and Spanish',
    "Asks the buyer what they're after: budget, timeline, which property",
    'Books the showing straight onto your calendar',
    'Hands you a brief so you walk in knowing the buyer. You close.',
  ]
  const onboarding = [
    'Connect your phone number and import your listings',
    'Brand Orby to your voice, market, and hours (bilingual EN/ES)',
    'Go live in a day. Orby answers, qualifies, and books from call one.',
  ]
  const nextSteps = [
    'Lock your founding rate: complete setup and your plan.',
    'Custom demo: we tailor Orby to your listings, market, and voice, then walk you through her live.',
    'Live training: a 1:1 session so you and your team know exactly how she hands buyers off to you.',
    'Go live: Orby starts answering, usually within a day.',
  ]
  const links = { basicDemoUrl: cfg.demo.basicDemoUrl, demoNumber: cfg.demo.demoNumber, micrositeUrl: '' }
  const summary = `Recommended ${tier} for ${app.fullName}. One recovered deal (about $${commissionPerDeal.toLocaleString()} commission) covers Orby for well over a year.`

  const data = {
    tier,
    pricingJson: pricing as object,
    roiJson: roi as object,
    onboardingJson: onboarding as object,
    whatOrbyJson: whatOrby as object,
    nextStepsJson: nextSteps as object,
    linksJson: links as object,
    heading,
    intro,
    summary,
    status: 'DRAFT',
  }
  // Keep the shareable link stable across regenerations (fill it if missing).
  const existing = await prisma.agentProposal.findUnique({ where: { applicationId }, select: { publicToken: true } })
  const publicToken = existing?.publicToken ?? randomBytes(24).toString('hex')
  return prisma.agentProposal.upsert({
    where: { applicationId },
    update: { ...data, publicToken },
    create: { applicationId, createdById: byUserId, publicToken, ...data },
  })
}

// Public read-only view of a proposal by its shareable token (client-facing).
export async function getProposalByToken(token: string) {
  const p = await prisma.agentProposal.findUnique({
    where: { publicToken: token },
    include: { application: { select: { fullName: true, type: true, market: true } } },
  })
  if (!p) throw new AppError('NOT_FOUND', 'Proposal not found', 404)
  return p
}

export async function listProposals() {
  return prisma.agentProposal.findMany({
    orderBy: { createdAt: 'desc' },
    include: { application: { select: { fullName: true, email: true, type: true, market: true, score: true } } },
  })
}

export async function updateProposal(id: string, data: { tier?: string; pricingJson?: object; roiJson?: object; onboardingJson?: object; whatOrbyJson?: object; nextStepsJson?: object; linksJson?: object; heading?: string; intro?: string; summary?: string; status?: string }) {
  return prisma.agentProposal.update({ where: { id }, data })
}

// Bulk delete. Deleting an application cascades to its proposal (schema onDelete).
export async function deleteApplications(ids: string[]) {
  if (!ids.length) return { count: 0 }
  return prisma.agentApplication.deleteMany({ where: { id: { in: ids } } })
}
export async function deleteProposals(ids: string[]) {
  if (!ids.length) return { count: 0 }
  return prisma.agentProposal.deleteMany({ where: { id: { in: ids } } })
}

// Operator edits to an application (contact fields + a market note).
export async function updateApplication(id: string, data: { fullName?: string; email?: string; phone?: string; market?: string; notes?: string }) {
  return prisma.agentApplication.update({ where: { id }, data })
}
