/**
 * Google HTML scrape adapter — OFF BY DEFAULT, ToS-restricted.
 *
 * Google's Terms of Service prohibit automated querying of Search.
 * Including this adapter in a list's `searchEngines` array is the
 * operator explicitly accepting the ToS risk + captcha risk + IP-ban
 * risk. Worker is rate-limited harder (15s minimum delay) when this
 * provider is selected.
 *
 * For production use, prefer the Bing API adapter or paid SerpAPI proxy.
 * This adapter exists so the operator can A/B test Google reach during
 * the discovery phase, with full eyes-open compliance acceptance.
 *
 * Behavior on captcha or empty result: returns []. Caller advances.
 */

import * as cheerio from 'cheerio'
import type { SearchProvider, SearchResult } from './types.js'
import { ProviderBlockedError } from './provider-state.js'

const ENDPOINT = 'https://www.google.com/search'

const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]

function pickUa(): string {
  return UAS[Math.floor(Math.random() * UAS.length)]!
}

export class GoogleScrapeAdapter implements SearchProvider {
  readonly name = 'google_scrape'

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      num: String(Math.min(limit, 30)),
      hl: 'en',
      gl: 'us',
      pws: '0', // disable personalization
    })
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: {
        'User-Agent': pickUa(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    // Captcha or block — Google returns 200 with a sorry-page or a 429.
    // Throw ProviderBlockedError so the state machine trips after N hits.
    if (res.status === 429 || res.status === 403) {
      throw new ProviderBlockedError('google_scrape', `rate-limit ${res.status}`, res.status)
    }
    if (!res.ok) {
      return []
    }
    const html = await res.text()
    if (
      html.includes('Our systems have detected unusual traffic') ||
      html.includes('id="captcha-form"') ||
      html.includes('/sorry/index') ||
      /unusual\s*traffic|automated\s*queries/i.test(html.slice(0, 4000))
    ) {
      throw new ProviderBlockedError('google_scrape', 'sorry-page / captcha-form')
    }
    return parseResults(html, query).slice(0, limit)
  }
}

/**
 * Google's SERP HTML is notoriously volatile. Selectors below target the
 * stable "a[href][data-ved]" wrapper used in plain-HTML results as of
 * mid-2026. If Google changes structure, return [] and the worker moves on.
 */
function parseResults(html: string, query: string): SearchResult[] {
  const $ = cheerio.load(html)
  const out: SearchResult[] = []

  // Each organic result is wrapped in a div with class containing "g".
  // Inside there's an <a><h3>title</h3></a> + a snippet div.
  $('div.g, div[data-snc]').each((_i, el) => {
    const $el = $(el)
    const $a = $el.find('a[href^="http"]').first()
    const url = $a.attr('href')
    if (!url || url.startsWith('https://www.google.com')) return
    const title = $el.find('h3').first().text().trim()
    if (!title) return
    // Snippet — Google moves this around; try a few selectors.
    const snippet =
      $el.find('div[data-content-feature], div[data-sncf]').first().text().trim() ||
      $el.find('span').last().text().trim()

    out.push({ title, url, snippet, provider: 'google_scrape', query })
  })

  return out
}
