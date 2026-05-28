/**
 * Shared types for Webinar Marketing search adapters. All adapters must
 * implement SearchProvider so the worker can iterate providers per LeadList
 * configuration without knowing each one's shape.
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  provider: string
  query: string
}

export interface SearchProvider {
  /** Slug used in WebinarLeadList.searchEngines column. */
  readonly name: string
  /** Returns at most `limit` results. Throws on provider/network error. */
  search(query: string, limit: number): Promise<SearchResult[]>
}

/** Friendly enum-like map of slugs allowed in WebinarLeadList.searchEngines. */
export const PROVIDER_SLUGS = [
  'duckduckgo',
  'bing_web_search',
  'google_scrape',
  'serpapi',
  'google_custom_search',
] as const
export type ProviderSlug = (typeof PROVIDER_SLUGS)[number]
