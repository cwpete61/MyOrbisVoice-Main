/**
 * Per-provider runtime state — block detection + cooldown.
 *
 * Tracks consecutive failures per search-provider slug. When threshold hits,
 * the provider goes into COOLING_DOWN for a configurable duration. Worker
 * checks isCoolingDown() before each call.
 *
 * In-memory only. Resets on api container restart. Single-replica safe.
 * If we multi-replica the worker later, swap Map → Redis hash.
 *
 * Block heuristic: adapters throw `ProviderBlockedError` when captcha, 429,
 * 403, or sorry-page is detected. The state machine counts those and trips
 * cooldown. Pure "empty results" (legit zero hits) does NOT count as a
 * block — adapters return [] for that case and the worker treats it as a
 * successful zero-result query.
 */

const THRESHOLD = 3 // consecutive blocks before cooldown
const COOLDOWN_MS_BY_PROVIDER: Record<string, number> = {
  duckduckgo: 2 * 60 * 60 * 1000,       // 2 hours
  bing_web_search: 30 * 60 * 1000,      // 30 min (paid API, transient mostly)
  google_scrape: 6 * 60 * 60 * 1000,    // 6 hours (most aggressive blocker)
  default: 60 * 60 * 1000,              // 1 hour
}

export interface ProviderState {
  consecutiveFailures: number
  cooldownUntilEpochMs: number | null
  blocksDetectedTotal: number
  lastBlockedAt: number | null
  lastSuccessAt: number | null
}

const state = new Map<string, ProviderState>()

export class ProviderBlockedError extends Error {
  readonly provider: string
  readonly httpStatus?: number
  readonly signal: string
  constructor(provider: string, signal: string, httpStatus?: number) {
    super(`Provider ${provider} blocked: ${signal}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`)
    this.name = 'ProviderBlockedError'
    this.provider = provider
    this.signal = signal
    if (httpStatus !== undefined) this.httpStatus = httpStatus
  }
}

function getOrInit(provider: string): ProviderState {
  let s = state.get(provider)
  if (!s) {
    s = {
      consecutiveFailures: 0,
      cooldownUntilEpochMs: null,
      blocksDetectedTotal: 0,
      lastBlockedAt: null,
      lastSuccessAt: null,
    }
    state.set(provider, s)
  }
  return s
}

export function isCoolingDown(provider: string): boolean {
  const s = state.get(provider)
  if (!s?.cooldownUntilEpochMs) return false
  if (Date.now() >= s.cooldownUntilEpochMs) {
    // Cooldown expired — reset failure counter so the next try is clean.
    s.cooldownUntilEpochMs = null
    s.consecutiveFailures = 0
    return false
  }
  return true
}

export function recordSuccess(provider: string): void {
  const s = getOrInit(provider)
  s.consecutiveFailures = 0
  s.cooldownUntilEpochMs = null
  s.lastSuccessAt = Date.now()
}

export function recordBlock(provider: string): { cooldownTrippedAt: number | null } {
  const s = getOrInit(provider)
  s.consecutiveFailures++
  s.blocksDetectedTotal++
  s.lastBlockedAt = Date.now()
  if (s.consecutiveFailures >= THRESHOLD) {
    const cooldownMs = COOLDOWN_MS_BY_PROVIDER[provider] ?? COOLDOWN_MS_BY_PROVIDER.default!
    s.cooldownUntilEpochMs = Date.now() + cooldownMs
    return { cooldownTrippedAt: s.cooldownUntilEpochMs }
  }
  return { cooldownTrippedAt: null }
}

export function inspectProviderState(provider: string): ProviderState | null {
  return state.get(provider) ?? null
}

/** Test-only — wipes the in-memory map. */
export function _resetForTests(): void {
  state.clear()
}
