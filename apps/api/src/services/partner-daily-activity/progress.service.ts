/**
 * Partner Daily Activity progress service.
 *
 * dayKey = YYYY-MM-DD in partner-local time. We don't know each partner's
 * timezone yet (no field on AffiliateAccount), so server uses UTC for now
 * and the UI can pass a `?day=YYYY-MM-DD` override for client-local display.
 * When timezone-per-partner ships, swap todayKey() to derive from that.
 */
import { prisma } from '../../lib/prisma.js'
import { DAILY_ACTIVITY_CATALOG, findActivity, totalActivityCount } from './catalog.js'

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function isValidDayKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export interface ActivityWithState {
  key: string
  label: string
  hint?: string
  completedAt: string | null
}

export interface SubsectionWithState {
  key: string
  label: string
  durationMin?: number
  items: ActivityWithState[]
}

export interface SectionWithState {
  key: string
  label: string
  tier: 'CRITICAL' | 'HIGH' | 'STANDARD' | 'OPTIONAL'
  durationMin: number
  rationale: string
  subsections: SubsectionWithState[]
  completed: number
  total: number
}

export interface DailyActivityTree {
  dayKey: string
  sections: SectionWithState[]
  completed: number
  total: number
}

export async function getTreeForPartner(
  partnerId: string,
  dayKey: string,
): Promise<DailyActivityTree> {
  const ticks = await prisma.partnerDailyActivityProgress.findMany({
    where: { partnerId, dayKey },
    select: { activityKey: true, completedAt: true },
  })
  const tickByKey = new Map(ticks.map((t) => [t.activityKey, t.completedAt.toISOString()]))

  const sections: SectionWithState[] = DAILY_ACTIVITY_CATALOG.map((s) => {
    let sectionCompleted = 0
    let sectionTotal = 0
    const subsections: SubsectionWithState[] = s.subsections.map((sub) => ({
      key: sub.key,
      label: sub.label,
      durationMin: sub.durationMin,
      items: sub.items.map((item) => {
        sectionTotal++
        const completedAt = tickByKey.get(item.key) ?? null
        if (completedAt) sectionCompleted++
        return { key: item.key, label: item.label, hint: item.hint, completedAt }
      }),
    }))
    return {
      key: s.key,
      label: s.label,
      tier: s.tier,
      durationMin: s.durationMin,
      rationale: s.rationale,
      subsections,
      completed: sectionCompleted,
      total: sectionTotal,
    }
  })

  return {
    dayKey,
    sections,
    completed: sections.reduce((a, s) => a + s.completed, 0),
    total: totalActivityCount(),
  }
}

export async function checkActivity(
  partnerId: string,
  activityKey: string,
  dayKey: string,
  notes?: string,
): Promise<{ ok: boolean; completedAt?: string; reason?: string }> {
  if (!findActivity(activityKey)) {
    return { ok: false, reason: 'unknown activityKey' }
  }
  if (!isValidDayKey(dayKey)) {
    return { ok: false, reason: 'invalid dayKey' }
  }
  const row = await prisma.partnerDailyActivityProgress.upsert({
    where: {
      partnerId_activityKey_dayKey: { partnerId, activityKey, dayKey },
    },
    create: {
      partnerId,
      activityKey,
      dayKey,
      notes: notes ?? null,
    },
    update: notes ? { notes } : {},
  })
  return { ok: true, completedAt: row.completedAt.toISOString() }
}

export async function uncheckActivity(
  partnerId: string,
  activityKey: string,
  dayKey: string,
): Promise<{ ok: boolean }> {
  if (!isValidDayKey(dayKey)) {
    return { ok: false }
  }
  // Use deleteMany so absence isn't an error — idempotent un-tick.
  await prisma.partnerDailyActivityProgress.deleteMany({
    where: { partnerId, activityKey, dayKey },
  })
  return { ok: true }
}
