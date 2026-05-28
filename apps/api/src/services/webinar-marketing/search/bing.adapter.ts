/**
 * Bing Web Search API adapter — paid path, ToS-clean.
 *
 * Requires `bing_search_api_key` in System Settings (no .env fallback).
 * If the key is missing, search() throws — worker skips this provider for
 * the list and records the failure on the WebinarSearchQuery row.
 *
 * Endpoint reference:
 *   https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/endpoints
 */

import { getConfigValue } from '../../system-config.service.js'
import type { SearchProvider, SearchResult } from './types.js'
import { ProviderBlockedError } from './provider-state.js'

const ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search'

interface BingWebPage {
  name?: string
  url?: string
  snippet?: string
}

interface BingResponse {
  webPages?: { value?: BingWebPage[] }
}

export class BingAdapter implements SearchProvider {
  readonly name = 'bing_web_search'

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const apiKey = await getConfigValue('bing_search_api_key')
    if (!apiKey) {
      throw new Error('bing_search_api_key not set in System Settings')
    }
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(limit, 50)),
      mkt: 'en-US',
      safeSearch: 'Moderate',
      responseFilter: 'Webpages',
    })
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        Accept: 'application/json',
      },
    })
    if (res.status === 429 || res.status === 403) {
      throw new ProviderBlockedError('bing_web_search', `rate-limit ${res.status}`, res.status)
    }
    if (!res.ok) {
      throw new Error(`bing HTTP ${res.status}`)
    }
    const json = (await res.json()) as BingResponse
    const pages = json.webPages?.value ?? []
    return pages
      .filter((p) => p.url && p.name)
      .map((p) => ({
        title: p.name!,
        url: p.url!,
        snippet: p.snippet ?? '',
        provider: 'bing_web_search',
        query,
      }))
  }
}
