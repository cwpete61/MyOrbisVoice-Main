/**
 * MyOrbisWebinar — outcome automation worker. The hero rule:
 *
 *   engaged + clicked the CTA + didn't book + didn't buy  →  MyOrbisVoice AI call
 *
 * This is the whole thesis: a webinar that doesn't just score people, it acts on
 * them. Behaviour triggers it, not the clock.
 *
 *   ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐   ┌─────────────┐
 *   │ scan scores  │──▶│ eligible?     │──▶│ OutboundCall-    │──▶│ dispatch-   │
 *   │ (warm+)      │   │ CTA & !BOOKED │   │ Attempt PENDING  │   │ PendingCalls│
 *   └──────────────┘   │ & !CALLED     │   └──────────────────┘   └──────┬──────┘
 *                      │ & has Contact │                                 │
 *                      └───────────────┘        emit CALLED ◀────────────┘
 *                                               (only if actually dialed)
 *
 * COMPLIANCE: we deliberately route through dispatchPendingCalls rather than calling
 * Twilio ourselves, because its `if (attempt.contact.optedOutVoice)` check is the ONLY
 * voice opt-out gate in the entire codebase — the voice-gateway has none. Any path
 * around it would be ungated. A person who never ticked the consent box is born
 * optedOutVoice=true (see bookFromWebinar), so this worker physically cannot dial them:
 * the attempt lands FAILED/opted_out_voice and we emit no CALLED event.
 */
import { prisma } from '../../lib/prisma.js'
import { appendEvent } from './events.service.js'
import { webinarEnabled, aiCallsRemaining } from './entitlement.js'

const WORKER_INTERVAL_MS = 30_000
const BATCH = 20
/** Only chase leads with real interest. Matches scoring.service's warmAt. */
const MIN_SCORE = 40

let timer: NodeJS.Timeout | null = null
let ticking = false

/** One bridge OutboundCampaign per webinar — carries the AI's opening script. */
async function getOrCreateWebinarBridgeCampaign(tenantId: string, webinarId: string, title: string): Promise<{ id: string }> {
  const existing = await prisma.outboundCampaign.findFirst({
    where: {
      tenantId,
      audienceJson: { path: ['kind'], equals: 'webinar_hero_bridge' },
      AND: { audienceJson: { path: ['webinarId'], equals: webinarId } },
    },
    select: { id: true },
  })
  if (existing) return existing

  return prisma.outboundCampaign.create({
    data: {
      tenantId,
      name:   `[webinar] ${title}`,
      // The gateway folds description into the agent's opening prompt.
      description:
        `You are following up with someone who watched the "${title}" webinar and clicked ` +
        `to book a call, but never picked a time. Be brief and human. Reference the webinar, ` +
        `ask if they have questions, and offer to book them in. If they're not interested, ` +
        `thank them and end the call politely.`,
      status: 'RUNNING',
      audienceJson: { kind: 'webinar_hero_bridge', webinarId },
    },
    select: { id: true },
  })
}

/** Fire the hero rule for one person. Returns true if a call was actually placed. */
async function chaseOne(row: { personId: string; webinarId: string; tenantId: string; contactId: string; title: string }): Promise<boolean> {
  const bridge = await getOrCreateWebinarBridgeCampaign(row.tenantId, row.webinarId, row.title)

  // Idempotency: one attempt per (bridge campaign, contact). Without this a
  // suppressed/failed dial would be retried on every tick forever.
  const prior = await prisma.outboundCallAttempt.findFirst({
    where:  { campaignId: bridge.id, contactId: row.contactId },
    select: { id: true },
  })
  if (prior) return false

  const attempt = await prisma.outboundCallAttempt.create({
    data: {
      tenantId:      row.tenantId,
      campaignId:    bridge.id,
      contactId:     row.contactId,
      status:        'PENDING',
      attemptNumber: 1,
    },
    select: { id: true },
  })

  const { dispatchPendingCalls } = await import('../outbound.service.js')
  await dispatchPendingCalls(row.tenantId, bridge.id)

  // dispatchPendingCalls swallows Twilio errors AND the compliance gate — re-read to
  // see what actually happened. Only a call that really went out becomes a CALLED event.
  const post = await prisma.outboundCallAttempt.findUnique({
    where:  { id: attempt.id },
    select: { status: true, outcomeCode: true, providerCallId: true },
  })
  if (!post || post.status === 'FAILED') {
    if (post?.outcomeCode === 'opted_out_voice') {
      console.log(`[webinar-outcome] ${row.personId}: no voice consent → call suppressed (compliance gate)`)
    } else {
      console.warn(`[webinar-outcome] ${row.personId}: dispatch failed — ${post?.outcomeCode ?? 'unknown'}`)
    }
    return false
  }

  // NOTE: no CALLED event here. The dial is in flight; Twilio resolves the real
  // outcome later via the status webhook (handleOutboundStatus). reconcileCalls()
  // below emits CALLED once we know what actually happened — so meta.outcome is
  // truthful rather than optimistic.
  console.log(`[webinar-outcome] ${row.personId}: engaged + CTA, no booking → AI call placed`)
  return true
}

/**
 * Emit CALLED for dials that have RESOLVED, with their real outcome.
 *
 * Deliberately pull-based: outbound.service is a generic voice primitive used by
 * every campaign, and reaching into it to emit webinar events would couple it to this
 * product. Instead we poll our own bridge campaigns' attempts. Twilio's status webhook
 * (handleOutboundStatus) sets outcomeCode; we translate that into the spine.
 *
 * Only real dials become CALLED. `opted_out_voice` (gated — never dialed) and
 * `dispatch_error…` (never left the building) are NOT calls and must never score.
 */
const REAL_DIAL_OUTCOMES = new Set(['answered', 'busy', 'no_answer', 'canceled', 'failed'])

async function reconcileCalls(): Promise<void> {
  // Every tenant's bridges — the worker has no session, so tenant comes off the row.
  const bridges = await prisma.outboundCampaign.findMany({
    where:  { audienceJson: { path: ['kind'], equals: 'webinar_hero_bridge' } },
    select: { id: true, tenantId: true, audienceJson: true },
  })
  if (!bridges.length) return

  for (const bridge of bridges) {
    const webinarId = (bridge.audienceJson as { webinarId?: string } | null)?.webinarId
    if (!webinarId) continue
    const tenantId = bridge.tenantId

    const resolved = await prisma.outboundCallAttempt.findMany({
      where:  { campaignId: bridge.id, outcomeCode: { not: null } },
      select: { id: true, contactId: true, outcomeCode: true },
      take:   BATCH,
    })

    for (const a of resolved) {
      const outcome = a.outcomeCode ?? ''
      // Strip the "dispatch_error: …" detail before matching.
      const base = outcome.split(':')[0]?.trim() ?? ''
      if (!REAL_DIAL_OUTCOMES.has(base)) continue

      const person = await prisma.webinarPerson.findFirst({
        where:  { tenantId, contactId: a.contactId },
        select: { id: true },
      })
      if (!person) continue

      // traceId makes this idempotent — re-ticking can't double-count the score.
      await appendEvent({
        personId:  person.id,
        tenantId,
        type:      'CALLED',
        source:    'VOICE',
        webinarId,
        meta:      { callId: a.id, outcome: base },
        traceId:   `webinar:called:${a.id}`,
      })
    }
  }
}

export async function runTick(): Promise<void> {
  if (ticking) return // re-entrancy guard (single-instance worker)
  ticking = true
  try {
    // Turn finished dials into CALLED events first, so a person who was just called
    // is excluded from the chase below on this same tick.
    await reconcileCalls()

    // Engaged enough to be worth a call — across ALL tenants. The worker runs without a
    // session, so tenantId comes off each row rather than a caller's context.
    const scores = await prisma.engagementScore.findMany({
      where:   { score: { gte: MIN_SCORE } },
      orderBy: { computedAt: 'asc' },
      take:    BATCH,
      select:  { personId: true, webinarId: true, tenantId: true },
    })
    if (!scores.length) return

    for (const s of scores) {
      const tenantId = s.tenantId
      // The rule, read straight off the append-only log.
      const events = await prisma.interactionEvent.findMany({
        where:  { personId: s.personId, webinarId: s.webinarId },
        select: { type: true },
      })
      const has = (t: string) => events.some(e => e.type === t)
      if (!has('CTA_CLICKED')) continue          // never showed buying intent
      if (has('BOOKED') || has('PURCHASED')) continue // already converted
      if (has('CALLED')) continue                 // already chased

      const [person, webinar] = await Promise.all([
        prisma.webinarPerson.findUnique({ where: { id: s.personId }, select: { contactId: true } }),
        prisma.webinar.findUnique({ where: { id: s.webinarId }, select: { title: true } }),
      ])
      // No Contact → un-callable AND un-gateable (optedOutVoice lives on Contact).
      // Skip rather than invent consent.
      if (!person?.contactId || !webinar) continue

      // Plan gates. Checked per person because a tenant can cross its cap mid-tick.
      // Cheap (two indexed reads) and this is a 30s tick, not a hot path.
      if (!(await webinarEnabled(tenantId))) continue
      const quota = await aiCallsRemaining(tenantId)
      if (!quota.ok) {
        console.log(`[webinar-outcome] tenant ${tenantId}: AI call cap reached (${quota.used}/${quota.cap}) — skipping`)
        continue
      }

      try {
        await chaseOne({ personId: s.personId, webinarId: s.webinarId, tenantId, contactId: person.contactId, title: webinar.title })
      } catch (err) {
        console.error(`[webinar-outcome] chase failed for ${s.personId}`, err)
      }
    }
  } catch (err) {
    console.error('[webinar-outcome] tick failed', err) // never throw out of the tick
  } finally {
    ticking = false
  }
}

export function startWebinarOutcomeWorker(): void {
  if (timer) return
  console.log(`[webinar-outcome-worker] starting, tick = ${WORKER_INTERVAL_MS}ms`)
  timer = setInterval(() => { void runTick() }, WORKER_INTERVAL_MS)
}

/** Exported so tests can drive ticks manually. */
export function stopWebinarOutcomeWorker(): void {
  if (timer) { clearInterval(timer); timer = null }
}
