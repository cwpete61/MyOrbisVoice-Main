/**
 * MyOrbisWebinar — read models for the 3 Phase-1 screens (design §9 Phase 1):
 *   Command          — the revenue-not-attendance dashboard (aggregate).
 *   Lead Intelligence — people ranked by engagement score (hot/warm/cold).
 *   Sales Timeline   — one person's full interaction history from the spine.
 *
 * All read straight off the InteractionEvent log + EngagementScore, so they show
 * real data the moment events land. Admin-hosted → scoped to the platform tenant.
 */
import { prisma } from '../../lib/prisma.js'

// NOTE: getPlatformWebinarTenantId() lived here and pinned every webinar to a single
// hardcoded tenant, which made this an internal tool rather than a product. It is gone
// on purpose — tenantId now comes from the caller's session (routes) or off the row
// itself (the outcome worker, which has no session). Do not reintroduce a "default
// tenant" helper: a single stray call site would silently re-pin every tenant's data.

/** Command — headline metrics for one webinar. Revenue + pipeline, not attendance. */
export async function commandMetrics(webinarId: string) {
  const [regs, scores, events] = await Promise.all([
    prisma.registrant.count({ where: { webinarId } }),
    prisma.engagementScore.findMany({ where: { webinarId }, select: { temp: true, score: true } }),
    prisma.interactionEvent.groupBy({ by: ['type'], where: { webinarId }, _count: { _all: true } }),
  ])
  const byType = Object.fromEntries(events.map((e) => [e.type, e._count._all]))
  const temp = { HOT: 0, WARM: 0, COLD: 0 }
  for (const s of scores) temp[s.temp] += 1
  const avgScore = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0

  return {
    registrants:  regs,
    attended:     byType['JOINED'] ?? 0,
    booked:       byType['BOOKED'] ?? 0,
    purchased:    byType['PURCHASED'] ?? 0,
    ctaClicks:    byType['CTA_CLICKED'] ?? 0,
    questions:    byType['QUESTION_ASKED'] ?? 0,
    temp,
    avgScore,
    // Attendance rate — the vanity metric, kept for contrast with pipeline.
    attendanceRate: regs ? Math.round(((byType['JOINED'] ?? 0) / regs) * 100) : 0,
  }
}

/** Lead Intelligence — registrants ranked by engagement score, hottest first. */
export async function leadIntelligence(webinarId: string, limit = 200) {
  const scores = await prisma.engagementScore.findMany({
    where:   { webinarId },
    orderBy: [{ score: 'desc' }],
    take:    limit,
    include: { person: { select: { id: true, fullName: true, email: true, phone: true, contactId: true } } },
  })
  return scores.map((s) => ({
    personId:  s.personId,
    name:      s.person.fullName,
    email:     s.person.email,
    phone:     s.person.phone,
    contactId: s.person.contactId,
    score:     s.score,
    intent:    s.intent,
    attention: s.attention,
    temp:      s.temp,
    computedAt: s.computedAt,
  }))
}

/**
 * Sales Timeline — one person's full event history for a webinar (or all).
 *
 * `tenantId` is REQUIRED and scopes every query. Without it this route trusted a
 * caller-supplied personId outright, so any platform admin could read any tenant's
 * person timeline by id (the sibling routes all scope via getWebinar(tenantId,...)).
 * Harmless while one hardcoded tenant exists; a cross-tenant leak the moment there
 * are two. Scope it here, not at the call site, so it can't be forgotten again.
 */
export async function personTimeline(personId: string, tenantId: string, webinarId?: string) {
  const [person, events, score] = await Promise.all([
    // findFirst (not findUnique) so tenantId can participate in the filter.
    prisma.webinarPerson.findFirst({
      where:  { id: personId, tenantId },
      select: { id: true, fullName: true, email: true, phone: true, contactId: true, ambiguousFlag: true },
    }),
    prisma.interactionEvent.findMany({
      where:   { personId, tenantId, ...(webinarId ? { webinarId } : {}) },
      orderBy: { ts: 'asc' },
      take:    500,
      select:  { id: true, type: true, source: true, metaJson: true, ts: true, webinarId: true },
    }),
    webinarId
      ? prisma.engagementScore.findFirst({ where: { personId, webinarId, tenantId } })
      : Promise.resolve(null),
  ])
  return { person, events, score }
}
