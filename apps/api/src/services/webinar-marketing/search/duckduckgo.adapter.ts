/**
 * DuckDuckGo HTML scrape adapter — primary default search engine.
 *
 * Uses DuckDuckGo's HTML-only endpoint (html.duckduckgo.com/html/) which
 * has historically been the lightest-ToS path among the major engines —
 * no JS required, returns plain HTML, no captcha for low-volume + non-bot
 * patterns. We add a stealth UA + randomized delays anyway.
 *
 * Throws on HTTP errors. Caller is responsible for retry policy + audit log.
 */

import * as cheerio from 'cheerio'
import type { SearchProvider, SearchResult } from './types.js'
import { ProviderBlockedError } from './provider-state.js'

const ENDPOINT = 'https://html.duckduckgo.com/html/'

// Browser UAs rotated per call. DuckDuckGo doesn't gate on UA but the
// rotation gives us a fingerprint hedge against future tightening.
const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
]

function pickUa(): string {
  return UAS[Math.floor(Math.random() * UAS.length)]!
}

export class DuckDuckGoAdapter implements SearchProvider {
  readonly name = 'duckduckgo'

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query, kl: 'us-en' })
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': pickUa(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      body: params.toString(),
    })
    if (res.status === 429 || res.status === 403) {
      throw new ProviderBlockedError('duckduckgo', `rate-limit ${res.status}`, res.status)
    }
    if (!res.ok) {
      throw new Error(`duckduckgo HTTP ${res.status}`)
    }
    const html = await res.text()
    // DDG block patterns — anomaly/captcha pages don't return 4xx, they ship 200
    // with a body like "anomaly detected" or "unusual traffic". Sniff before
    // parsing so the state machine sees the block.
    if (
      /anomaly\s*detected|unusual\s*traffic|rate\s*limit|please\s*verify/i.test(html.slice(0, 4000))
    ) {
      throw new ProviderBlockedError('duckduckgo', 'anomaly/captcha page')
    }
    return parseResults(html, query).slice(0, limit)
  }
}

/**
 * DuckDuckGo HTML structure (stable as of 2026-05):
 *   .result__title > a.result__a       — title + href
 *   .result__snippet                   — snippet
 *   .result__url                       — display url (we use the href)
 *
 * Selectors are tested but DDG could change at any time. Failure here =
 * empty results, not a crash. Worker continues to next provider/query.
 */
function parseResults(html: string, query: string): SearchResult[] {
  const $ = cheerio.load(html)
  const out: SearchResult[] = []

  $('.result, .web-result').each((_i, el) => {
    const $el = $(el)
    const $link = $el.find('a.result__a').first()
    const url = $link.attr('href') ?? ''
    const title = $link.text().trim()
    const snippet = $el.find('.result__snippet').first().text().trim()
    if (!url || !title) return

    // DuckDuckGo sometimes returns urls wrapped through /l/?uddg=<encoded>
    const realUrl = unwrapDdgRedirect(url)
    if (!realUrl) return

    out.push({
      title,
      url: realUrl,
      snippet,
      provider: 'duckduckgo',
      query,
    })
  })

  return out
}

function unwrapDdgRedirect(href: string): string | null {
  try {
    if (href.startsWith('//')) href = 'https:' + href
    const u = new URL(href)
    if (u.pathname === '/l/' || u.hostname.endsWith('duckduckgo.com')) {
      const wrapped = u.searchParams.get('uddg')
      if (wrapped) return decodeURIComponent(wrapped)
    }
    return u.toString()
  } catch {
    return null
  }
}
