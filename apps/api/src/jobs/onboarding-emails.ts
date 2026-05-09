import { prisma } from '../lib/prisma.js'
import { getEnv } from '@voiceautomation/config'
import {
  sendOnboardingSetupNudge,
  sendOnboardingFeatureSpotlight,
  sendOnboardingWeekTwoCheckIn,
} from '../services/email.service.js'

// Tenant onboarding email sequence — fires on a schedule based on Tenant.createdAt:
//   - Day 2  (~48h): setup nudge — only if Business DNA still empty
//   - Day 7  (~168h): feature spotlight — SMS + bookings + tag-driven campaigns
//   - Day 14 (~336h): week-2 personal check-in
//
// Idempotent. Each send writes a timestamp to Tenant.onboardingEmailsSent JSON.
// Once a key is present, that email is never re-sent.
//
// Locale resolves from the tenant owner's User.preferredLocale.
//
// Safety guard: tenants older than MAX_TENANT_AGE_HOURS at job startup are NOT
// candidates. This protects against the deploy-time blast scenario — when the
// job is first deployed, "catching up" on tenants that have been around for
// weeks would surprise real customers with emails they didn't expect. New
// tenants signing up post-deploy go through the sequence normally.

const HOUR_MS = 60 * 60 * 1000
const MAX_TENANT_AGE_HOURS = 30 * 24  // 30 days

interface SentMap {
  setupNudge?:       string
  featureSpotlight?: string
  weekTwoCheckIn?:   string
}

export async function runOnboardingEmails(): Promise<void> {
  const now = Date.now()
  const appBaseUrl = getEnv().APP_BASE_URL

  // Fetch tenants who are at least 48h old, still in TRIAL or ACTIVE, with a
  // valid registration email. Cap to 200 per tick to avoid mass-bursts.
  const candidates = await prisma.tenant.findMany({
    where: {
      createdAt:         {
        lte: new Date(now - 48 * HOUR_MS),
        // Safety guard — see MAX_TENANT_AGE_HOURS comment at top.
        gte: new Date(now - MAX_TENANT_AGE_HOURS * HOUR_MS),
      },
      status:            { in: ['TRIAL', 'ACTIVE'] },
      registrationEmail: { not: '' },
      deletedAt:         null,
    },
    select: {
      id:                   true,
      displayName:          true,
      registrationEmail:    true,
      createdAt:            true,
      onboardingEmailsSent: true,
      members: {
        where:  { isOwner: true },
        select: { user: { select: { firstName: true, preferredLocale: true } } },
        take:   1,
      },
    },
    take:    200,
    orderBy: { createdAt: 'asc' },
  })

  let sent = 0
  for (const t of candidates) {
    const ageHours  = (now - t.createdAt.getTime()) / HOUR_MS
    const sentMap   = (t.onboardingEmailsSent as SentMap | null) ?? {}
    const owner     = t.members[0]?.user
    const firstName = owner?.firstName ?? null
    const locale    = (owner?.preferredLocale === 'es' ? 'es' : 'en') as 'en' | 'es'
    const baseOpts  = {
      to:         t.registrationEmail,
      firstName,
      tenantName: t.displayName,
      appBaseUrl,
      locale,
    }
    let updated: SentMap | null = null

    // Day 2 — setup nudge, only if Business DNA still has no published version.
    if (ageHours >= 48 && !sentMap.setupNudge) {
      const dna = await prisma.businessDNA.findFirst({
        where:  { tenantId: t.id, isActive: true },
        select: { id: true },
      })
      if (!dna) {
        try {
          await sendOnboardingSetupNudge(baseOpts)
          updated = { ...sentMap, setupNudge: new Date().toISOString() }
          sent++
        } catch (e) {
          console.error(`[onboarding-emails] setup-nudge failed for ${t.id}:`, (e as Error).message)
        }
      } else {
        // DNA already published — record a "skipped" marker so we don't re-check
        // forever. Use a sentinel value.
        updated = { ...sentMap, setupNudge: 'skipped:dna-already-published' }
      }
    }

    // Day 7 — feature spotlight (regardless of DNA state).
    if (ageHours >= 168 && !(updated?.featureSpotlight ?? sentMap.featureSpotlight)) {
      try {
        await sendOnboardingFeatureSpotlight(baseOpts)
        updated = { ...(updated ?? sentMap), featureSpotlight: new Date().toISOString() }
        sent++
      } catch (e) {
        console.error(`[onboarding-emails] feature-spotlight failed for ${t.id}:`, (e as Error).message)
      }
    }

    // Day 14 — week-2 check-in.
    if (ageHours >= 336 && !(updated?.weekTwoCheckIn ?? sentMap.weekTwoCheckIn)) {
      try {
        await sendOnboardingWeekTwoCheckIn(baseOpts)
        updated = { ...(updated ?? sentMap), weekTwoCheckIn: new Date().toISOString() }
        sent++
      } catch (e) {
        console.error(`[onboarding-emails] week-two-check-in failed for ${t.id}:`, (e as Error).message)
      }
    }

    if (updated) {
      await prisma.tenant.update({
        where: { id: t.id },
        data:  { onboardingEmailsSent: updated as object },
      }).catch((e: unknown) => {
        console.error(`[onboarding-emails] update tenant ${t.id} failed:`, (e as Error).message)
      })
    }
  }

  if (sent > 0) console.log(`[onboarding-emails] sent ${sent} email(s) across ${candidates.length} candidate tenant(s)`)
}

// Runs every hour. Returns the interval handle so the caller can clear it.
export function startOnboardingEmailsJob(): ReturnType<typeof setInterval> {
  const INTERVAL_MS = 60 * 60 * 1000

  // Run once at startup to catch up on any pending sends.
  runOnboardingEmails().catch((err: unknown) => {
    console.error('[onboarding-emails] startup run failed:', err)
  })

  return setInterval(() => {
    runOnboardingEmails().catch((err: unknown) => {
      console.error('[onboarding-emails] scheduled run failed:', err)
    })
  }, INTERVAL_MS)
}
