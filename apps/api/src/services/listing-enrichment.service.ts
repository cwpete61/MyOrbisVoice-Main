/**
 * MyOrbisAgents — listing enrichment (backlog #24, Phase 1). Geocode a listing's
 * address (Nominatim, free) then pull an AVM + comparable sales (RentCast, key
 * from System Settings). Result is cached on the Listing (enrichmentJson/enrichedAt)
 * and refreshed on a TTL. Never runs on the voice hot path.
 *
 * Fair Housing: this layer surfaces objective property/market facts only. Crime
 * and school-quality are deliberately NOT fetched here — see backlog #24. When
 * later providers (FEMA flood, POIs) are added, keep sensitive categories to
 * facts + a source link, never conclusions.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getConfigValue } from './system-config.service.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const RENTCAST = 'https://api.rentcast.io/v1'
const TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export interface Comp {
  address: string | null
  priceUsd: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  distanceMi: number | null
}
export interface Enrichment {
  avmUsd: number | null
  avmLowUsd: number | null
  avmHighUsd: number | null
  comps: Comp[]
  compsProvider: string | null // 'rentcast' | null when no key
  source: string
  fetchedAt: string
}

/** Geocode via Nominatim. Free, no key. Returns null on failure. */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOMINATIM}?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`
    const r = await fetch(url, { headers: { 'user-agent': 'MyOrbisAgents/1.0 (listings enrichment)' } })
    if (!r.ok) return null
    const data = (await r.json()) as Array<{ lat: string; lon: string }>
    const hit = data[0]
    if (!hit) return null
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
  } catch {
    return null
  }
}

/** RentCast AVM + comps. Null when no key configured or the call fails. */
async function fetchRentcast(
  address: string,
  opts: { propertyType?: string | null; beds?: number | null; baths?: number | null; sqft?: number | null },
): Promise<{ avm: Enrichment['avmUsd']; low: number | null; high: number | null; comps: Comp[] } | null> {
  const key = await getConfigValue('rentcast_api_key')
  if (!key) return null
  try {
    const params = new URLSearchParams({ address })
    if (opts.propertyType) params.set('propertyType', opts.propertyType)
    if (opts.beds != null) params.set('bedrooms', String(opts.beds))
    if (opts.baths != null) params.set('bathrooms', String(opts.baths))
    if (opts.sqft != null) params.set('squareFootage', String(opts.sqft))
    params.set('compCount', '5')
    const r = await fetch(`${RENTCAST}/avm/value?${params.toString()}`, {
      headers: { 'X-Api-Key': key, accept: 'application/json' },
    })
    if (!r.ok) { console.error('[enrichment] rentcast', r.status); return null }
    const d = (await r.json()) as {
      price?: number; priceRangeLow?: number; priceRangeHigh?: number
      comparables?: Array<{ formattedAddress?: string; price?: number; bedrooms?: number; bathrooms?: number; squareFootage?: number; distance?: number }>
    }
    const comps: Comp[] = (d.comparables ?? []).slice(0, 5).map((c) => ({
      address: c.formattedAddress ?? null,
      priceUsd: typeof c.price === 'number' ? Math.round(c.price) : null,
      beds: c.bedrooms ?? null,
      baths: c.bathrooms ?? null,
      sqft: c.squareFootage ?? null,
      distanceMi: typeof c.distance === 'number' ? Math.round(c.distance * 10) / 10 : null,
    }))
    return {
      avm: typeof d.price === 'number' ? Math.round(d.price) : null,
      low: typeof d.priceRangeLow === 'number' ? Math.round(d.priceRangeLow) : null,
      high: typeof d.priceRangeHigh === 'number' ? Math.round(d.priceRangeHigh) : null,
      comps,
    }
  } catch (e) {
    console.error('[enrichment] rentcast throw', e)
    return null
  }
}

/**
 * Enrich a listing: geocode (cache lat/lng) + AVM/comps → store enrichmentJson.
 * `force` bypasses the TTL. Returns the enrichment (possibly with null comps when
 * no RentCast key is set — geocoding still succeeds).
 */
export async function enrichListing(tenantId: string, listingId: string, force = false): Promise<Enrichment> {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, tenantId } })
  if (!listing) throw new AppError('NOT_FOUND', 'Listing not found', 404)

  // Serve cache within TTL unless forced.
  if (!force && listing.enrichedAt && Date.now() - listing.enrichedAt.getTime() < TTL_MS && listing.enrichmentJson) {
    return listing.enrichmentJson as unknown as Enrichment
  }

  // Geocode if we don't have coords yet.
  let lat = listing.lat, lng = listing.lng
  if (lat == null || lng == null) {
    const geo = await geocode(listing.address)
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  const rc = await fetchRentcast(listing.address, {
    propertyType: listing.propertyType, beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
  })

  const enrichment: Enrichment = {
    avmUsd: rc?.avm ?? null,
    avmLowUsd: rc?.low ?? null,
    avmHighUsd: rc?.high ?? null,
    comps: rc?.comps ?? [],
    compsProvider: rc ? 'rentcast' : null,
    source: 'nominatim+rentcast',
    fetchedAt: new Date().toISOString(),
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      ...(lat != null && lng != null ? { lat, lng } : {}),
      enrichmentJson: enrichment as unknown as object,
      enrichedAt: new Date(),
    },
  })
  return enrichment
}
