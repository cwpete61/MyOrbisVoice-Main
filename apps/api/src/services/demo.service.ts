/**
 * Public "DEMO" sandbox tenant. Agents log in with DEMO/DEMO to explore the
 * dashboard; nothing they do persists (the tenant is periodically reset to this
 * seed — see the demo-reset job) and money/irreversible actions are blocked
 * (no money entitlements + the demo-guard middleware).
 *
 * seedDemoTenant  — build a rich, alive-looking RE agent (Orby + listings + a
 *                   few leads/showings) so every feature is explorable.
 * resetDemoTenant — wipe the mutable tenant data and re-seed. Idempotent.
 */
import { prisma } from '../lib/prisma.js'
import { provisionAgentOrby } from './agent-onboarding.service.js'
import { updateChannel } from './channel.service.js'
import { enrichListing } from './listing-enrichment.service.js'

// Stable widget publicKey embedded in the myorbisagents.com widget script.
// Re-pinned on every reseed so the marketing widget never 404s.
const DEMO_WIDGET_PUBLIC_KEY = 'd9fc8d95afd58d58a8f2e500a960d10cc81a6f75a12db97e'

// Entitlements the demo tenant gets. Safe/explorable ON; anything that costs
// money or has real-world effect OFF (so existing gates block it).
const DEMO_ENTITLEMENTS: Array<{ key: string; bool?: boolean; int?: number }> = [
  { key: 'widget_enabled', bool: true },
  { key: 'inbound_enabled', bool: true },
  { key: 'listing_limit', int: 20 },
  { key: 'kb_storage_mb', int: 50 },
  // OFF — real cost / irreversible
  { key: 'payments_enabled', bool: false },
  { key: 'max_phone_numbers', int: 0 },
  { key: 'sms_enabled', bool: false },
  { key: 'outbound_enabled', bool: false },
  { key: 'whatsapp_enabled', bool: false },
  { key: 'listing_tracking_numbers', bool: false },
  { key: 'listing_enrichment', bool: false }, // avoid burning our RentCast quota
]

// Shared by the SANDBOX (470) and the direct-line demo tenant (929) so both
// lines show the same for-sale AND for-rent inventory. Real, geocodable Austin
// addresses so free enrichment (population, hospitals, schools, flood) resolves.
// Rentals are soft-modeled — no rental field on Listing, so `priceUsd` holds the
// MONTHLY rent and the headline/description say "for rent / per month" so Orby
// treats them as rentals and runs the rental qualification.
export const SAMPLE_LISTINGS = [
  // For sale
  { address: '2200 S Lamar Blvd, Austin, TX 78704', headline: 'For sale — renovated bungalow in South Austin ($685,000)', priceUsd: 685000, beds: 3, baths: 2, sqft: 1740, propertyType: 'Single-family (for sale)', status: 'ACTIVE' as const, description: 'For sale at $685,000. Updated kitchen, large backyard, walkable to shops and parks.', highlights: ['New roof (2024)', 'Quartz counters', 'Detached studio'] },
  { address: '4200 Avenue B, Austin, TX 78751', headline: 'For sale — coming-soon modern 4BR ($815,000)', priceUsd: 815000, beds: 4, baths: 3, sqft: 2410, propertyType: 'Single-family (for sale)', status: 'COMING_SOON' as const, description: 'For sale at $815,000. Open-concept layout, energy-efficient build, oversized garage.', highlights: ['Solar-ready', 'Smart-home wired', 'Cul-de-sac'] },
  { address: '3300 Duval St, Austin, TX 78705', headline: 'For sale — downtown-adjacent condo ($449,000)', priceUsd: 449000, beds: 2, baths: 2, sqft: 1120, propertyType: 'Condo (for sale)', status: 'ACTIVE' as const, description: 'For sale at $449,000. Corner unit with skyline views, covered parking, community pool.', highlights: ['HOA covers water', 'Gated', 'Top floor'] },
  // For rent (priceUsd = monthly rent)
  { address: '1500 E Riverside Dr, Austin, TX 78741', headline: 'For rent — modern 2BR near Lady Bird Lake ($2,200/month)', priceUsd: 2200, beds: 2, baths: 2, sqft: 1050, propertyType: 'Apartment (for rent)', status: 'ACTIVE' as const, description: 'For rent at $2,200 per month. Modern 2-bed near Lady Bird Lake, in-unit laundry, covered parking. 12-month lease.', highlights: ['In-unit laundry', 'Pool + gym', 'Pet-friendly'] },
  { address: '900 W 23rd St, Austin, TX 78705', headline: 'For rent — 3BR house near UT campus ($3,100/month)', priceUsd: 3100, beds: 3, baths: 2, sqft: 1500, propertyType: 'House (for rent)', status: 'ACTIVE' as const, description: 'For rent at $3,100 per month. 3-bed house near UT, fenced yard, washer/dryer included. 12-month lease.', highlights: ['Fenced yard', 'Washer/dryer', 'Walk to campus'] },
]

// Booking config the availability tool actually reads (BusinessProfile, NOT the
// DNA): business hours Mon–Sat 9am–6pm with Sunday CLOSED, and a 2-hour minimum
// notice. Sunday must be explicit `null` — a missing day is treated as "open".
const DEMO_BUSINESS_HOURS = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: { open: '09:00', close: '18:00' },
  sun: null,
}

/** Upsert the demo tenant's BusinessProfile so searchAvailability offers only
 *  Mon–Sat 9–6 slots with a 2-hour minimum notice (earliest-first is already
 *  the tool's default ordering). Shared by both demo lines. */
export async function applyDemoBookingProfile(tenantId: string, brandName: string): Promise<void> {
  await prisma.businessProfile.upsert({
    where:  { tenantId },
    update: { businessHoursJson: DEMO_BUSINESS_HOURS, bookingMinNoticeMin: 120 },
    create: { tenantId, brandName, businessHoursJson: DEMO_BUSINESS_HOURS, bookingMinNoticeMin: 120 },
  })
}

export async function applyDemoEntitlements(tenantId: string): Promise<void> {
  for (const e of DEMO_ENTITLEMENTS) {
    const isBool = e.bool !== undefined
    await prisma.tenantEntitlement.upsert({
      where: { tenantId_key: { tenantId, key: e.key } },
      update: isBool ? { valueType: 'BOOLEAN', booleanValue: e.bool } : { valueType: 'INTEGER', integerValue: e.int },
      create: { tenantId, key: e.key, sourceType: 'ADMIN_OVERRIDE', ...(isBool ? { valueType: 'BOOLEAN', booleanValue: e.bool } : { valueType: 'INTEGER', integerValue: e.int }) },
    })
  }
}

/** Delete the mutable tenant-scoped data so a reset starts clean. */
async function wipeTenantData(tenantId: string): Promise<void> {
  // FULL wipe — every reset is a clean slate (no leftover leads/conversations/
  // appointments from a previous demo user, and no sample seed data). A caller's
  // own call still shows for the ~15 min until the next reset. The durable
  // DemoLead marketing table is separate and NOT wiped.
  // Order matters only where FKs restrict; most are onDelete cascade/setNull.
  await prisma.appointment.deleteMany({ where: { tenantId } })
  // Keep recent conversations (last 24h) so demo + test calls stay reviewable in
  // the cockpit and keep their recordings, instead of vanishing on the next
  // 15-min reset. A demo visitor only ever sees their OWN session (filtered by
  // demoSessionId), so retaining them never leaks across sessions. The contact/
  // listing deletes below only SetNull the kept conversations' refs. Older cruft
  // is still purged.
  await prisma.conversation.deleteMany({
    where: { tenantId, startedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  await prisma.listing.deleteMany({ where: { tenantId } })
  await prisma.contact.deleteMany({ where: { tenantId } })
  await prisma.channelConfig.deleteMany({ where: { tenantId } })
  await prisma.promptVersion.deleteMany({ where: { tenantId } })
  await prisma.businessDNA.deleteMany({ where: { tenantId } })
  // Clean up expired demo phone sessions (their calls were deleted above).
  await prisma.demoSession.deleteMany({ where: { tenantId, expiresAt: { lt: new Date() } } })
}

export async function seedDemoTenant(tenantId: string, userId: string): Promise<void> {
  // demoKind=SANDBOX marks this as the single shared generic demo — the only
  // one demo-reset wipes and the only inbound target for the no-caller-ID
  // fallback. Per-agent AGENT demos are excluded from both.
  await prisma.tenant.update({ where: { id: tenantId }, data: { isDemo: true, demoKind: 'SANDBOX', industryVertical: 'REAL_ESTATE' } })
  await applyDemoEntitlements(tenantId)

  // Orby (DNA + widget) via the real onboarding path.
  await provisionAgentOrby(tenantId, userId, {
    agentName: 'John Brown', brokerage: 'Austin Realtors', market: 'Austin metro',
    specialties: 'first-time buyers, luxury, relocation, rentals', bookingHours: 'Mon–Sat 9am–6pm', language: 'bilingual',
    listingsBrief: 'For sale: South Austin bungalow $685k, coming-soon 4BR, downtown condo. For rent: 2BR near Lady Bird Lake $2,200/mo, 3BR house near UT $3,100/mo.',
    leadTimeHours: 2,
  }, { skipEnrich: true })

  // Booking hours/notice the availability tool reads (Mon–Sat 9–6, 2h notice).
  await applyDemoBookingProfile(tenantId, 'John Brown · Austin Realtors')

  // Enable the INBOUND channel so PIN-bound demo phone calls (+1 470 517 3441)
  // can connect to the sandbox Orby. See demo-session.service.
  await updateChannel(tenantId, 'INBOUND', { isEnabled: true }).catch(() => {})

  // Pin a STABLE widget publicKey. provisionAgentOrby mints a fresh random key
  // each reseed, which invalidated the key hard-coded in the myorbisagents.com
  // widget embed (→ 404 "Failed to start session"). Force it back to the
  // embedded key every reseed so the marketing widget always connects.
  await prisma.channelConfig.updateMany({
    where: { tenantId, channelType: 'WIDGET' },
    data:  { publicKey: DEMO_WIDGET_PUBLIC_KEY },
  }).catch(() => {})

  // Sample listings.
  const listingIds: string[] = []
  for (const l of SAMPLE_LISTINGS) {
    const row = await prisma.listing.create({ data: { tenantId, ...l } })
    listingIds.push(row.id)
  }

  // Enrich them with FREE neighborhood context (Census population, OSM
  // hospitals/schools, FEMA flood, colleges) so demo Orby can answer
  // area questions. includePaid:false = no RentCast quota burn. Async +
  // best-effort so it never blocks the reset; each reseed refreshes.
  void (async () => {
    for (const id of listingIds) {
      await enrichListing(tenantId, id, true, { includePaid: false }).catch(() => {})
      // Space out the calls — Overpass (OSM) throttles back-to-back queries, so
      // without this only the first listing reliably gets hospitals/schools.
      await new Promise(res => setTimeout(res, 2500))
    }
  })()

  // NO sample leads / conversations / appointments. The demo starts EMPTY
  // (only Orby + listings) so a demo user sees THEIR own actions populate the
  // cockpit — clean "simulate your own usage." Their calls/bookings appear as
  // they make them; the durable DemoLead marketing table is untouched.
}

export async function resetDemoTenant(tenantId: string, userId: string): Promise<void> {
  await wipeTenantData(tenantId)
  await seedDemoTenant(tenantId, userId)
}
