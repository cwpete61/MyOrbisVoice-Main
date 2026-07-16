import { describe, it, expect } from 'vitest'
import { validateEventPayload, isWebinarEventType, WEBINAR_EVENT_TYPES } from './event-schemas.js'

describe('event payload validation (D5)', () => {
  it('accepts a valid WATCHED heartbeat', () => {
    expect(validateEventPayload('WATCHED', { seconds: 120 })).toEqual({ seconds: 120 })
  })

  it('rejects WATCHED without seconds', () => {
    expect(() => validateEventPayload('WATCHED', {})).toThrow()
  })

  it('rejects negative / non-int seconds', () => {
    expect(() => validateEventPayload('WATCHED', { seconds: -5 })).toThrow()
    expect(() => validateEventPayload('WATCHED', { seconds: 1.5 })).toThrow()
  })

  it('strips unknown keys (strict) — no untyped metaJson leaks through', () => {
    expect(() => validateEventPayload('CTA_CLICKED', { ctaId: 'x', evil: 'drop' })).toThrow()
  })

  it('no-payload events accept empty / undefined meta', () => {
    expect(validateEventPayload('REGISTERED', undefined)).toEqual({})
    expect(validateEventPayload('JOINED', {})).toEqual({})
  })

  it('QUESTION_ASKED requires non-empty text within max length', () => {
    expect(validateEventPayload('QUESTION_ASKED', { text: 'hi' })).toEqual({ text: 'hi' })
    expect(() => validateEventPayload('QUESTION_ASKED', { text: '' })).toThrow()
    expect(() => validateEventPayload('QUESTION_ASKED', { text: 'x'.repeat(2001) })).toThrow()
  })

  it('type guard recognizes known types only', () => {
    expect(isWebinarEventType('WATCHED')).toBe(true)
    expect(isWebinarEventType('NONSENSE')).toBe(false)
  })

  it('every enum member has a schema', () => {
    for (const t of WEBINAR_EVENT_TYPES) {
      expect(() => validateEventPayload(t, {})).not.toThrow(TypeError)
    }
  })
})
