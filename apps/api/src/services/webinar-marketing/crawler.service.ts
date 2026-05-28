/**
 * Webinar Marketing crawler — static HTML fetch + email extraction.
 *
 * Respectful by design:
 *   - Fetches robots.txt once per domain, caches result in memory.
 *   - Honors Disallow: for the user-agent we send.
 *   - Random 1.5-4s delay between requests to the SAME domain.
 *   - Hard cap of N pages per domain (per LeadList.maxPagesPerDomain).
 *   - 8-second per-request timeout. Big PDFs / video pages skipped.
 *   - No JS execution. No form submission. No cookie consent acceptance.
 *
 * Visits a fixed set of likely contact-page paths in priority order:
 *   /, /contact, /contact-us, /about, /appointments, /locations, /team
 *
 * Stops early when (a) maxPagesPerDomain hit, or (b) at least one email
 * has been extracted AND we've visited 3+ pages (most service-business
 * sites publish contact info on /contact or /about; over-crawling wastes
 * politeness budget).
 *
 * Playwright fallback for JS-only sites is Phase 2.5 — most service
 * businesses still ship server-rendered HTML, so cheerio + axios covers
 * 95% of the target audience.
 */

import * as cheerio from 'cheerio'
import robotsParser from 'robots-parser'
import { extractEmails, type ExtractedEmail } from './email-extractor.service.js'

const USER_AGENT = 'MyOrbisVoiceLeadDiscovery/1.0 (+https://myorbisvoice.com/bot)'
const FETCH_TIMEOUT_MS = 8_000
const CONTACT_PATHS = [
  '/',
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/appointments',
  '/locations',
  '/team',
  '/staff',
]

// Per-domain robots.txt cache. URL → parser instance.
type RobotsParser = ReturnType<typeof robotsParser>
const robotsCache = new Map<string, RobotsParser | 'fetch_failed' | 'no_robots'>()

export interface CrawlResult {
  domain: string
  pagesVisited: number
  emails: Array<ExtractedEmail & { sourceUrl: string; pageTitle: string | null }>
  robotsStatus: 'allowed' | 'disallowed' | 'no_robots' | 'fetch_failed'
  errors: string[]
}

export interface CrawlOptions {
  startUrl: string
  maxPagesPerDomain: number
  /** Already-known additional URLs to try beyond the standard contact paths. */
  hintUrls?: string[]
}

export async function crawlDomain(opts: CrawlOptions): Promise<CrawlResult> {
  const errors: string[] = []
  const emails: CrawlResult['emails'] = []
  let pagesVisited = 0

  let domain: string
  let origin: string
  try {
    const u = new URL(opts.startUrl)
    domain = u.hostname.toLowerCase()
    origin = `${u.protocol}//${u.hostname}`
  } catch (err) {
    return {
      domain: '',
      pagesVisited: 0,
      emails: [],
      robotsStatus: 'fetch_failed',
      errors: [`invalid start url: ${(err as Error).message}`],
    }
  }

  // 1. Robots check
  const robotsStatus = await fetchAndCheckRobots(origin)

  // Build the candidate URL list: original startUrl + contact-page patterns.
  // Dedup while preserving order. Hint URLs (from search snippets) inserted
  // after the homepage but before /contact-us so they take priority.
  const candidates = dedupOrdered([
    opts.startUrl,
    ...(opts.hintUrls ?? []).filter((u) => safeOrigin(u) === origin),
    ...CONTACT_PATHS.map((p) => origin + p),
  ])

  // 2. Crawl loop
  for (const url of candidates) {
    if (pagesVisited >= opts.maxPagesPerDomain) break
    // Politeness: 1.5-4s jitter between fetches to the same domain.
    if (pagesVisited > 0) await sleep(1_500 + Math.floor(Math.random() * 2_500))

    // robots check — when robots.txt explicitly disallows our UA on this
    // URL, skip it. We still continue to the next candidate (some paths
    // may be allowed even when others aren't).
    if (robotsStatus === 'allowed' || robotsStatus === 'no_robots' || robotsStatus === 'fetch_failed') {
      const robots = robotsCache.get(origin)
      if (robots && robots !== 'fetch_failed' && robots !== 'no_robots') {
        if (!robots.isAllowed(url, USER_AGENT)) {
          continue
        }
      }
    } else {
      // disallowed at the domain level — stop crawling.
      break
    }

    try {
      const { html, title } = await fetchPage(url)
      pagesVisited++
      const found = extractEmails(html)
      for (const e of found) {
        emails.push({ ...e, sourceUrl: url, pageTitle: title })
      }
      // Early-exit heuristic: at least one email + at least 3 pages tried.
      if (emails.length > 0 && pagesVisited >= 3) break
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`)
    }
  }

  return { domain, pagesVisited, emails, robotsStatus, errors }
}

// --- Helpers -----------------------------------------------------------------

async function fetchAndCheckRobots(
  origin: string,
): Promise<'allowed' | 'disallowed' | 'no_robots' | 'fetch_failed'> {
  if (robotsCache.has(origin)) {
    const cached = robotsCache.get(origin)!
    if (cached === 'fetch_failed') return 'fetch_failed'
    if (cached === 'no_robots') return 'no_robots'
    return cached.isAllowed(origin + '/', USER_AGENT) ? 'allowed' : 'disallowed'
  }
  const robotsUrl = origin + '/robots.txt'
  try {
    const res = await fetchWithTimeout(robotsUrl)
    if (res.status === 404) {
      robotsCache.set(origin, 'no_robots')
      return 'no_robots'
    }
    if (!res.ok) {
      robotsCache.set(origin, 'fetch_failed')
      return 'fetch_failed'
    }
    const body = await res.text()
    const parser = robotsParser(robotsUrl, body)
    robotsCache.set(origin, parser)
    return parser.isAllowed(origin + '/', USER_AGENT) ? 'allowed' : 'disallowed'
  } catch {
    robotsCache.set(origin, 'fetch_failed')
    return 'fetch_failed'
  }
}

async function fetchPage(url: string): Promise<{ html: string; title: string | null }> {
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.toLowerCase().includes('text/html')) {
    throw new Error(`non-html content-type: ${ct}`)
  }
  const html = await res.text()
  let title: string | null = null
  try {
    title = cheerio.load(html)('title').first().text().trim() || null
  } catch {
    title = null
  }
  return { html, title }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(t)
  }
}

function dedupOrdered(arr: string[]): string[] {
  const seen = new Set<string>()
  return arr.filter((s) => {
    if (seen.has(s)) return false
    seen.add(s)
    return true
  })
}

function safeOrigin(href: string): string | null {
  try {
    const u = new URL(href)
    return `${u.protocol}//${u.hostname}`
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
