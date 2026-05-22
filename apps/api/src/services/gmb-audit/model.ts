/**
 * gmb-audit — the scored result model (V2). Language-neutral: categories and
 * issues are KEYS + numeric PARAMS; the web screen and PDF render localized
 * titles, findings, and fix steps. Time estimates are tiers, not prose.
 */
import type { CompetitorDetail, GbpBusiness, HeatMapData, MapPackEntry } from './types.js'

export type CategoryKey =
  | 'gbpFoundation'
  | 'categories'
  | 'reviews'
  | 'website'
  | 'geo'
  | 'topical'
  | 'citations'
  | 'links'
  | 'technical'

export type Severity = 'critical' | 'warn' | 'minor'

/** How much work a fix is. Rendered to a localized duration in the UI/PDF. */
export type TimeTier = 'quick' | 'medium' | 'project' | 'ongoing'

/** Whether a category was fully measured, partially measured, or could not be
 *  scored without data we don't have for a cold prospect. Deferred/needsConnect
 *  categories are shown honestly, never given a fabricated score. */
export type CategoryStatus = 'measured' | 'partial' | 'deferred' | 'needsConnect'

/** One detected problem. `key` resolves to a localized title + fix step;
 *  `timeTier` to a localized duration; `params` interpolate into the strings. */
export interface Issue {
  key: string
  category: CategoryKey
  severity: Severity
  timeTier: TimeTier
  params: Record<string, string | number>
}

export interface CategoryResult {
  key: CategoryKey
  /** 0..100. For deferred/needsConnect categories this is null (not 0). */
  score: number | null
  /** Benchmark a well-optimized local business should hit (0..100). */
  expected: number
  /** Share of the overall score (sums to 1 across measured/partial cats). */
  weight: number
  status: CategoryStatus
  issues: Issue[]
}

/** Category weights (your model) + the expected benchmark per category. */
export const CATEGORY_META: Record<
  CategoryKey,
  { weight: number; expected: number; status: CategoryStatus }
> = {
  gbpFoundation: { weight: 0.20, expected: 90, status: 'measured' },
  categories: { weight: 0.15, expected: 85, status: 'measured' },
  reviews: { weight: 0.15, expected: 85, status: 'measured' },
  website: { weight: 0.15, expected: 80, status: 'measured' },
  geo: { weight: 0.10, expected: 75, status: 'partial' },
  topical: { weight: 0.10, expected: 75, status: 'partial' },
  citations: { weight: 0.075, expected: 80, status: 'partial' },
  links: { weight: 0.05, expected: 70, status: 'deferred' },
  technical: { weight: 0.025, expected: 90, status: 'measured' },
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'gbpFoundation', 'categories', 'reviews', 'website',
  'geo', 'topical', 'citations', 'links', 'technical',
]

export interface AuditResult {
  /** Result schema version — lets the UI/PDF tell V2 evals from legacy V1 rows. */
  version: 2
  found: boolean
  /** 0..100, weighted across categories that produced a score. */
  overallScore: number
  business: GbpBusiness | null
  mapPackPosition: number | null
  categories: CategoryResult[]
  /** Cross-category issues, ranked worst-first — the partner's pitch hooks. */
  topGaps: Issue[]
  competitors: MapPackEntry[]
  /** Rank-grid heat map for the primary keyword (null if no coords). */
  heatMap: HeatMapData | null
  /** Enriched 2-competitor analysis for the scorecard. */
  competitorDetails: CompetitorDetail[]
  /** "Who's beating you and why" — leader name + reason keys + client metrics. */
  competitorGap: {
    leaderName: string | null
    reasons: string[]
    client: { reviews: number; rating: number; categories: number; servicePages: number | null; locationPages: number | null; hasSchema: boolean }
  } | null
  /** Headline numbers for the executive summary block. */
  summary: {
    overallScore: number
    top3Pct: number | null
    invisiblePct: number | null
    leaderName: string | null
    criticalCount: number
    fastWinCount: number
  }
  /** Estimated monthly revenue going to competitors because the business isn't
   *  in the top-3 across the grid. Heuristic from real visibility loss + default
   *  industry assumptions (transparent + labeled an estimate). Null w/o heat map. */
  revenue: {
    monthlyLost: number
    visibilityGapPct: number
    assumedSearches: number
    avgTicket: number
  } | null
  meta: {
    provider: string
    evaluatedAt: string
    primaryKeyword: string
    /** Data sources that contributed (e.g. serper, website, pagespeed). */
    dataSources: string[]
  }
}

export function severityRank(s: Severity): number {
  return s === 'critical' ? 0 : s === 'warn' ? 1 : 2
}
