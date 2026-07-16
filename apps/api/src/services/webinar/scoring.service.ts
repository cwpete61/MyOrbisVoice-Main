/**
 * MyOrbisWebinar — engagement scoring (design §9 D6).
 *
 * Pure, dependency-free 0-100 scorer over a person's InteractionEvents for one
 * webinar. Mirrors apps/lead-engine/app/scoring.py: documented weights, no I/O,
 * fully unit-testable. Config lives here as a default object so it can later be
 * moved to the DB and injected (design: "config in DB, never hardcoded") without
 * touching the math.
 *
 * Three outputs:
 *   attention — how much they watched (watch minutes, capped).
 *   intent    — how many buying signals they fired (polls, questions, CTA, etc.).
 *   score     — composite; BOOKED/PURCHASED apply a floor so a converter can
 *               never read cold.
 *   temp      — HOT/WARM/COLD bucket off the composite.
 */
import type { InteractionEventType } from '@prisma/client'

export interface ScoreInput {
  type: InteractionEventType
  meta?: Record<string, unknown> | null
}

export interface ScoreResult {
  intent: number
  attention: number
  score: number
  temp: 'HOT' | 'WARM' | 'COLD'
}

export interface ScoringConfig {
  /** attention points per watched minute (live + replay) */
  attentionPerMinute: number
  /** intent points per event type */
  intentWeights: Partial<Record<InteractionEventType, number>>
  /** composite = attentionWeight*attention + (1-attentionWeight)*intent */
  attentionWeight: number
  /** composite floors — a person who did this can't score below the floor */
  floors: Partial<Record<InteractionEventType, number>>
  /** temp thresholds on the composite */
  hotAt: number
  warmAt: number
}

export const DEFAULT_SCORING: ScoringConfig = {
  attentionPerMinute: 4, // 25 min watched → 100 attention
  intentWeights: {
    POLL_ANSWERED: 12,
    QUESTION_ASKED: 15,
    CTA_CLICKED: 25,
    DOWNLOADED: 12,
    BOOKED: 40,
    CALLED: 10,
    PURCHASED: 60,
    REVIEWED: 8,
    JOINED: 4,
    REPLAY_WATCHED: 4,
  },
  attentionWeight: 0.45,
  floors: { BOOKED: 85, PURCHASED: 100 },
  hotAt: 70,
  warmAt: 40,
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Total watched seconds across WATCHED + REPLAY_WATCHED heartbeats. */
function watchedSeconds(events: ScoreInput[]): number {
  let s = 0
  for (const e of events) {
    if (e.type === 'WATCHED' || e.type === 'REPLAY_WATCHED') {
      const sec = (e.meta as { seconds?: unknown } | null)?.seconds
      if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) s += sec
    }
  }
  return s
}

export function computeScore(events: ScoreInput[], cfg: ScoringConfig = DEFAULT_SCORING): ScoreResult {
  if (events.length === 0) return { intent: 0, attention: 0, score: 0, temp: 'COLD' }

  const attention = clamp(Math.round((watchedSeconds(events) / 60) * cfg.attentionPerMinute))

  let intent = 0
  for (const e of events) {
    intent += cfg.intentWeights[e.type] ?? 0
  }
  intent = clamp(intent)

  let score = clamp(Math.round(cfg.attentionWeight * attention + (1 - cfg.attentionWeight) * intent))

  // Conversion floors — a booker/buyer can never read cold.
  for (const e of events) {
    const floor = cfg.floors[e.type]
    if (floor != null && floor > score) score = floor
  }

  const temp: ScoreResult['temp'] = score >= cfg.hotAt ? 'HOT' : score >= cfg.warmAt ? 'WARM' : 'COLD'
  return { intent, attention, score, temp }
}
