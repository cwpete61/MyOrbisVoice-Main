import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isCoolingDown,
  recordBlock,
  recordSuccess,
  inspectProviderState,
  ProviderBlockedError,
  _resetForTests,
} from './provider-state.js'

beforeEach(() => {
  _resetForTests()
})

describe('ProviderBlockedError', () => {
  it('captures provider + signal + httpStatus', () => {
    const e = new ProviderBlockedError('google_scrape', 'sorry-page', 429)
    expect(e.provider).toBe('google_scrape')
    expect(e.signal).toBe('sorry-page')
    expect(e.httpStatus).toBe(429)
    expect(e.name).toBe('ProviderBlockedError')
    expect(e.message).toContain('google_scrape')
    expect(e.message).toContain('sorry-page')
    expect(e.message).toContain('429')
  })

  it('works without httpStatus', () => {
    const e = new ProviderBlockedError('duckduckgo', 'captcha page')
    expect(e.httpStatus).toBeUndefined()
    expect(e.message).toContain('captcha page')
    expect(e.message).not.toContain('HTTP')
  })
})

describe('isCoolingDown', () => {
  it('returns false for never-seen provider', () => {
    expect(isCoolingDown('duckduckgo')).toBe(false)
  })

  it('returns false after one block (below threshold)', () => {
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(false)
  })

  it('returns false after two blocks (below threshold)', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(false)
  })

  it('returns true after three consecutive blocks (threshold reached)', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    const { cooldownTrippedAt } = recordBlock('duckduckgo')
    expect(cooldownTrippedAt).not.toBeNull()
    expect(isCoolingDown('duckduckgo')).toBe(true)
  })

  it('different providers track independently', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(true)
    expect(isCoolingDown('google_scrape')).toBe(false)
    expect(isCoolingDown('bing_web_search')).toBe(false)
  })
})

describe('recordSuccess', () => {
  it('resets consecutive failures', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordSuccess('duckduckgo')
    // Two more blocks should NOT trip cooldown — counter was reset
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(false)
  })

  it('clears active cooldown', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(true)
    recordSuccess('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(false)
  })

  it('updates lastSuccessAt timestamp', () => {
    const before = Date.now()
    recordSuccess('duckduckgo')
    const state = inspectProviderState('duckduckgo')
    expect(state?.lastSuccessAt).toBeGreaterThanOrEqual(before)
  })
})

describe('recordBlock', () => {
  it('returns null cooldownTrippedAt when threshold not reached', () => {
    expect(recordBlock('duckduckgo').cooldownTrippedAt).toBeNull()
    expect(recordBlock('duckduckgo').cooldownTrippedAt).toBeNull()
  })

  it('returns cooldown epoch when threshold reached', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    const { cooldownTrippedAt } = recordBlock('duckduckgo')
    expect(cooldownTrippedAt).not.toBeNull()
    expect(cooldownTrippedAt!).toBeGreaterThan(Date.now())
  })

  it('cooldown durations differ per provider', () => {
    const dduckDuration = (() => {
      recordBlock('duckduckgo'); recordBlock('duckduckgo')
      const { cooldownTrippedAt } = recordBlock('duckduckgo')
      return cooldownTrippedAt! - Date.now()
    })()
    _resetForTests()
    const googleDuration = (() => {
      recordBlock('google_scrape'); recordBlock('google_scrape')
      const { cooldownTrippedAt } = recordBlock('google_scrape')
      return cooldownTrippedAt! - Date.now()
    })()
    // Google's cooldown is longest (6h vs 2h)
    expect(googleDuration).toBeGreaterThan(dduckDuration)
  })

  it('blocksDetectedTotal accumulates even after cooldown reset', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordSuccess('duckduckgo')
    recordBlock('duckduckgo')
    const state = inspectProviderState('duckduckgo')
    expect(state?.blocksDetectedTotal).toBe(4)
    expect(state?.consecutiveFailures).toBe(1) // only the post-success block
  })
})

describe('cooldown expiry', () => {
  it('auto-clears when cooldownUntilEpochMs passes', () => {
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    recordBlock('duckduckgo')
    expect(isCoolingDown('duckduckgo')).toBe(true)

    // Force-expire by reaching into state via Date.now spy
    const state = inspectProviderState('duckduckgo')!
    state.cooldownUntilEpochMs = Date.now() - 1
    expect(isCoolingDown('duckduckgo')).toBe(false)
    // Auto-clear also resets consecutiveFailures so next block doesn't
    // immediately re-trip.
    expect(state.consecutiveFailures).toBe(0)
  })
})
