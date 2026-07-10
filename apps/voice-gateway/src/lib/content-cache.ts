/**
 * In-process TTL cache for the heavy, content-growing prompt inputs — the
 * rendered listings block (up to ~40k chars) and the KB text (up to ~120k).
 *
 * Why: previously every inbound call and widget session re-ran the full DB
 * fan-out + render for these, so Orby's time-to-first-response grew as tenants
 * added listings and knowledge-base docs, and regressed on every content edit.
 * Caching them per tenant means back-to-back calls skip the rebuild; content
 * edits are still picked up automatically within TTL_MS (no restart, no manual
 * step). Plain Map, no external deps — if compute throws, it propagates to the
 * caller's existing non-fatal catch and nothing is cached.
 */

type Entry = { value: string | null; exp: number }

const TTL_MS = 90_000 // 90s: absorbs call bursts; content edits appear within a minute and a half
const MAX_ENTRIES = 500
const store = new Map<string, Entry>()

export async function cachedContent(
  key: string,
  compute: () => Promise<string | null>,
): Promise<string | null> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.exp > now) return hit.value

  const value = await compute() // throws → not cached, caller's catch handles it
  store.set(key, { value, exp: now + TTL_MS })

  // Opportunistic sweep so the map can't grow unbounded across many tenants.
  if (store.size > MAX_ENTRIES) {
    for (const [k, e] of store) if (e.exp <= now) store.delete(k)
  }
  return value
}

/** Force a rebuild on the next read for a tenant (e.g. after a known content change). */
export function invalidateTenantContent(tenantId: string): void {
  store.delete(`kb:${tenantId}`)
  store.delete(`listings:${tenantId}`)
}
