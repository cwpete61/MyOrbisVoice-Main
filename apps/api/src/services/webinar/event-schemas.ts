/**
 * MyOrbisWebinar — typed event vocabulary (design §9 D5).
 *
 * Every InteractionEvent payload is validated by a zod schema at the service
 * layer BEFORE write — no untyped metaJson on the hot path. The map is keyed by
 * InteractionEventType (Prisma enum); each value validates that type's metaJson.
 */
import { z } from 'zod'

const seconds = z.number().int().min(0).max(86_400) // cap a single heartbeat at 24h

export const eventPayloadSchemas = {
  REGISTERED:     z.object({}).strict(),
  JOINED:         z.object({}).strict(),
  WATCHED:        z.object({ seconds }).strict(),
  POLL_ANSWERED:  z.object({ pollId: z.string().min(1), choice: z.string().min(1) }).strict(),
  QUESTION_ASKED: z.object({ text: z.string().min(1).max(2000) }).strict(),
  CTA_CLICKED:    z.object({ ctaId: z.string().min(1), label: z.string().max(200).optional() }).strict(),
  DOWNLOADED:     z.object({ assetId: z.string().min(1) }).strict(),
  BOOKED:         z.object({ appointmentId: z.string().optional() }).strict(),
  CALLED:         z.object({ callId: z.string().optional(), outcome: z.string().optional() }).strict(),
  PURCHASED:      z.object({ amountMinor: z.number().int().min(0).optional(), currency: z.string().length(3).optional() }).strict(),
  REVIEWED:       z.object({ rating: z.number().min(1).max(5).optional() }).strict(),
  REPLAY_WATCHED: z.object({ seconds }).strict(),
  NO_SHOW:        z.object({}).strict(),
} as const

export type WebinarEventType = keyof typeof eventPayloadSchemas

export const WEBINAR_EVENT_TYPES = Object.keys(eventPayloadSchemas) as WebinarEventType[]

export function isWebinarEventType(t: string): t is WebinarEventType {
  return t in eventPayloadSchemas
}

/**
 * Validate a payload against its event type. Returns the parsed (stripped)
 * payload, or throws a ZodError the caller maps to a 422. Empty/undefined meta
 * is allowed for the no-payload event types.
 */
export function validateEventPayload(type: WebinarEventType, meta: unknown): Record<string, unknown> {
  return eventPayloadSchemas[type].parse(meta ?? {}) as Record<string, unknown>
}
