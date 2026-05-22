/**
 * Local rank-grid heat map. Builds an N×N grid of coordinates centered on the
 * business, queries Serper /maps at each point (Serper localizes by `ll` —
 * verified 2026-05-22), and records the business's rank (by cid) at each point.
 *
 * This is the standard grid method (Local Falcon / BrightLocal-style). One
 * Serper call per grid point: 7×7 = 49 calls (~$0.10). Points run in batches to
 * stay friendly to rate limits.
 */
import type { HeatMapData, HeatMapPoint } from '../types.js'

const SERPER_BASE = 'https://google.serper.dev'
const ZOOM = '13z'           // standardized so every point simulates the same radius
const BATCH = 8              // concurrent /maps calls
const POINT_TIMEOUT_MS = 12_000
const MILES_PER_DEG_LAT = 69

interface SerperMapsResp { places?: Array<{ position?: number; title?: string; cid?: string }> }

function bucket(rank: number | null): HeatMapPoint['bucket'] {
  if (rank === null) return 'none'
  if (rank <= 3) return 'green'
  if (rank <= 8) return 'yellow'
  if (rank <= 15) return 'orange'
  return 'red'
}

/** Build grid coordinates: N×N centered on (lat,lng) spanning `spanMiles`. */
function gridCoords(lat: number, lng: number, n: number, spanMiles: number): Array<{ lat: number; lng: number; row: number; col: number }> {
  const half = (n - 1) / 2
  const stepMiles = spanMiles / (n - 1)
  const dLat = stepMiles / MILES_PER_DEG_LAT
  const dLng = stepMiles / (MILES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const out: Array<{ lat: number; lng: number; row: number; col: number }> = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out.push({
        // row 0 = north (top), so subtract as row increases
        lat: lat + (half - r) * dLat,
        lng: lng + (c - half) * dLng,
        row: r,
        col: c,
      })
    }
  }
  return out
}

async function rankAt(apiKey: string, keyword: string, lat: number, lng: number, cid: string): Promise<number | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), POINT_TIMEOUT_MS)
    const res = await fetch(`${SERPER_BASE}/maps`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, ll: `@${lat.toFixed(5)},${lng.toFixed(5)},${ZOOM}`, gl: 'us' }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
    if (!res.ok) return null
    const json = (await res.json()) as SerperMapsResp
    const hit = (json.places ?? []).find((p) => p.cid && p.cid === cid)
    return hit?.position ?? null
  } catch {
    return null
  }
}

export interface HeatMapInput {
  apiKey: string
  keyword: string
  lat: number
  lng: number
  cid: string
  gridSize?: number   // default 7
  spanMiles?: number  // default 6
}

export async function buildHeatMap(input: HeatMapInput): Promise<HeatMapData> {
  const n = input.gridSize ?? 7
  const span = input.spanMiles ?? 6
  const coords = gridCoords(input.lat, input.lng, n, span)

  const points: HeatMapPoint[] = []
  for (let i = 0; i < coords.length; i += BATCH) {
    const slice = coords.slice(i, i + BATCH)
    const ranks = await Promise.all(slice.map((co) => rankAt(input.apiKey, input.keyword, co.lat, co.lng, input.cid)))
    slice.forEach((co, j) => {
      const rank = ranks[j]!
      points.push({ row: co.row, col: co.col, lat: co.lat, lng: co.lng, rank, bucket: bucket(rank) })
    })
  }

  const found = points.filter((p) => p.rank !== null).map((p) => p.rank as number)
  const total = points.length
  const top3 = points.filter((p) => p.rank !== null && p.rank <= 3).length
  const top10 = points.filter((p) => p.rank !== null && p.rank <= 10).length
  const invisible = points.filter((p) => p.rank === null).length

  return {
    fetched: true,
    keyword: input.keyword,
    gridSize: n,
    spanMiles: span,
    points,
    avgRank: found.length ? Math.round((found.reduce((s, r) => s + r, 0) / found.length) * 10) / 10 : null,
    bestRank: found.length ? Math.min(...found) : null,
    worstRank: found.length ? Math.max(...found) : null,
    top3Pct: Math.round((top3 / total) * 100),
    top10Pct: Math.round((top10 / total) * 100),
    invisiblePct: Math.round((invisible / total) * 100),
  }
}
