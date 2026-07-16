import { describe, it, expect } from 'vitest'
import { computeScore, DEFAULT_SCORING, type ScoreInput } from './scoring.service.js'

const w = (seconds: number): ScoreInput => ({ type: 'WATCHED', meta: { seconds } })

describe('computeScore', () => {
  it('empty event list → cold zero', () => {
    expect(computeScore([])).toEqual({ intent: 0, attention: 0, score: 0, temp: 'COLD' })
  })

  it('attention accumulates watch minutes and caps at 100', () => {
    // 25 min * 4 pts/min = 100 exactly
    expect(computeScore([w(25 * 60)]).attention).toBe(100)
    // way over → clamped, not overflowed
    expect(computeScore([w(100 * 60)]).attention).toBe(100)
  })

  it('splits watch across multiple heartbeats (sums seconds)', () => {
    const one = computeScore([w(10 * 60)]).attention
    const split = computeScore([w(5 * 60), w(5 * 60)]).attention
    expect(split).toBe(one)
  })

  it('REPLAY_WATCHED also feeds attention', () => {
    expect(computeScore([{ type: 'REPLAY_WATCHED', meta: { seconds: 10 * 60 } }]).attention).toBeGreaterThan(0)
  })

  it('intent sums per-event weights and caps at 100', () => {
    const r = computeScore([
      { type: 'POLL_ANSWERED', meta: { pollId: 'p', choice: 'a' } },   // 12
      { type: 'QUESTION_ASKED', meta: { text: 'hi' } },                // 15
      { type: 'CTA_CLICKED', meta: { ctaId: 'c' } },                   // 25
    ])
    expect(r.intent).toBe(52)
  })

  it('BOOKED floors the composite to at least 85 (never cold)', () => {
    const r = computeScore([{ type: 'BOOKED', meta: {} }])
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.temp).toBe('HOT')
  })

  it('PURCHASED floors composite to 100', () => {
    const r = computeScore([{ type: 'PURCHASED', meta: {} }])
    expect(r.score).toBe(100)
    expect(r.temp).toBe('HOT')
  })

  it('a lone registration reads cold', () => {
    expect(computeScore([{ type: 'REGISTERED', meta: {} }]).temp).toBe('COLD')
  })

  it('temp thresholds: HOT ≥70, WARM ≥40, else COLD', () => {
    // Build composites straddling the thresholds via CTA clicks (25 intent each).
    const cold = computeScore([{ type: 'DOWNLOADED', meta: { assetId: 'a' } }]) // 12 intent → ~7 composite
    expect(cold.temp).toBe('COLD')
    // full attention (100) + strong intent (CTA+Q+poll = 52) → composite 74 → HOT
    const hot = computeScore([
      w(25 * 60),
      { type: 'CTA_CLICKED', meta: { ctaId: 'c' } },
      { type: 'QUESTION_ASKED', meta: { text: 'price?' } },
      { type: 'POLL_ANSWERED', meta: { pollId: 'p', choice: 'a' } },
    ])
    expect(hot.temp).toBe('HOT')
  })

  it('honors an injected config (weights swappable)', () => {
    const r = computeScore([{ type: 'JOINED', meta: {} }], {
      ...DEFAULT_SCORING,
      intentWeights: { JOINED: 100 },
      attentionWeight: 0, // composite = pure intent
    })
    expect(r.score).toBe(100)
  })
})
