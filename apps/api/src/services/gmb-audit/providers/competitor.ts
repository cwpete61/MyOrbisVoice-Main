/**
 * Two-competitor analysis. Picks the two strongest direct competitors from the
 * client's map pack (highest-ranked, excluding the client), then enriches each
 * via Serper /places (website, categories) + a website crawl (service/location
 * pages, schema). All Serper-cheap. Backlink/citation depth is deferred to the
 * paid tier (DataForSEO) — flagged honestly, never faked.
 */
import type { CompetitorDetail, GbpBusiness, MapPackEntry } from '../types.js'
import { analyzeWebsite } from './website.js'

const SERPER_BASE = 'https://google.serper.dev'

interface SerperPlace {
  title?: string; website?: string; type?: string; types?: string[]
  rating?: number; ratingCount?: number; cid?: string
}

async function placeDetail(apiKey: string, query: string): Promise<SerperPlace | null> {
  try {
    const res = await fetch(`${SERPER_BASE}/places`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'us' }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { places?: SerperPlace[] }
    return json.places?.[0] ?? null
  } catch {
    return null
  }
}

export interface CompetitorInput {
  apiKey: string
  city: string
  clientCid?: string
  mapPack: MapPackEntry[]
}

export async function analyzeCompetitors(input: CompetitorInput): Promise<CompetitorDetail[]> {
  // Strongest = highest-ranked entries that aren't the client.
  const rivals = input.mapPack
    .filter((m) => !input.clientCid || m.cid !== input.clientCid)
    .sort((a, b) => a.position - b.position)
    .slice(0, 2)

  const details = await Promise.all(
    rivals.map(async (rv): Promise<CompetitorDetail> => {
      const place = await placeDetail(input.apiKey, `${rv.title} ${input.city}`)
      const website = place?.website
      const site = website ? await analyzeWebsite(website, input.city) : null
      // /maps types[] (carried on the map-pack entry) is richer than /places.
      const types = rv.types && rv.types.length ? rv.types : place?.types ?? (place?.type ? [place.type] : [])
      return {
        name: rv.title,
        mapPackPosition: rv.position,
        rating: place?.rating ?? rv.rating ?? null,
        reviewCount: place?.ratingCount ?? rv.ratingCount ?? null,
        categoryCount: types.length,
        primaryCategory: types[0] ?? place?.type ?? null,
        website: website ?? null,
        servicePageCount: site?.servicePageCount ?? null,
        locationPageCount: site?.locationPageCount ?? null,
        hasSchema: site?.hasSchema ?? null,
      }
    }),
  )
  return details
}

/** Build the client-vs-competitors gap rows + a plain-English "who's beating
 *  you and why" line. Pure — no I/O. */
export function competitorGaps(client: GbpBusiness, clientServicePages: number | null, clientLocationPages: number | null, clientHasSchema: boolean, comps: CompetitorDetail[]) {
  const clientReviews = client.ratingCount ?? 0
  const clientRating = client.rating ?? 0
  const clientCats = client.types?.length ?? (client.category ? 1 : 0)
  // Strongest rival = lowest map-pack position.
  const leader = [...comps].sort((a, b) => a.mapPackPosition - b.mapPackPosition)[0]
  const reasons: string[] = []
  if (leader) {
    if ((leader.reviewCount ?? 0) > clientReviews * 1.3) reasons.push('reviews')
    if ((leader.categoryCount ?? 0) > clientCats) reasons.push('categories')
    if ((leader.servicePageCount ?? 0) > (clientServicePages ?? 0)) reasons.push('servicePages')
    if ((leader.locationPageCount ?? 0) > (clientLocationPages ?? 0)) reasons.push('geoPages')
    if (leader.hasSchema && !clientHasSchema) reasons.push('schema')
  }
  return {
    leaderName: leader?.name ?? null,
    reasons, // i18n keys for the "why" callout
    client: { reviews: clientReviews, rating: clientRating, categories: clientCats, servicePages: clientServicePages, locationPages: clientLocationPages, hasSchema: clientHasSchema },
  }
}
