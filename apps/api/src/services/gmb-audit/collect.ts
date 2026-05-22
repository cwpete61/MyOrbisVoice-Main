/**
 * Collector — gathers every data source into one {@link AuditData}, then hands
 * it to scoring. Serper lookup runs first (yields cid + website); reviews,
 * website analysis, and PageSpeed run in parallel after. Every source is
 * best-effort so a single failure degrades one category, not the whole audit.
 */
import type { AuditData, AuditInput } from './types.js'
import { SerperProvider, fetchSerperReviews } from './providers/serper.js'
import { analyzeWebsite } from './providers/website.js'
import { fetchPageSpeed } from './providers/pagespeed.js'
import { buildHeatMap } from './providers/heatmap.js'
import { analyzeCompetitors } from './providers/competitor.js'

export interface CollectKeys {
  serperApiKey: string
  pageSpeedApiKey?: string
}

function resolvePrimaryKeyword(input: AuditInput, category?: string): string {
  return input.keywords?.[0]?.trim() || category || input.businessName
}

export async function collect(input: AuditInput, keys: CollectKeys): Promise<AuditData> {
  const provider = new SerperProvider(keys.serperApiKey)
  const lookup = await provider.lookup(input)
  const biz = lookup.business
  const primaryKeyword = resolvePrimaryKeyword(input, biz?.category)
  const dataSources = ['serper']

  if (!lookup.found || !biz) {
    return {
      input,
      found: false,
      business: null,
      mapPack: lookup.mapPack,
      mapPackPosition: null,
      primaryKeyword,
      reviews: { fetched: false, count: 0, rating: 0, recencyDays: null, velocityPerMonth: null, ownerResponseRate: null, samples: [] },
      website: { attempted: false, reachable: false, finalUrl: null, https: false, pages: [], servicePageCount: 0, locationPageCount: 0, cityMentioned: false, hasSchema: false },
      pageSpeed: { fetched: false, performance: null, lcpSeconds: null, cls: null, inpMs: null, mobileFriendly: null },
      heatMap: null,
      competitorDetails: [],
      dataSources,
    }
  }

  // Parallel: reviews (by cid), website (homepage+key pages), PageSpeed (on site).
  const [reviews, website] = await Promise.all([
    biz.cid ? fetchSerperReviews(keys.serperApiKey, biz.cid) : Promise.resolve({
      fetched: false, count: biz.ratingCount ?? 0, rating: biz.rating ?? 0,
      recencyDays: null, velocityPerMonth: null, ownerResponseRate: null, samples: [],
    }),
    analyzeWebsite(biz.website, input.city),
  ])

  // PageSpeed needs the resolved final URL (after redirects), so run it after
  // the website fetch confirmed reachability.
  const psiTarget = website.reachable ? website.finalUrl ?? biz.website : biz.website
  const pageSpeed = website.reachable
    ? await fetchPageSpeed(psiTarget ?? undefined, keys.pageSpeedApiKey)
    : { fetched: false, performance: null, lcpSeconds: null, cls: null, inpMs: null, mobileFriendly: null }

  // Heat map (49 Serper calls for a 7×7) + 2-competitor analysis run in parallel
  // — both independent of the website/pagespeed work above.
  const [heatMap, competitorDetails] = await Promise.all([
    biz.cid && typeof biz.latitude === 'number' && typeof biz.longitude === 'number'
      ? buildHeatMap({ apiKey: keys.serperApiKey, keyword: primaryKeyword, lat: biz.latitude, lng: biz.longitude, cid: biz.cid, gridSize: 7 })
      : Promise.resolve(null),
    analyzeCompetitors({ apiKey: keys.serperApiKey, city: input.city, clientCid: biz.cid, mapPack: lookup.mapPack }),
  ])

  if (reviews.fetched) dataSources.push('serper-reviews')
  if (website.reachable) dataSources.push('website')
  if (pageSpeed.fetched) dataSources.push('pagespeed')
  if (heatMap?.fetched) dataSources.push('heatmap')
  if (competitorDetails.length) dataSources.push('competitors')

  return {
    input,
    found: true,
    business: biz,
    mapPack: lookup.mapPack,
    mapPackPosition: lookup.mapPackPosition,
    primaryKeyword,
    reviews,
    website,
    pageSpeed,
    heatMap,
    competitorDetails,
    dataSources,
  }
}
