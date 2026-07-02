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

// Phase 2 (backlog #24) — free neighborhood context providers.
const CENSUS_GEO = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'
const CENSUS_ACS = 'https://api.census.gov/data/2022/acs/acs5'
const OVERPASS   = 'https://overpass-api.de/api/interpreter'
const FEMA_NFHL  = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query'
const SCORECARD  = 'https://api.data.gov/ed/collegescorecard/v1/schools'

// FEMA flood-zone code → plain, NEUTRAL description. Facts only — never
// "safe"/"dangerous" (Fair-Housing steering).
const FLOOD_ZONE_LABEL: Record<string, string> = {
  A: 'high-risk flood zone (1% annual chance)', AE: 'high-risk flood zone (1% annual chance)',
  AH: 'high-risk flood zone', AO: 'high-risk flood zone', AR: 'high-risk flood zone', A99: 'high-risk flood zone',
  V: 'high-risk coastal flood zone', VE: 'high-risk coastal flood zone',
  X: 'minimal flood risk (outside the 100-year floodplain)',
  'X (SHADED)': 'moderate flood risk (0.2% annual chance)',
  D: 'undetermined flood risk',
}

export interface Comp {
  address: string | null
  priceUsd: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  distanceMi: number | null
}
export interface Place { name: string; km: number }
export interface Neighborhood {
  populationTract: number | null       // residents in the listing's census tract
  medianHouseholdIncomeUsd: number | null
  floodZone: string | null             // FEMA zone code (raw)
  floodZoneLabel: string | null        // neutral plain-language label
  hospitals: Place[]                   // nearest named hospitals (OSM)
  schools: Place[]                     // nearest named schools (OSM)
  colleges: { name: string; city: string | null }[]  // College Scorecard (data.gov)
  providers: string[]                  // which sources actually returned data
}
export interface Enrichment {
  avmUsd: number | null
  avmLowUsd: number | null
  avmHighUsd: number | null
  comps: Comp[]
  compsProvider: string | null // 'rentcast' | null when no key
  neighborhood: Neighborhood | null
  source: string
  fetchedAt: string
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.asin(Math.sqrt(s)) * 10) / 10
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

/** Census: coords → tract FIPS → ACS5 population + median household income.
 *  Keyless (census_api_key appended when set, higher rate limits). Free. */
async function fetchCensus(lat: number, lng: number): Promise<{ population: number | null; medianIncome: number | null } | null> {
  try {
    // The ACS data API now REQUIRES a key ("Missing Key" otherwise). Free from
    // census.gov/data/key-signup.html → save as census_api_key in System
    // Settings. Without it we skip population/income (rest of enrichment still runs).
    const key = await getConfigValue('census_api_key')
    if (!key) return null
    const geoUrl = `${CENSUS_GEO}?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Census%20Tracts&format=json`
    const g = await fetch(geoUrl)
    if (!g.ok) return null
    const gj = (await g.json()) as any
    const tractRow = gj?.result?.geographies?.['Census Tracts']?.[0]
    if (!tractRow) return null
    const state = tractRow['STATE'], county = tractRow['COUNTY'], tract = tractRow['TRACT']
    if (!state || !county || !tract) return null
    const acsUrl = `${CENSUS_ACS}?get=B01003_001E,B19013_001E&for=tract:${tract}&in=state:${state}%20county:${county}&key=${key}`
    const a = await fetch(acsUrl)
    if (!a.ok) return null
    const aj = (await a.json()) as string[][]
    const row = aj?.[1]
    if (!row) return null
    const pop = parseInt(row[0]!, 10)
    const inc = parseInt(row[1]!, 10)
    return {
      population:  Number.isFinite(pop) && pop >= 0 ? pop : null,
      medianIncome: Number.isFinite(inc) && inc >= 0 ? inc : null, // Census uses negatives for null
    }
  } catch { return null }
}

/** OSM Overpass: nearest named hospitals (8km) + schools (3km). Free, no key. */
async function fetchOsmPois(lat: number, lng: number): Promise<{ hospitals: Place[]; schools: Place[] } | null> {
  try {
    const q = `[out:json][timeout:20];(` +
      `node["amenity"="hospital"](around:8000,${lat},${lng});way["amenity"="hospital"](around:8000,${lat},${lng});` +
      `node["amenity"="school"](around:3000,${lat},${lng});way["amenity"="school"](around:3000,${lat},${lng});` +
      `);out center 60;`
    // GET with ?data= + Accept:json. POST text/plain is rejected (406) by the
    // main endpoint; GET works and is cacheable.
    const r = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const d = (await r.json()) as { elements?: Array<{ type: string; tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }> }
    const hospitals: Place[] = [], schools: Place[] = []
    for (const el of d.elements ?? []) {
      const name = el.tags?.['name']; if (!name) continue
      const eLat = el.lat ?? el.center?.lat, eLng = el.lon ?? el.center?.lon
      if (eLat == null || eLng == null) continue
      const place = { name, km: haversineKm(lat, lng, eLat, eLng) }
      if (el.tags?.['amenity'] === 'hospital') hospitals.push(place)
      else if (el.tags?.['amenity'] === 'school') schools.push(place)
    }
    const near = (xs: Place[]) => {
      const seen = new Set<string>()
      return xs.sort((a, b) => a.km - b.km).filter(p => !seen.has(p.name) && seen.add(p.name)).slice(0, 3)
    }
    return { hospitals: near(hospitals), schools: near(schools) }
  } catch { return null }
}

/** FEMA NFHL: flood zone at the point. Free, no key. */
async function fetchFemaFlood(lat: number, lng: number): Promise<{ zone: string; label: string } | null> {
  try {
    const url = `${FEMA_NFHL}?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`
    const r = await fetch(url)
    if (!r.ok) return null
    const d = (await r.json()) as { features?: Array<{ attributes?: { FLD_ZONE?: string; ZONE_SUBTY?: string } }> }
    const zone = d.features?.[0]?.attributes?.FLD_ZONE
    if (!zone) return { zone: 'X', label: FLOOD_ZONE_LABEL['X']! } // no mapped zone = outside floodplain
    return { zone, label: FLOOD_ZONE_LABEL[zone] ?? `flood zone ${zone}` }
  } catch { return null }
}

/** College Scorecard (via data.gov key): colleges near the listing's ZIP. */
async function fetchColleges(address: string): Promise<{ name: string; city: string | null }[]> {
  try {
    const key = await getConfigValue('data_gov_api_key')
    if (!key) return []
    const zip = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1]
    if (!zip) return []
    const url = `${SCORECARD}?api_key=${key}&_fields=school.name,school.city&zip=${zip}&distance=15mi&school.operating=1&_per_page=4`
    const r = await fetch(url)
    if (!r.ok) return []
    const d = (await r.json()) as { results?: Array<Record<string, unknown>> }
    return (d.results ?? []).slice(0, 4).map(s => ({
      name: String(s['school.name'] ?? ''),
      city: (s['school.city'] as string) ?? null,
    })).filter(c => c.name)
  } catch { return [] }
}

/** All free neighborhood providers in parallel. Best-effort — any can be null. */
async function fetchNeighborhood(lat: number, lng: number, address: string): Promise<Neighborhood> {
  const [census, pois, flood, colleges] = await Promise.all([
    fetchCensus(lat, lng), fetchOsmPois(lat, lng), fetchFemaFlood(lat, lng), fetchColleges(address),
  ])
  const providers: string[] = []
  if (census)   providers.push('census')
  if (pois)     providers.push('osm')
  if (flood)    providers.push('fema')
  if (colleges.length) providers.push('collegescorecard')
  return {
    populationTract:          census?.population ?? null,
    medianHouseholdIncomeUsd: census?.medianIncome ?? null,
    floodZone:                flood?.zone ?? null,
    floodZoneLabel:           flood?.label ?? null,
    hospitals:                pois?.hospitals ?? [],
    schools:                  pois?.schools ?? [],
    colleges,
    providers,
  }
}

/**
 * Enrich a listing: geocode (cache lat/lng) + free neighborhood context
 * (Census population, OSM hospitals/schools, FEMA flood, College Scorecard) +
 * optional paid AVM/comps (RentCast, when includePaid). Cached on the Listing.
 * `force` bypasses the TTL.
 */
export async function enrichListing(tenantId: string, listingId: string, force = false, opts: { includePaid?: boolean } = {}): Promise<Enrichment> {
  const includePaid = opts.includePaid !== false // default true
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

  // Paid AVM/comps — only when includePaid (demo passes false to save quota).
  const rc = includePaid
    ? await fetchRentcast(listing.address, {
        propertyType: listing.propertyType, beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      })
    : null

  // Free neighborhood context — always, once we have coordinates.
  const neighborhood = lat != null && lng != null
    ? await fetchNeighborhood(lat, lng, listing.address)
    : null

  const enrichment: Enrichment = {
    avmUsd: rc?.avm ?? null,
    avmLowUsd: rc?.low ?? null,
    avmHighUsd: rc?.high ?? null,
    comps: rc?.comps ?? [],
    compsProvider: rc ? 'rentcast' : null,
    neighborhood,
    source: ['nominatim', rc ? 'rentcast' : null, ...(neighborhood?.providers ?? [])].filter(Boolean).join('+'),
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
