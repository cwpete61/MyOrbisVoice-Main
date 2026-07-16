/**
 * MyOrbisWebinar — event append + incremental scoring (design §9 D5 + D6).
 *
 * appendEvent is the single write path into the spine log. It:
 *   1. validates the payload against the event type (zod, D5),
 *   2. dedups on traceId for idempotent ingestion (webhook/replay retries),
 *   3. inserts the InteractionEvent,
 *   4. recomputes ONLY that person's score for that webinar and upserts it (D6).
 */
import type { InteractionEventType, InteractionEventSource } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { validateEventPayload, isWebinarEventType } from './event-schemas.js'
import { computeScore } from './scoring.service.js'

export interface AppendEventInput {
  personId: string
  tenantId: string
  type: InteractionEventType
  source?: InteractionEventSource
  webinarId?: string | null
  sessionId?: string | null
  /** Idempotency key — a repeat append with the same traceId is a no-op. */
  traceId?: string | null
  meta?: Record<string, unknown> | null
}

export interface AppendEventResult {
  id: string
  deduped: boolean
}

export async function appendEvent(input: AppendEventInput): Promise<AppendEventResult> {
  if (!isWebinarEventType(input.type)) {
    throw new Error(`Unknown webinar event type: ${input.type}`)
  }
  // D5 — reject invalid payloads before write (throws ZodError → 422 upstream).
  const meta = validateEventPayload(input.type, input.meta)

  // D5 idempotency — same traceId already logged → return it, do not double-count.
  if (input.traceId) {
    const existing = await prisma.interactionEvent.findUnique({
      where: { traceId: input.traceId },
      select: { id: true },
    })
    if (existing) return { id: existing.id, deduped: true }
  }

  const event = await prisma.interactionEvent.create({
    data: {
      personId:  input.personId,
      tenantId:  input.tenantId,
      type:      input.type,
      source:    input.source ?? 'WEBINAR',
      webinarId: input.webinarId ?? null,
      sessionId: input.sessionId ?? null,
      traceId:   input.traceId ?? null,
      metaJson:  Object.keys(meta).length ? (meta as object) : undefined,
    },
    select: { id: true },
  })

  // D6 — incremental: recompute this person's score for this webinar only.
  if (input.webinarId) {
    await recomputeScore(input.personId, input.webinarId, input.tenantId)
  }

  return { id: event.id, deduped: false }
}

/** Recompute + upsert one person's EngagementScore for one webinar. */
export async function recomputeScore(personId: string, webinarId: string, tenantId: string): Promise<void> {
  const events = await prisma.interactionEvent.findMany({
    where:  { personId, webinarId },
    select: { type: true, metaJson: true },
  })
  const result = computeScore(
    events.map((e) => ({ type: e.type, meta: e.metaJson as Record<string, unknown> | null })),
  )
  await prisma.engagementScore.upsert({
    where:  { personId_webinarId: { personId, webinarId } },
    create: { personId, webinarId, tenantId, ...result, computedAt: new Date() },
    update: { ...result, computedAt: new Date() },
  })
}
