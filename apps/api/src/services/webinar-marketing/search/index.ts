/**
 * Search provider registry. Worker calls getProvider(slug) per
 * WebinarLeadList.searchEngines and runs each in turn.
 *
 * Adding a new provider:
 *   1. Implement SearchProvider in ./<name>.adapter.ts
 *   2. Add the slug to PROVIDER_SLUGS in types.ts
 *   3. Register it in REGISTRY below
 *   4. Add a default rate-limit row in providerRateLimitMs() if it has
 *      different politeness needs
 */

import { DuckDuckGoAdapter } from './duckduckgo.adapter.js'
import { BingAdapter } from './bing.adapter.js'
import { GoogleScrapeAdapter } from './google-scrape.adapter.js'
import type { ProviderSlug, SearchProvider } from './types.js'

const REGISTRY: Record<string, () => SearchProvider> = {
  duckduckgo: () => new DuckDuckGoAdapter(),
  bing_web_search: () => new BingAdapter(),
  google_scrape: () => new GoogleScrapeAdapter(),
  // serpapi + google_custom_search to come in Phase 2.5
}

export function getProvider(slug: ProviderSlug | string): SearchProvider | null {
  const factory = REGISTRY[slug]
  return factory ? factory() : null
}

/**
 * Minimum delay between calls to the SAME provider, in milliseconds.
 * Worker enforces this via a per-provider last-call timestamp map.
 *
 * - DuckDuckGo scrape: 8s (lighter ToS, no captcha typically)
 * - Bing API: 1s (paid, generous quota)
 * - Google scrape: 15s (high ToS risk, captcha-trigger-prone)
 */
export function providerRateLimitMs(slug: string): number {
  switch (slug) {
    case 'bing_web_search':
      return 1_000
    case 'duckduckgo':
      return 8_000
    case 'google_scrape':
      return 15_000
    default:
      return 8_000
  }
}

export type { SearchProvider, SearchResult, ProviderSlug } from './types.js'
