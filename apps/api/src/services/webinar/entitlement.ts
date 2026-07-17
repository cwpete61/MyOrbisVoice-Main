/**
 * MyOrbisWebinar — plan gates.
 *
 * Two gates, because they protect two different things:
 *   webinar_enabled                        — is the product in the plan at all
 *   included_webinar_ai_calls_per_month    — the METER
 *
 * Why AI calls are the meter and registrants are not: the product's pitch is
 * "measured by pipeline, not attendance". Charging per attendee would contradict that
 * and would bill the customer for top-funnel success while the real cost sits at the
 * bottom. An AI call is simultaneously the value (the differentiator) and the cost
 * (Twilio minutes + OpenAI realtime), so metering it keeps price and cost moving
 * together.
 *
 * A missing entitlement row means "not in plan" (checkEntitlement returns null), so
 * everything fails CLOSED. Free tiers deliberately get 0 calls but full scoring: the
 * tenant SEES the hot leads it can't call, which is the upgrade prompt.
 */
import { prisma } from '../../lib/prisma.js'
import { checkEntitlement } from '../entitlement.service.js'

export const WEBINAR_ENABLED_KEY = 'webinar_enabled'
export const WEBINAR_MAX_ACTIVE_KEY = 'webinar_max_active'
export const WEBINAR_AI_CALLS_KEY = 'included_webinar_ai_calls_per_month'

/** Is the webinar product in this tenant's plan? */
export async function webinarEnabled(tenantId: string): Promise<boolean> {
  return (await checkEntitlement(tenantId, WEBINAR_ENABLED_KEY)) === true
}

/**
 * Can this tenant publish another webinar? DRAFTs are free — the cap is on PUBLISHED,
 * since an unpublished webinar costs nothing and blocking drafts just annoys people.
 * Absent key = 0 = fail closed.
 */
export async function canPublishAnotherWebinar(tenantId: string): Promise<{ ok: boolean; cap: number; used: number }> {
  const raw = await checkEntitlement(tenantId, WEBINAR_MAX_ACTIVE_KEY)
  const cap = typeof raw === 'number' ? raw : 0
  if (cap < 0) return { ok: true, cap, used: 0 } // negative = unlimited
  const used = await prisma.webinar.count({ where: { tenantId, status: 'PUBLISHED' } })
  return { ok: used < cap, cap, used }
}

/** Start of the current UTC calendar month — the meter's window. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * Has this tenant got an AI call left this month?
 *
 * Counts CALLED events rather than OutboundCallAttempt rows on purpose: CALLED is only
 * emitted for a dial that actually left (see outcome-worker reconcileCalls). A call
 * suppressed by the compliance gate, or one that died on a Twilio auth error, cost
 * nothing and must not burn the customer's allowance.
 */
export async function aiCallsRemaining(tenantId: string): Promise<{ ok: boolean; cap: number; used: number }> {
  const raw = await checkEntitlement(tenantId, WEBINAR_AI_CALLS_KEY)
  const cap = typeof raw === 'number' ? raw : 0
  if (cap < 0) return { ok: true, cap, used: 0 } // negative = unlimited
  const used = await prisma.interactionEvent.count({
    where: { tenantId, type: 'CALLED', ts: { gte: monthStart() } },
  })
  return { ok: used < cap, cap, used }
}
