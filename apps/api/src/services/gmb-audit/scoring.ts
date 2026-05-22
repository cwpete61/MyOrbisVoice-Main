/**
 * Pure scoring functions for the gmb-audit engine. No I/O, no network, no
 * Prisma — fully unit-testable and portable. Input is a normalized
 * {@link GbpLookupResult}; output is an {@link AuditResult}.
 */
import type {
  AuditResult,
  DimensionScore,
  GbpBusiness,
  GbpLookupResult,
  GmbDimensionKey,
  GmbSeverity,
  MapPackEntry,
} from './types.js'

/** Weights sum to 1.0. Map-pack is the headline; reviews + completeness next. */
const WEIGHTS: Record<GmbDimensionKey, number> = {
  mapPack: 0.3,
  reviews: 0.2,
  completeness: 0.2,
  categories: 0.15,
  nap: 0.1,
  photos: 0.05,
}

function severityFromScore(score: number): GmbSeverity {
  if (score >= 75) return 'good'
  if (score >= 45) return 'warn'
  return 'critical'
}

/** Median of a numeric list (0 for empty). */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

// ── Per-dimension scorers ────────────────────────────────────────────────────

function scoreMapPack(position: number | null, competitors: MapPackEntry[]): DimensionScore {
  let score: number
  if (position === null) score = 0
  else if (position === 1) score = 100
  else if (position === 2) score = 90
  else if (position === 3) score = 80
  else if (position <= 6) score = 50
  else if (position <= 10) score = 30
  else score = 15
  return {
    key: 'mapPack',
    score,
    weight: WEIGHTS.mapPack,
    severity: severityFromScore(score),
    params: {
      position: position ?? 0,
      inPack: position !== null && position <= 3 ? 1 : 0,
      competitorCount: competitors.length,
    },
  }
}

function scoreReviews(biz: GbpBusiness | null, competitors: MapPackEntry[]): DimensionScore {
  const rating = biz?.rating ?? 0
  const count = biz?.ratingCount ?? 0
  // Volume component vs the niche median (the bar to clear in this market).
  const compCounts = competitors.map((c) => c.ratingCount ?? 0).filter((n) => n > 0)
  const compMedian = median(compCounts)
  const volumeRatio = compMedian > 0 ? Math.min(count / compMedian, 1.5) : count > 0 ? 1 : 0
  const volumeScore = Math.min(volumeRatio / 1.5, 1) * 100 // 0..100, full at 1.5x median
  // Rating component: 4.7+ excellent, 4.0 mid, <3.5 poor.
  const ratingScore = rating <= 0 ? 0 : Math.max(0, Math.min((rating - 3.0) / 1.7, 1)) * 100
  const score = Math.round(volumeScore * 0.6 + ratingScore * 0.4)
  return {
    key: 'reviews',
    score,
    weight: WEIGHTS.reviews,
    severity: severityFromScore(score),
    params: { rating, count, marketMedian: Math.round(compMedian) },
  }
}

function scoreCompleteness(biz: GbpBusiness | null): DimensionScore {
  const checks = {
    website: Boolean(biz?.website),
    phone: Boolean(biz?.phoneNumber),
    hours: Boolean(biz?.openingHours && Object.keys(biz.openingHours).length > 0),
    category: Boolean(biz?.category),
    address: Boolean(biz?.address),
  }
  const present = Object.values(checks).filter(Boolean).length
  const total = Object.keys(checks).length
  const score = Math.round((present / total) * 100)
  return {
    key: 'completeness',
    score,
    weight: WEIGHTS.completeness,
    severity: severityFromScore(score),
    params: {
      present,
      total,
      missingWebsite: checks.website ? 0 : 1,
      missingPhone: checks.phone ? 0 : 1,
      missingHours: checks.hours ? 0 : 1,
    },
  }
}

function scoreCategories(biz: GbpBusiness | null): DimensionScore {
  const n = biz?.types?.length ?? (biz?.category ? 1 : 0)
  // A strong listing carries a primary + several relevant secondary categories.
  let score: number
  if (n >= 4) score = 100
  else if (n === 3) score = 85
  else if (n === 2) score = 65
  else if (n === 1) score = 45
  else score = 0
  return {
    key: 'categories',
    score,
    weight: WEIGHTS.categories,
    severity: severityFromScore(score),
    params: { count: n },
  }
}

function scoreNap(biz: GbpBusiness | null): DimensionScore {
  // Without a citation crawl this is presence + basic coherence only. v1 limit;
  // a real NAP-consistency check (BrightLocal-style) lands in MyOrbisLocal.
  const hasAddress = Boolean(biz?.address)
  const hasPhone = Boolean(biz?.phoneNumber)
  const hasName = Boolean(biz?.title)
  const present = [hasAddress, hasPhone, hasName].filter(Boolean).length
  const score = Math.round((present / 3) * 100)
  return {
    key: 'nap',
    score,
    weight: WEIGHTS.nap,
    severity: severityFromScore(score),
    params: { hasAddress: hasAddress ? 1 : 0, hasPhone: hasPhone ? 1 : 0 },
  }
}

function scorePhotos(biz: GbpBusiness | null): DimensionScore {
  // Serper exposes a thumbnail but not a photo count — presence-only signal.
  const hasPhoto = Boolean(biz?.thumbnailUrl)
  const score = hasPhoto ? 70 : 0
  return {
    key: 'photos',
    score,
    weight: WEIGHTS.photos,
    severity: severityFromScore(score),
    params: { hasPhoto: hasPhoto ? 1 : 0 },
  }
}

/**
 * Score a normalized lookup into a full {@link AuditResult}.
 * @param primaryKeyword the keyword that drove the map-pack search (for the report).
 */
export function scoreAudit(
  lookup: GbpLookupResult,
  providerName: string,
  primaryKeyword: string,
): AuditResult {
  const biz = lookup.business
  const competitors = lookup.mapPack

  const dimensions: DimensionScore[] = [
    scoreMapPack(lookup.mapPackPosition, competitors),
    scoreReviews(biz, competitors),
    scoreCompleteness(biz),
    scoreCategories(biz),
    scoreNap(biz),
    scorePhotos(biz),
  ]

  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  )

  // Gaps = dimensions worst-first (lowest weighted headroom drives the pitch).
  const gaps = [...dimensions]
    .sort((a, b) => a.score - b.score || b.weight - a.weight)
    .filter((d) => d.severity !== 'good')
    .map((d) => d.key)

  return {
    found: lookup.found,
    overallScore,
    business: biz,
    mapPackPosition: lookup.mapPackPosition,
    dimensions,
    gaps,
    competitors: competitors.slice(0, 5),
    meta: {
      provider: providerName,
      evaluatedAt: new Date().toISOString(),
      primaryKeyword,
    },
  }
}
