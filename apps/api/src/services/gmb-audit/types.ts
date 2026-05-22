/**
 * gmb-audit — raw data types the providers gather. Portable: no OrbisVoice or
 * Prisma coupling. The scoring layer (scoring.ts) turns an {@link AuditData}
 * into the language-neutral {@link AuditResult} in model.ts.
 */

/** What the partner types in. */
export interface AuditInput {
  businessName: string
  city: string
  website?: string
  /** Target keywords whose map-pack ranking the partner wants checked. The
   *  first one (or the listing's category) drives the headline map-pack score. */
  keywords?: string[]
}

/** A business as returned by Serper (normalized). */
export interface GbpBusiness {
  title: string
  address?: string
  phoneNumber?: string
  website?: string
  category?: string
  types?: string[]
  rating?: number
  ratingCount?: number
  openingHours?: Record<string, string>
  thumbnailUrl?: string
  cid?: string
  latitude?: number
  longitude?: number
}

/** One competitor row in the local map-pack for the niche search. */
export interface MapPackEntry {
  position: number
  title: string
  rating?: number
  ratingCount?: number
  cid?: string
  types?: string[]
}

/** Normalized output of the Serper places+maps lookup. */
export interface GbpLookupResult {
  found: boolean
  business: GbpBusiness | null
  mapPack: MapPackEntry[]
  mapPackPosition: number | null
  raw: { profile?: unknown; maps?: unknown }
}

/** Pluggable GBP data source (Serper today; GBP API later in connected mode). */
export interface GbpDataProvider {
  readonly name: string
  lookup(input: AuditInput): Promise<GbpLookupResult>
}

// ── Reviews (Serper /reviews) ────────────────────────────────────────────────

export interface ReviewSample {
  rating?: number
  text?: string
  isoDate?: string
  hasOwnerResponse: boolean
}

export interface ReviewsData {
  fetched: boolean
  count: number
  rating: number
  /** Days since the most recent review (null if unknown). */
  recencyDays: number | null
  /** Approx reviews/month over the sampled window (null if unknown). */
  velocityPerMonth: number | null
  /** Share 0..1 of sampled reviews with an owner response. */
  ownerResponseRate: number | null
  samples: ReviewSample[]
}

// ── Website (homepage + key pages) ───────────────────────────────────────────

export interface PageSignals {
  url: string
  kind: 'home' | 'service' | 'location' | 'contact' | 'other'
  status: number
  title: string | null
  h1: string | null
  hasJsonLdLocalBusiness: boolean
  hasJsonLdService: boolean
  hasFaqSchema: boolean
  napPhonePresent: boolean
  napAddressPresent: boolean
  clickToCall: boolean
  wordCount: number
}

export interface WebsiteData {
  attempted: boolean
  reachable: boolean
  finalUrl: string | null
  https: boolean
  pages: PageSignals[]
  /** Distinct internal links that look like service pages. */
  servicePageCount: number
  /** Distinct internal links that look like city/location/service-area pages. */
  locationPageCount: number
  /** City name appears in homepage title/H1/visible copy. */
  cityMentioned: boolean
  /** Any schema.org JSON-LD found anywhere. */
  hasSchema: boolean
  error?: string
}

// ── PageSpeed Insights (free) ────────────────────────────────────────────────

export interface PageSpeedData {
  fetched: boolean
  /** Lighthouse performance score 0..100 (mobile strategy). */
  performance: number | null
  /** Largest Contentful Paint, seconds. */
  lcpSeconds: number | null
  /** Cumulative Layout Shift. */
  cls: number | null
  /** Interaction to Next Paint, milliseconds. */
  inpMs: number | null
  mobileFriendly: boolean | null
  error?: string
}

// ── Heat map ─────────────────────────────────────────────────────────────────

export interface HeatMapPoint {
  row: number
  col: number
  lat: number
  lng: number
  /** 1..20, or null when the business isn't in the pack at that point. */
  rank: number | null
  bucket: 'green' | 'yellow' | 'orange' | 'red' | 'none'
}

export interface HeatMapData {
  fetched: boolean
  keyword: string
  gridSize: number
  spanMiles: number
  points: HeatMapPoint[]
  avgRank: number | null
  bestRank: number | null
  worstRank: number | null
  top3Pct: number
  top10Pct: number
  invisiblePct: number
}

// ── Competitors ──────────────────────────────────────────────────────────────

export interface CompetitorDetail {
  name: string
  mapPackPosition: number
  rating: number | null
  reviewCount: number | null
  categoryCount: number
  primaryCategory: string | null
  website: string | null
  servicePageCount: number | null
  locationPageCount: number | null
  hasSchema: boolean | null
}

/** Everything the collector gathers, pre-scoring. */
export interface AuditData {
  input: AuditInput
  found: boolean
  business: GbpBusiness | null
  mapPack: MapPackEntry[]
  mapPackPosition: number | null
  primaryKeyword: string
  reviews: ReviewsData
  website: WebsiteData
  pageSpeed: PageSpeedData
  heatMap: HeatMapData | null
  competitorDetails: CompetitorDetail[]
  /** Names of the data sources that actually contributed (for the report). */
  dataSources: string[]
}
