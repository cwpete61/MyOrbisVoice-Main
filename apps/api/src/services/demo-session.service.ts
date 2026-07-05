/**
 * DEMO phone sessions. The public demo number (+1 470 517 3441) is shared, so a
 * caller binds their call to their own browser demo session by entering a short
 * PIN via IVR. Conversations tagged with the session id show only in that
 * session's cockpit view.
 *
 * Routing (decided with product): PIN is OPTIONAL. If the caller enters a valid
 * PIN, the call binds to that sandbox demo session; if not, the inbound webhook
 * falls through to the existing "Chase Horner" sample agent.
 */
import { prisma } from '../lib/prisma.js'

/** The shared public demo line. Matches the number on myorbisagents.com. */
export const DEMO_PHONE_E164 = '+14705173441'

/** PIN lifetime — refreshed each time the cockpit re-fetches. */
const PIN_TTL_MS = 30 * 60 * 1000

/** Bound concurrent live demo phone calls (each = a paid Gemini session). Over
 *  this, the IVR tells the caller the demo lines are busy. */
export const MAX_CONCURRENT_DEMO_CALLS = 10

function genPin(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10)
  return s
}

/** Mint or refresh the demo session for a browser (keyed by a localStorage
 *  token). Returns the row incl. the PIN. Sliding 30-min expiry. */
export async function getOrCreateDemoSession(tenantId: string, browserRef: string) {
  const expiresAt = new Date(Date.now() + PIN_TTL_MS)
  const existing = await prisma.demoSession.findUnique({
    where: { tenantId_browserRef: { tenantId, browserRef } },
  })
  if (existing) {
    return prisma.demoSession.update({ where: { id: existing.id }, data: { expiresAt } })
  }
  // Fresh session — allocate a PIN, retrying on the (rare) unique collision.
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await prisma.demoSession.create({
        data: { tenantId, browserRef, pin: genPin(), expiresAt },
      })
    } catch {
      /* unique(pin) collision — retry with a new PIN */
    }
  }
  throw new Error('could not allocate a demo PIN')
}

/** Resolve an active (non-expired) session by its IVR PIN. Null if unknown or
 *  expired. Bumps callCount + lastCallAt when a call binds. */
export async function bindCallToDemoSession(pin: string) {
  const s = await prisma.demoSession.findUnique({ where: { pin } })
  if (!s || s.expiresAt.getTime() < Date.now()) return null
  await prisma.demoSession.update({
    where: { id: s.id },
    data: { callCount: { increment: 1 }, lastCallAt: new Date() },
  }).catch(() => { /* non-fatal */ })
  return s
}

/** Count live demo calls (OPEN conversations bound to a session) to enforce the
 *  concurrency cap before spinning up another paid Gemini session. */
export async function activeDemoCallCount(): Promise<number> {
  return prisma.conversation.count({
    where: { demoSessionId: { not: null }, status: 'OPEN' },
  })
}

/** The sandbox demo tenant's INBOUND channel — where PIN-bound calls connect. */
export async function resolveSandboxInboundTarget(): Promise<{ tenantId: string; channelConfigId: string } | null> {
  const t = await prisma.tenant.findFirst({
    // The shared generic sandbox only — NOT a per-agent AGENT demo (those are
    // routed by caller-ID, never by this fallback).
    where:   { isDemo: true, demoKind: 'SANDBOX' },
    include: { channelConfigs: { where: { channelType: 'INBOUND' } } },
  })
  if (!t) return null
  return { tenantId: t.id, channelConfigId: t.channelConfigs[0]?.id ?? '' }
}
