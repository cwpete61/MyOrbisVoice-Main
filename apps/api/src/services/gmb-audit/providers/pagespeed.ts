/**
 * Google PageSpeed Insights (free). Mobile strategy. Returns Lighthouse
 * performance + the three Core Web Vitals. Works without a key (rate-limited);
 * an optional key (from SystemConfig: pagespeed_api_key) lifts the limit.
 * Best-effort: fetched=false on any failure so technical scoring degrades.
 */
import type { PageSpeedData } from '../types.js'

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const TIMEOUT_MS = 25_000

interface PsiAudit { numericValue?: number; score?: number | null }
interface PsiResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } }
    audits?: Record<string, PsiAudit>
  }
}

export async function fetchPageSpeed(url: string | undefined, apiKey?: string): Promise<PageSpeedData> {
  const empty: PageSpeedData = {
    fetched: false, performance: null, lcpSeconds: null, cls: null, inpMs: null, mobileFriendly: null,
  }
  if (!url) return empty
  try {
    const params = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' })
    if (apiKey) params.set('key', apiKey)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${PSI}?${params.toString()}`, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
    if (!res.ok) return { ...empty, error: `psi ${res.status}` }
    const json = (await res.json()) as PsiResponse
    const lh = json.lighthouseResult
    if (!lh) return { ...empty, error: 'no lighthouse result' }
    const perfRaw = lh.categories?.performance?.score
    const performance = typeof perfRaw === 'number' ? Math.round(perfRaw * 100) : null
    const audits = lh.audits ?? {}
    const lcpMs = audits['largest-contentful-paint']?.numericValue
    const clsVal = audits['cumulative-layout-shift']?.numericValue
    const inpVal =
      audits['interaction-to-next-paint']?.numericValue ??
      audits['experimental-interaction-to-next-paint']?.numericValue
    return {
      fetched: true,
      performance,
      lcpSeconds: typeof lcpMs === 'number' ? Math.round((lcpMs / 1000) * 10) / 10 : null,
      cls: typeof clsVal === 'number' ? Math.round(clsVal * 1000) / 1000 : null,
      inpMs: typeof inpVal === 'number' ? Math.round(inpVal) : null,
      mobileFriendly: performance !== null ? performance >= 50 : null,
    }
  } catch {
    return empty
  }
}
