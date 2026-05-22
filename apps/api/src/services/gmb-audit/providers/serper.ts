/**
 * Serper.dev implementation of {@link GbpDataProvider}.
 *
 * Two queries per lookup:
 *   1. /places  `<businessName> <city>`   → identify the prospect's listing
 *   2. /maps    `<primary keyword> <city>` → the local map-pack for ranking
 *
 * No OAuth — works on cold prospects. The API key is INJECTED (constructor arg),
 * never read here, so the engine stays decoupled from OrbisVoice's SystemConfig.
 */
import type {
  AuditInput,
  GbpBusiness,
  GbpDataProvider,
  GbpLookupResult,
  MapPackEntry,
  ReviewSample,
  ReviewsData,
} from '../types.js'

const SERPER_BASE = 'https://google.serper.dev'

interface SerperPlace {
  position?: number
  title?: string
  address?: string
  latitude?: number
  longitude?: number
  rating?: number
  ratingCount?: number
  type?: string
  types?: string[]
  website?: string
  phoneNumber?: string
  openingHours?: Record<string, string>
  thumbnailUrl?: string
  cid?: string
}

interface SerperResponse {
  places?: SerperPlace[]
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function toBusiness(p: SerperPlace): GbpBusiness {
  return {
    title: p.title ?? '',
    address: p.address,
    phoneNumber: p.phoneNumber,
    website: p.website,
    category: p.type,
    types: p.types,
    rating: p.rating,
    ratingCount: p.ratingCount,
    openingHours: p.openingHours,
    thumbnailUrl: p.thumbnailUrl,
    cid: p.cid,
  }
}

/** Fill empty fields of `base` from `extra` (richer /maps record). Scalars on
 *  base win when present; arrays/objects fill only when base lacks them. */
function mergeBusiness(base: GbpBusiness, extra: GbpBusiness): GbpBusiness {
  return {
    title: base.title || extra.title,
    address: base.address ?? extra.address,
    phoneNumber: base.phoneNumber ?? extra.phoneNumber,
    website: base.website ?? extra.website,
    category: base.category ?? extra.category,
    types: base.types && base.types.length > 0 ? base.types : extra.types,
    rating: base.rating ?? extra.rating,
    ratingCount: base.ratingCount ?? extra.ratingCount,
    openingHours:
      base.openingHours && Object.keys(base.openingHours).length > 0
        ? base.openingHours
        : extra.openingHours,
    thumbnailUrl: base.thumbnailUrl ?? extra.thumbnailUrl,
    cid: base.cid ?? extra.cid,
  }
}

function toEntry(p: SerperPlace, fallbackPos: number): MapPackEntry {
  return {
    position: p.position ?? fallbackPos,
    title: p.title ?? '',
    rating: p.rating,
    ratingCount: p.ratingCount,
    cid: p.cid,
  }
}

interface SerperReview {
  rating?: number
  snippet?: string
  isoDate?: string
  date?: string
  response?: { snippet?: string } | null
}

/** Fetch a page of Google reviews for a listing (by cid) and derive recency,
 *  velocity, owner-response rate, and a few text samples. Best-effort: returns
 *  fetched=false on any failure so scoring degrades gracefully. */
export async function fetchSerperReviews(apiKey: string, cid: string): Promise<ReviewsData> {
  const empty: ReviewsData = {
    fetched: false, count: 0, rating: 0, recencyDays: null,
    velocityPerMonth: null, ownerResponseRate: null, samples: [],
  }
  if (!apiKey || !cid) return empty
  try {
    const res = await fetch(`${SERPER_BASE}/reviews`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid, gl: 'us' }),
    })
    if (!res.ok) return empty
    const json = (await res.json()) as { reviews?: SerperReview[]; rating?: number; ratingCount?: number }
    const reviews = json.reviews ?? []
    if (reviews.length === 0) return { ...empty, fetched: true }

    const dates = reviews
      .map((r) => (r.isoDate ? Date.parse(r.isoDate) : NaN))
      .filter((n) => Number.isFinite(n)) as number[]
    const now = Date.now()
    const newest = dates.length ? Math.max(...dates) : null
    const oldest = dates.length ? Math.min(...dates) : null
    const recencyDays = newest ? Math.floor((now - newest) / 86_400_000) : null
    // velocity: sampled reviews spread across the sampled window.
    let velocityPerMonth: number | null = null
    if (newest && oldest && newest > oldest) {
      const spanMonths = (newest - oldest) / (86_400_000 * 30.4)
      if (spanMonths > 0) velocityPerMonth = Math.round((dates.length / spanMonths) * 10) / 10
    }
    const withResp = reviews.filter((r) => r.response && r.response.snippet).length
    const ownerResponseRate = Math.round((withResp / reviews.length) * 100) / 100

    const samples: ReviewSample[] = reviews.slice(0, 5).map((r) => ({
      rating: r.rating,
      text: r.snippet,
      isoDate: r.isoDate,
      hasOwnerResponse: Boolean(r.response && r.response.snippet),
    }))

    return {
      fetched: true,
      count: json.ratingCount ?? reviews.length,
      rating: json.rating ?? 0,
      recencyDays,
      velocityPerMonth,
      ownerResponseRate,
      samples,
    }
  } catch {
    return empty
  }
}

export class SerperProvider implements GbpDataProvider {
  readonly name = 'serper.dev'
  private readonly apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('SerperProvider requires an API key')
    this.apiKey = apiKey
  }

  private async query(endpoint: 'places' | 'maps', q: string): Promise<SerperResponse> {
    const res = await fetch(`${SERPER_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, gl: 'us' }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Serper ${endpoint} ${res.status}: ${detail.slice(0, 200)}`)
    }
    return (await res.json()) as SerperResponse
  }

  /** Pick the prospect from a places result: prefer exact normalized-title match,
   *  else the first result. */
  private matchProspect(places: SerperPlace[], businessName: string): SerperPlace | null {
    if (places.length === 0) return null
    const target = normalize(businessName)
    const exact = places.find((p) => p.title && normalize(p.title) === target)
    if (exact) return exact
    const partial = places.find((p) => p.title && normalize(p.title).includes(target))
    return partial ?? places[0]!
  }

  async lookup(input: AuditInput): Promise<GbpLookupResult> {
    const placesResp = await this.query('places', `${input.businessName} ${input.city}`)
    const prospect = this.matchProspect(placesResp.places ?? [], input.businessName)

    if (!prospect) {
      return {
        found: false,
        business: null,
        mapPack: [],
        mapPackPosition: null,
        raw: { profile: placesResp },
      }
    }

    let business = toBusiness(prospect)

    // Headline keyword: partner's first keyword, else the listing's category, else name.
    const primaryKeyword =
      input.keywords?.[0]?.trim() ||
      (business.category ? `${business.category}` : input.businessName)

    const mapsResp = await this.query('maps', `${primaryKeyword} in ${input.city}`)
    const mapPlaces = mapsResp.places ?? []
    const mapPack: MapPackEntry[] = mapPlaces.map((p, i) => toEntry(p, i + 1))

    // Locate the prospect in the pack: cid match first, then normalized title.
    let mapPackPosition: number | null = null
    const byCid = business.cid
      ? mapPlaces.find((p) => p.cid && p.cid === business.cid)
      : undefined
    const hit =
      byCid ??
      mapPlaces.find((p) => p.title && normalize(p.title) === normalize(business.title))
    if (hit?.position != null) mapPackPosition = hit.position

    // /places returns a leaner record than /maps (no types[], openingHours, or
    // thumbnailUrl). When the prospect is also in the map pack, enrich from that
    // richer record so categories/photos/hours score on real data, not absence.
    if (hit) business = mergeBusiness(business, toBusiness(hit))

    return {
      found: true,
      business,
      mapPack,
      mapPackPosition,
      raw: { profile: placesResp, maps: mapsResp },
    }
  }
}
