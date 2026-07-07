/**
 * MyOrbisAgents public direct line (+1 929 640 3810).
 *
 * Its own platform-owned demo tenant that mirrors the sandbox demo account —
 * the SAME Orby persona (John Brown · Austin Realtors), the same sample
 * listings, the same booking + confirmation-email behavior — with ONE
 * difference: it answers INSTANTLY (no PIN hold). It's a separate tenant from
 * the SANDBOX (the 470 cockpit-demo target), so its calls never show up in the
 * demo dashboard: the 470 demo is what tracks activity; this line just talks
 * and (on a booking) sends the caller the simulated confirmation email.
 *
 * Marked isDemo (so it's excluded from paying-tenant rosters and so bookings
 * send the demo "simulation" confirmation email) but carries NO demoKind, so
 * the 15-min SANDBOX reset job never touches it.
 */
import { prisma } from '../lib/prisma.js'
import { provisionAgentOrby } from './agent-onboarding.service.js'
import { updateChannel } from './channel.service.js'
import { enrichListing } from './listing-enrichment.service.js'
import { applyDemoEntitlements } from './demo.service.js'

/** Public direct-dial line — instant Orby, no PIN. Distinct from DEMO_PHONE. */
export const DIRECT_PHONE_E164 = '+19296403810'

/** Stable slug used to resolve the direct-line tenant at call time. */
export const MARKETING_TENANT_SLUG = 'myorbisagents-reception'

// Same demo persona as the sandbox (demo.service.ts) so this line IS the demo
// account, just instant. Keep the two in sync when the persona changes.
const DEMO_AGENT = {
  agentName:     'John Brown',
  brokerage:     'Austin Realtors',
  market:        'Austin metro',
  specialties:   'first-time buyers, luxury, relocation',
  bookingHours:  'Mon–Sat 9am–6pm',
  language:      'bilingual' as const,
  listingsBrief: 'Renovated South Austin bungalow at $685k; a coming-soon 4BR; a downtown condo.',
}

// Same 3 geocodable Austin addresses the sandbox uses, so free enrichment
// (population, hospitals, schools, flood) resolves and Orby can answer area
// questions when a caller asks about a listing.
const SAMPLE_LISTINGS = [
  { address: '2200 S Lamar Blvd, Austin, TX 78704', headline: 'Renovated bungalow in South Austin', priceUsd: 685000, beds: 3, baths: 2, sqft: 1740, propertyType: 'Single-family', status: 'ACTIVE' as const, description: 'Updated kitchen, large backyard, walkable to shops and parks.', highlights: ['New roof (2024)', 'Quartz counters', 'Detached studio'] },
  { address: '4200 Avenue B, Austin, TX 78751', headline: 'Coming soon — modern 4BR', priceUsd: 815000, beds: 4, baths: 3, sqft: 2410, propertyType: 'Single-family', status: 'COMING_SOON' as const, description: 'Open-concept layout, energy-efficient build, oversized garage.', highlights: ['Solar-ready', 'Smart-home wired', 'Cul-de-sac'] },
  { address: '3300 Duval St, Austin, TX 78705', headline: 'Downtown-adjacent condo', priceUsd: 449000, beds: 2, baths: 2, sqft: 1120, propertyType: 'Condo', status: 'ACTIVE' as const, description: 'Corner unit with skyline views, covered parking, community pool.', highlights: ['HOA covers water', 'Gated', 'Top floor'] },
]

/**
 * Create (or refresh) the direct-line tenant end-to-end: tenant →
 * entitlements → Orby provisioned with the SAME demo persona as the sandbox
 * (John Brown · Austin Realtors) → INBOUND channel → 3 sample listings
 * (+ free enrichment). Idempotent: re-running republishes a new DNA version
 * and leaves existing listings in place. Returns the routing target the voice
 * webhook needs.
 */
export async function seedMarketingReceptionTenant(): Promise<{ tenantId: string; channelConfigId: string }> {
  // provisionAgentOrby needs an actor user id — attribute to a platform-staff
  // user (roles live on TenantMember.roleDefinition), falling back to any user.
  const staff = await prisma.tenantMember.findFirst({
    where:  { roleDefinition: { isPlatformRole: true } },
    select: { userId: true },
  })
  const actorId = staff?.userId ?? (await prisma.user.findFirst({ select: { id: true } }))?.id
  if (!actorId) throw new Error('seedMarketingReceptionTenant: no user to attribute provisioning')

  let tenant = await prisma.tenant.findUnique({ where: { slug: MARKETING_TENANT_SLUG } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug:              MARKETING_TENANT_SLUG,
        displayName:       'MyOrbisAgents Direct Line',
        registrationEmail: 'reception@myorbisagents.com',
        isDemo:            true,               // excluded from rosters; bookings send the demo confirmation email
        industryVertical:  'REAL_ESTATE',      // demoKind stays null → SANDBOX reset never wipes it
      },
    })
  }
  const tenantId = tenant.id

  await applyDemoEntitlements(tenantId)

  // Provision Orby with the demo persona (same as the sandbox) — publishes DNA
  // + enables the WIDGET channel.
  await provisionAgentOrby(tenantId, actorId, { ...DEMO_AGENT })

  // Enable INBOUND so the phone webhook can connect to this tenant's Orby.
  const inbound = await updateChannel(tenantId, 'INBOUND', { isEnabled: true })

  const existing = await prisma.listing.count({ where: { tenantId } })
  if (existing === 0) {
    const ids: string[] = []
    for (const l of SAMPLE_LISTINGS) {
      const row = await prisma.listing.create({ data: { tenantId, ...l } })
      ids.push(row.id)
    }
    // Free neighborhood enrichment, async + best-effort, spaced out (Overpass throttles).
    void (async () => {
      for (const id of ids) {
        await enrichListing(tenantId, id, true, { includePaid: false }).catch(() => {})
        await new Promise(res => setTimeout(res, 2500))
      }
    })()
  }

  return { tenantId, channelConfigId: inbound.id }
}

/** Resolve the direct-line tenant + its INBOUND channel for the voice webhook. */
export async function resolveMarketingReceptionTarget(): Promise<{ tenantId: string; channelConfigId: string } | null> {
  const t = await prisma.tenant.findUnique({
    where:   { slug: MARKETING_TENANT_SLUG },
    include: { channelConfigs: { where: { channelType: 'INBOUND' } } },
  })
  if (!t) return null
  return { tenantId: t.id, channelConfigId: t.channelConfigs[0]?.id ?? '' }
}
