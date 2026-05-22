/**
 * V2 scoring — turns an {@link AuditData} into the language-neutral
 * {@link AuditResult}. Nine categories on your weighted model. Each detection
 * emits an {@link Issue} (key + severity + time-tier + params); the UI/PDF
 * render localized titles, fix steps, and durations. Categories we can't
 * measure for a cold prospect are marked deferred/partial with score=null —
 * never a fabricated number.
 */
import type { AuditData, MapPackEntry } from './types.js'
import {
  CATEGORY_META, CATEGORY_ORDER, severityRank,
  type AuditResult, type CategoryKey, type CategoryResult, type Issue, type Severity,
} from './model.js'

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!
}

function issue(category: CategoryKey, key: string, severity: Severity, timeTier: Issue['timeTier'], params: Issue['params'] = {}): Issue {
  return { category, key, severity, timeTier, params }
}

function cat(key: CategoryKey, score: number | null, issues: Issue[]): CategoryResult {
  return { key, score, expected: CATEGORY_META[key].expected, weight: CATEGORY_META[key].weight, status: CATEGORY_META[key].status, issues }
}

// ── Category scorers ─────────────────────────────────────────────────────────

function scoreGbpFoundation(d: AuditData): CategoryResult {
  const b = d.business!
  const issues: Issue[] = []
  const has = { website: !!b.website, phone: !!b.phoneNumber, hours: !!(b.openingHours && Object.keys(b.openingHours).length), address: !!b.address, photo: !!b.thumbnailUrl }
  if (!has.website) issues.push(issue('gbpFoundation', 'noWebsite', 'critical', 'quick'))
  if (!has.phone) issues.push(issue('gbpFoundation', 'noPhone', 'critical', 'quick'))
  if (!has.address) issues.push(issue('gbpFoundation', 'noAddress', 'warn', 'quick'))
  if (!has.hours) issues.push(issue('gbpFoundation', 'noHours', 'warn', 'quick'))
  if (!has.photo) issues.push(issue('gbpFoundation', 'noPhotos', 'warn', 'medium'))
  const present = Object.values(has).filter(Boolean).length
  return cat('gbpFoundation', Math.round((present / 5) * 100), issues)
}

function scoreCategories(d: AuditData): CategoryResult {
  const n = d.business!.types?.length ?? (d.business!.category ? 1 : 0)
  const issues: Issue[] = []
  let score: number
  if (n >= 4) score = 100
  else if (n === 3) score = 85
  else if (n === 2) score = 65
  else if (n === 1) { score = 45; issues.push(issue('categories', 'fewCategories', 'warn', 'medium', { count: n })) }
  else { score = 0; issues.push(issue('categories', 'noCategory', 'critical', 'quick')) }
  if (n === 2 || n === 3) issues.push(issue('categories', 'addSecondary', 'minor', 'medium', { count: n }))
  return cat('categories', score, issues)
}

function scoreReviews(d: AuditData): CategoryResult {
  const r = d.reviews
  // The profile's ratingCount is the authoritative TOTAL; the /reviews endpoint
  // only returns a recent page, so never use its length as the volume.
  const count = d.business!.ratingCount || r.count || 0
  const rating = d.business!.rating || r.rating || 0
  const issues: Issue[] = []
  const compCounts = d.mapPack.map((c) => c.ratingCount ?? 0).filter((x) => x > 0)
  const compMedian = median(compCounts)

  // Volume: blend absolute strength (80+ reviews is strong on its own) with the
  // market-relative position, so a business with healthy volume isn't called
  // "weak" just for trailing one big competitor.
  const absScore = Math.min(count / 80, 1) * 100
  const relScore = compMedian > 0 ? Math.min(count / compMedian, 1.2) / 1.2 * 100 : count > 0 ? 80 : 0
  const volumeScore = absScore * 0.6 + relScore * 0.4
  // Flag low volume only when genuinely thin in absolute terms, not merely
  // behind a market leader.
  if (count < 30) {
    issues.push(issue('reviews', 'lowVolume', count < 10 ? 'critical' : 'warn', 'ongoing', { count, marketMedian: Math.round(compMedian) }))
  } else if (compMedian > 0 && count < compMedian * 0.5 && count < 80) {
    issues.push(issue('reviews', 'lowVolume', 'warn', 'ongoing', { count, marketMedian: Math.round(compMedian) }))
  }
  // Rating.
  const ratingScore = rating <= 0 ? 0 : Math.max(0, Math.min((rating - 3.0) / 1.7, 1)) * 100
  if (rating > 0 && rating < 4.0) issues.push(issue('reviews', 'lowRating', 'warn', 'ongoing', { rating }))
  // Recency / velocity (only when /reviews fetched).
  let recencyScore = 70
  if (r.fetched && r.recencyDays !== null) {
    recencyScore = r.recencyDays <= 30 ? 100 : r.recencyDays <= 90 ? 75 : r.recencyDays <= 180 ? 45 : 20
    if (r.recencyDays > 120) issues.push(issue('reviews', 'staleReviews', 'warn', 'ongoing', { days: r.recencyDays }))
  }
  if (r.fetched && r.velocityPerMonth !== null && r.velocityPerMonth < 1) {
    issues.push(issue('reviews', 'lowVelocity', 'warn', 'ongoing', { perMonth: r.velocityPerMonth }))
  }
  // Owner responses.
  let responseScore = 60
  if (r.fetched && r.ownerResponseRate !== null) {
    responseScore = r.ownerResponseRate >= 0.5 ? 100 : r.ownerResponseRate >= 0.2 ? 70 : 30
    if (r.ownerResponseRate < 0.2) issues.push(issue('reviews', 'noResponses', 'minor', 'medium', { pct: Math.round(r.ownerResponseRate * 100) }))
  }
  const score = Math.round(volumeScore * 0.4 + ratingScore * 0.3 + recencyScore * 0.2 + responseScore * 0.1)
  return cat('reviews', score, issues)
}

function scoreWebsite(d: AuditData): CategoryResult {
  const w = d.website
  const issues: Issue[] = []
  if (!w.attempted) {
    issues.push(issue('website', 'noWebsiteListed', 'critical', 'project'))
    return cat('website', 0, issues)
  }
  if (!w.reachable) {
    issues.push(issue('website', 'unreachable', 'critical', 'project'))
    return cat('website', 10, issues)
  }
  let score = 100
  const home = w.pages.find((p) => p.kind === 'home')
  if (!w.https) { score -= 25; issues.push(issue('website', 'noHttps', 'critical', 'quick')) }
  if (!(home?.napPhonePresent && home?.napAddressPresent)) { score -= 15; issues.push(issue('website', 'noNapOnSite', 'warn', 'quick')) }
  if (!home?.clickToCall) { score -= 8; issues.push(issue('website', 'noClickToCall', 'minor', 'quick')) }
  if (w.servicePageCount === 0) { score -= 20; issues.push(issue('website', 'noServicePages', 'warn', 'project')) }
  if (!home?.title || (home.title.length < 15)) { score -= 10; issues.push(issue('website', 'weakTitle', 'minor', 'quick')) }
  if (!home?.h1) { score -= 7; issues.push(issue('website', 'noH1', 'minor', 'quick')) }
  return cat('website', Math.max(0, score), issues)
}

function scoreGeo(d: AuditData): CategoryResult {
  const issues: Issue[] = []
  let score = 60
  const pos = d.mapPackPosition
  if (pos === null) { score = 20; issues.push(issue('geo', 'notInPack', 'critical', 'project', {})) }
  else if (pos > 3) { score = pos <= 6 ? 55 : 35; issues.push(issue('geo', 'outsideTop3', 'warn', 'project', { position: pos })) }
  else score = 90
  if (d.website.attempted && d.website.reachable) {
    if (!d.website.cityMentioned) { score -= 15; issues.push(issue('geo', 'cityNotMentioned', 'warn', 'medium', { city: d.input.city })) }
    if (d.website.locationPageCount === 0) { score -= 15; issues.push(issue('geo', 'noLocationPage', 'warn', 'project')) }
  }
  return cat('geo', Math.max(0, Math.min(100, score)), issues)
}

function scoreTopical(d: AuditData): CategoryResult {
  const w = d.website
  const issues: Issue[] = []
  if (!w.reachable) return cat('topical', null, [issue('topical', 'siteNeededForTopical', 'minor', 'project')])
  let score = 70
  if (w.servicePageCount === 0) { score -= 30; issues.push(issue('topical', 'noServiceContent', 'warn', 'project')) }
  else if (w.servicePageCount < 3) { score -= 10; issues.push(issue('topical', 'thinServiceCoverage', 'minor', 'project', { count: w.servicePageCount })) }
  const home = w.pages.find((p) => p.kind === 'home')
  if ((home?.wordCount ?? 0) < 300) { score -= 15; issues.push(issue('topical', 'thinContent', 'minor', 'medium')) }
  if (!w.pages.some((p) => p.hasFaqSchema)) { score -= 10; issues.push(issue('topical', 'noFaq', 'minor', 'medium')) }
  return cat('topical', Math.max(0, score), issues)
}

function scoreCitations(d: AuditData): CategoryResult {
  const issues: Issue[] = []
  // We can only check GBP↔website NAP consistency now. Full directory citation
  // audit is a deeper (paid) scan — flagged honestly, not scored.
  issues.push(issue('citations', 'fullCitationScanDeferred', 'minor', 'project'))
  if (!d.website.reachable) return cat('citations', null, issues)
  const home = d.website.pages.find((p) => p.kind === 'home')
  let score = 80
  if (!home?.napPhonePresent) { score -= 25; issues.push(issue('citations', 'phoneNotOnSite', 'warn', 'quick')) }
  if (!home?.napAddressPresent) { score -= 25; issues.push(issue('citations', 'addressNotOnSite', 'warn', 'quick')) }
  return cat('citations', Math.max(0, score), issues)
}

function scoreLinks(): CategoryResult {
  // Backlink/link-authority data needs a paid source we haven't wired. Shown
  // honestly as a deeper scan rather than guessed.
  return cat('links', null, [issue('links', 'backlinkScanDeferred', 'minor', 'project')])
}

function scoreTechnical(d: AuditData): CategoryResult {
  const ps = d.pageSpeed
  const issues: Issue[] = []
  if (!d.website.reachable) return cat('technical', null, [issue('technical', 'siteNeededForTechnical', 'minor', 'project')])
  let score = 80
  if (!d.website.hasSchema) { score -= 15; issues.push(issue('technical', 'noSchema', 'minor', 'medium')) }
  if (ps.fetched && ps.performance !== null) {
    score = Math.round(ps.performance * 0.7 + score * 0.3)
    if (ps.performance < 50) issues.push(issue('technical', 'slowSite', 'warn', 'project', { score: ps.performance }))
    if (ps.lcpSeconds !== null && ps.lcpSeconds > 4) issues.push(issue('technical', 'poorLcp', 'warn', 'project', { lcp: ps.lcpSeconds }))
    if (ps.cls !== null && ps.cls > 0.25) issues.push(issue('technical', 'layoutShift', 'minor', 'medium', { cls: ps.cls }))
    if (ps.mobileFriendly === false) issues.push(issue('technical', 'notMobileFriendly', 'warn', 'project'))
  }
  return cat('technical', Math.max(0, Math.min(100, score)), issues)
}

// ── Public entry ─────────────────────────────────────────────────────────────

export function scoreAudit(d: AuditData, providerName: string): AuditResult {
  if (!d.found || !d.business) {
    return {
      version: 2, found: false, overallScore: 0, business: null, mapPackPosition: null,
      categories: [], topGaps: [], competitors: [],
      meta: { provider: providerName, evaluatedAt: new Date().toISOString(), primaryKeyword: d.primaryKeyword, dataSources: d.dataSources },
    }
  }

  const byKey: Record<CategoryKey, CategoryResult> = {
    gbpFoundation: scoreGbpFoundation(d),
    categories: scoreCategories(d),
    reviews: scoreReviews(d),
    website: scoreWebsite(d),
    geo: scoreGeo(d),
    topical: scoreTopical(d),
    citations: scoreCitations(d),
    links: scoreLinks(),
    technical: scoreTechnical(d),
  }
  const categories = CATEGORY_ORDER.map((k) => byKey[k])

  // Overall = weighted avg over categories that produced a score, renormalized.
  const scored = categories.filter((c) => c.score !== null)
  const wsum = scored.reduce((s, c) => s + c.weight, 0)
  const overallScore = wsum > 0
    ? Math.round(scored.reduce((s, c) => s + (c.score as number) * c.weight, 0) / wsum)
    : 0

  // Top gaps: all real issues, worst-first by severity then category weight.
  const topGaps = categories
    .flatMap((c) => c.issues)
    .filter((i) => i.severity !== 'minor' || i.key.endsWith('Deferred') === false)
    .filter((i) => !i.key.endsWith('Deferred') && !i.key.startsWith('siteNeeded'))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || CATEGORY_META[b.category].weight - CATEGORY_META[a.category].weight)
    .slice(0, 8)

  const competitors: MapPackEntry[] = d.mapPack.slice(0, 5)

  return {
    version: 2,
    found: true,
    overallScore,
    business: d.business,
    mapPackPosition: d.mapPackPosition,
    categories,
    topGaps,
    competitors,
    meta: { provider: providerName, evaluatedAt: new Date().toISOString(), primaryKeyword: d.primaryKeyword, dataSources: d.dataSources },
  }
}
