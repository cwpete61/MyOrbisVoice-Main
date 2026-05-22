/**
 * gmb-audit — portable Google Business Profile audit engine.
 *
 * Self-contained: NO coupling to OrbisVoice domain models or Prisma. The whole
 * directory lifts into MyOrbisLocal (Phase A — GBP + Category Audit) unchanged;
 * only a new provider is added behind {@link GbpDataProvider}.
 *
 * Language-neutral by design: scoring returns dimension KEYS + numeric PARAMS,
 * never prose. The web screen and the PDF render localized strings (en/es) from
 * those keys, so the bilingual rule is satisfied without the engine knowing any
 * language.
 */

/** What the partner types in. */
export interface AuditInput {
  businessName: string
  city: string
  website?: string
  /** Target keywords whose map-pack ranking the partner wants checked. The
   *  first one (or `<category> in <city>`) drives the headline map-pack score. */
  keywords?: string[]
}

/** A single business as returned by a provider (normalized from raw payload). */
export interface GbpBusiness {
  title: string
  address?: string
  phoneNumber?: string
  website?: string
  /** Primary category label. */
  category?: string
  /** Primary + secondary categories. */
  types?: string[]
  rating?: number
  ratingCount?: number
  openingHours?: Record<string, string>
  thumbnailUrl?: string
  /** Google customer id — stable handle for the listing. */
  cid?: string
}

/** One competitor row in the local map-pack for the niche search. */
export interface MapPackEntry {
  position: number
  title: string
  rating?: number
  ratingCount?: number
  cid?: string
}

/** Normalized output of a provider lookup. Prose-free. */
export interface GbpLookupResult {
  found: boolean
  business: GbpBusiness | null
  /** Map-pack for `<primary keyword> <city>`, ordered by position. */
  mapPack: MapPackEntry[]
  /** The prospect's own position in `mapPack`, or null if not present. */
  mapPackPosition: number | null
  /** Raw provider payloads, kept so a report re-renders without re-querying. */
  raw: {
    profile?: unknown
    maps?: unknown
  }
}

/** Pluggable data source. Serper.dev is the first impl; DataForSEO / Google
 *  Places / the real GBP API slot in later without touching scoring. */
export interface GbpDataProvider {
  readonly name: string
  lookup(input: AuditInput): Promise<GbpLookupResult>
}

export type GmbDimensionKey =
  | 'mapPack'
  | 'reviews'
  | 'completeness'
  | 'categories'
  | 'nap'
  | 'photos'

export type GmbSeverity = 'good' | 'warn' | 'critical'

/** One scored dimension. `params` carries the data the UI/PDF interpolate into
 *  a localized finding string keyed by `${key}.${severity}`. */
export interface DimensionScore {
  key: GmbDimensionKey
  /** 0–100. */
  score: number
  /** Relative weight in the overall score (weights across dimensions sum to 1). */
  weight: number
  severity: GmbSeverity
  params: Record<string, string | number>
}

/** The full audit. Stored as `GmbEvaluation.result` (jsonb). Prose-free. */
export interface AuditResult {
  found: boolean
  overallScore: number
  business: GbpBusiness | null
  mapPackPosition: number | null
  dimensions: DimensionScore[]
  /** Dimension keys ordered worst-first — the partner's ranked pitch hooks. */
  gaps: GmbDimensionKey[]
  /** Top map-pack competitors, for the comparison visual. */
  competitors: MapPackEntry[]
  /** Provider name + when produced, for the report footer. */
  meta: { provider: string; evaluatedAt: string; primaryKeyword: string }
}
