import { describe, it, expect } from 'vitest'
import {
  warmupCapForDay,
  WARMUP_TARGET_CAP,
  escapeHtml,
  postalAddress,
  addDays,
  PLATFORM_POSTAL_ADDRESS,
} from './bulk-email-pure.js'

describe('warmupCapForDay', () => {
  it('ramps 5 → 50 over the first week', () => {
    expect(warmupCapForDay(1)).toBe(5)
    expect(warmupCapForDay(2)).toBe(10)
    expect(warmupCapForDay(3)).toBe(15)
    expect(warmupCapForDay(4)).toBe(20)
    expect(warmupCapForDay(5)).toBe(30)
    expect(warmupCapForDay(6)).toBe(40)
    expect(warmupCapForDay(7)).toBe(WARMUP_TARGET_CAP)
  })

  it('clamps day 0 and negative days to the day-1 cap', () => {
    expect(warmupCapForDay(0)).toBe(5)
    expect(warmupCapForDay(-3)).toBe(5)
  })

  it('holds at the target cap beyond day 7', () => {
    expect(warmupCapForDay(8)).toBe(50)
    expect(warmupCapForDay(100)).toBe(50)
  })

  it('never exceeds the target cap', () => {
    for (let d = -5; d <= 60; d++) {
      expect(warmupCapForDay(d)).toBeLessThanOrEqual(WARMUP_TARGET_CAP)
    }
  })

  it('never decreases as the day advances', () => {
    let prev = 0
    for (let d = 1; d <= 14; d++) {
      const cap = warmupCapForDay(d)
      expect(cap).toBeGreaterThanOrEqual(prev)
      prev = cap
    }
  })
})

describe('escapeHtml', () => {
  it('escapes the four HTML-significant characters', () => {
    expect(escapeHtml('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;')
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Acme Plumbing, Allentown PA')).toBe('Acme Plumbing, Allentown PA')
  })

  it('neutralizes a script-injection attempt', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>')
  })
})

describe('postalAddress', () => {
  const empty = {
    businessName: null,
    displayName: null,
    partnerStreet: null,
    partnerUnit: null,
    partnerCity: null,
    partnerState: null,
    partnerPostalCode: null,
  }

  it('falls back to the platform address when the partner has none', () => {
    expect(postalAddress(empty)).toBe(PLATFORM_POSTAL_ADDRESS)
  })

  it('builds the partner line from their own address', () => {
    expect(postalAddress({
      ...empty,
      businessName: 'Acme Co',
      partnerStreet: '12 Main St',
      partnerUnit: 'Suite 4',
      partnerCity: 'Allentown',
      partnerState: 'PA',
      partnerPostalCode: '18102',
    })).toBe('Acme Co, 12 Main St Suite 4, Allentown, PA 18102')
  })

  it('uses displayName when businessName is missing', () => {
    expect(postalAddress({ ...empty, displayName: 'Jane Doe', partnerCity: 'Reno', partnerState: 'NV' }))
      .toBe('Jane Doe, Reno, NV')
  })

  it('omits empty segments cleanly', () => {
    expect(postalAddress({ ...empty, businessName: 'X', partnerCity: 'Reno' })).toBe('X, Reno')
  })
})

describe('addDays', () => {
  it('adds whole days', () => {
    expect(addDays(new Date('2026-01-01T00:00:00Z'), 3).toISOString())
      .toBe('2026-01-04T00:00:00.000Z')
  })

  it('treats day 0 as a no-op', () => {
    const d = new Date('2026-05-19T12:00:00Z')
    expect(addDays(d, 0).getTime()).toBe(d.getTime())
  })
})
