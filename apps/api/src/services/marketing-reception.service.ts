/**
 * MyOrbisAgents public reception line (+1 929 640 3810).
 *
 * A dedicated, platform-owned tenant whose Orby is the BRAND receptionist for
 * MyOrbisAgents — NOT a sample agent persona (that's the SANDBOX demo on the
 * 470 line) and NOT a paying customer. It answers the public marketing number
 * instantly (no PIN, no cockpit binding) and has two jobs:
 *   1. Pitch the product to a prospective AGENT customer and capture them as a
 *      lead (name / email / phone / market / pain).
 *   2. If the caller says "test me" or asks about a listing, drop into demo
 *      mode and behave exactly like their future Orby would for a home buyer —
 *      using the 3 sample listings seeded here — so they EXPERIENCE the product.
 *
 * The tenant is marked isDemo (so it's excluded from paying-tenant rosters) but
 * carries NO demoKind, so the 15-min SANDBOX reset job never touches it.
 */
import { prisma } from '../lib/prisma.js'
import { createDNADraft, publishDNA } from './business-dna.service.js'
import { updateChannel } from './channel.service.js'
import { enrichListing } from './listing-enrichment.service.js'
import { applyDemoEntitlements } from './demo.service.js'

/** Public direct-dial line — instant Orby, no PIN. Distinct from DEMO_PHONE. */
export const DIRECT_PHONE_E164 = '+19296403810'

/** Stable slug used to resolve the reception tenant at call time. */
export const MARKETING_TENANT_SLUG = 'myorbisagents-reception'

// Same 3 geocodable Austin addresses the sandbox uses, so free enrichment
// (population, hospitals, schools, flood) resolves and Orby can answer area
// questions when a prospect asks to "test it on a listing".
const SAMPLE_LISTINGS = [
  { address: '2200 S Lamar Blvd, Austin, TX 78704', headline: 'Renovated bungalow in South Austin', priceUsd: 685000, beds: 3, baths: 2, sqft: 1740, propertyType: 'Single-family', status: 'ACTIVE' as const, description: 'Updated kitchen, large backyard, walkable to shops and parks.', highlights: ['New roof (2024)', 'Quartz counters', 'Detached studio'] },
  { address: '4200 Avenue B, Austin, TX 78751', headline: 'Coming soon — modern 4BR', priceUsd: 815000, beds: 4, baths: 3, sqft: 2410, propertyType: 'Single-family', status: 'COMING_SOON' as const, description: 'Open-concept layout, energy-efficient build, oversized garage.', highlights: ['Solar-ready', 'Smart-home wired', 'Cul-de-sac'] },
  { address: '3300 Duval St, Austin, TX 78705', headline: 'Downtown-adjacent condo', priceUsd: 449000, beds: 2, baths: 2, sqft: 1120, propertyType: 'Condo', status: 'ACTIVE' as const, description: 'Corner unit with skyline views, covered parking, community pool.', highlights: ['HOA covers water', 'Gated', 'Top floor'] },
]

const FAIR_HOUSING =
  'Never steer by, or ask about, protected class (race, color, religion, sex, familial status, national origin, disability). ' +
  'State facts about a home or area and let the caller decide — never characterize a neighborhood as good or bad.'

/** Brand-voice DNA for the MyOrbisAgents reception Orby. */
function marketingDNA() {
  return {
    identityJson: {
      businessName: 'MyOrbisAgents',
      agentName: 'Orby',
      tagline: 'The AI receptionist MyOrbisAgents builds for real-estate agents',
      description: 'Orby is the AI receptionist MyOrbisAgents sets up for real-estate agents: it answers every call, catches missed and after-hours calls, qualifies buyers, books showings, and hands the agent a Showing Brief before each appointment — in English and Spanish, 24/7. Orby augments the agent; it never replaces them. The agent still closes.',
      elevatorPitch: "Hi, I'm Orby — the AI receptionist MyOrbisAgents sets up for real-estate agents. I catch every missed call, qualify your buyers, and book your showings so you never lose a lead. Want to hear how I'd work for you, or test me on a sample listing?",
      tone: 'Warm, confident, consultative. Sells by being helpful, never pushy or hypey.',
      industry: 'Real Estate SaaS / AI receptionist',
      type: 'Product reception line',
      targetCustomers: 'Solo and small-team real-estate agents, including agents who serve Spanish-speaking (Latino) buyers.',
    },
    servicesJson: {
      services: [
        { name: 'Missed-call & after-hours capture', description: "Orby answers when the agent can't — nights, weekends, showings — so no lead goes to voicemail." },
        { name: 'Buyer qualification', description: 'Orby learns budget, timeline, financing, motivation, and must-haves, warmly and Fair-Housing-safe.' },
        { name: 'Showing booking', description: "Orby books qualified buyers straight onto the agent's calendar." },
        { name: 'Showing Brief', description: 'Before each appointment Orby hands the agent a short brief — financing, timeline, motivation, must-haves — so they walk in ready to close.' },
        { name: 'Bilingual', description: 'Orby speaks English and Spanish so agents capture Latino buyers too.' },
      ],
      listingHighlights: 'Sample listings for a live test: a renovated South Austin bungalow at $685k, a coming-soon modern 4BR, and a downtown-adjacent condo.',
      serviceArea: 'US real-estate agents. Sample listings are in Austin, TX for demonstration.',
    },
    pricingJson: {
      pricingModel: 'Simple monthly or yearly subscription. Two tiers: a lead-capture plan (Solo Capture) and a full-power plan (Solo Power) with outbound, SMS, and more.',
      startingPrice: '',
      notes: "Don't hard-quote dollar amounts — plans and current pricing live on the pricing page. Offer to text the pricing page or set up a quick call to find the right fit. Sell the value (a single saved commission pays for the year), not the price tag.",
    },
    operationsJson: {
      businessHours: {},
      bookingHours: 'Anytime — Orby answers 24/7. Setup calls Mon–Fri 9am–6pm.',
      serviceArea: ['United States'],
      holidays: [],
    },
    salesJson: {
      qualificationCriteria: [
        'Solo agent or a team',
        'Where they lose the most leads — missed calls, after-hours, weekends, follow-up',
        'Whether they serve Spanish-speaking buyers',
        'Rough volume — showings or leads per week',
        'How soon they want to get started',
      ],
      discoveryQuestions: [
        'Are you a solo agent or part of a team?',
        'Where do you lose the most leads right now — missed calls, after-hours, or follow-up?',
        'Do you work with Spanish-speaking buyers at all?',
        'Roughly how many showings or new leads do you handle in a week?',
        'Want me to show you how it feels — ask me about one of my sample listings?',
      ],
      callToAction: 'Get their contact details, then offer a quick setup call or send the pricing page / signup link.',
      objectionResponses: [
        "\"Will it replace me?\" — No. Orby is your receptionist, not your replacement. It catches the calls you miss and hands warm, qualified buyers back to you. You still show the home and close the deal.",
        "\"I already miss calls and it's fine\" — Every missed call is a buyer who calls the next agent. One saved commission pays for Orby for a year.",
        "\"Sounds complicated\" — It's not. We set it up for you. You forward your calls; Orby does the rest.",
      ],
      // The lead here is a prospective AGENT customer, not a home buyer.
      leadCapture: "The caller is almost certainly a real-estate agent checking out Orby. Early and naturally, get their full name, email, and phone, plus their market/brokerage and what's costing them leads today (missed calls? after-hours? bilingual buyers?). Save the contact so the MyOrbisAgents team can follow up. Never end the call without at least a name and one of email or phone.",
      // Dual-mode: pitch, and on request BECOME the demo.
      engagement: 'You have two modes. DEFAULT — SELL: you are MyOrbisAgents\'s receptionist talking to a prospective agent customer. Ask what\'s costing them leads today (missed calls, after-hours, weekends, bilingual buyers) and connect Orby to it: "I catch those calls, qualify the buyer, and book the showing — then hand you a Showing Brief so you walk in ready." Be consultative, never hypey. '
        + 'DEMO — if the caller says "test me", "let me try it", or asks about a listing, SWITCH and behave exactly like their future Orby would for a home buyer: answer questions about the sample listings and their neighborhoods from the Area facts in your context, qualify warmly, and offer to book a showing — so they EXPERIENCE the product instead of just hearing about it. Then come back and say "that\'s what your buyers would get, 24/7." '
        + 'ALWAYS: augmentation, never replacement — Orby makes the agent look instantly responsive; the agent still closes. Never quote exact prices (defer to the pricing page). Stay Fair-Housing-safe at all times.',
    },
    appointmentJson: {
      appointmentTypes: [
        { name: 'Setup call', duration: 20 },
        { name: 'Product walkthrough', duration: 30 },
      ],
      duration: 20,
      buffer: 10,
      leadTime: 4,
      bookingUrl: '',
    },
    supportJson: {
      escalationConditions: [
        'Caller wants to negotiate custom pricing or a contract',
        'Caller is upset or explicitly asks for a human',
        'Detailed technical/integration questions beyond setup basics',
      ],
      faqItems: [
        { q: 'Is Orby going to replace agents?', a: 'No. Orby is a receptionist that augments the agent — it catches missed calls and qualifies buyers; the agent still shows and closes.' },
        { q: 'Does it speak Spanish?', a: 'Yes — Orby is bilingual, English and Spanish.' },
        { q: 'How does setup work?', a: 'MyOrbisAgents sets it up; the agent forwards their calls and Orby handles the rest.' },
      ],
      fallbackBehavior: 'If unsure, take a message and have the MyOrbisAgents team follow up, or offer to send the pricing page and book a setup call.',
    },
    languageJson: {
      primaryLanguage: 'en',
      bilingual: true,
      tone: 'warm, confident, consultative',
      prohibitedWords: [],
    },
    complianceJson: {
      disclaimers: [
        'Orby is an AI receptionist, not a licensed real-estate agent.',
        'Orby augments real-estate agents; it does not replace them.',
      ],
      regulations: ['Fair Housing Act'],
      fairHousing: FAIR_HOUSING,
      recordingNotice: '',
    },
  }
}

/**
 * Create (or refresh) the MyOrbisAgents reception tenant end-to-end:
 * tenant → entitlements → brand DNA (published) → WIDGET + INBOUND channels →
 * 3 sample listings (+ free enrichment). Idempotent: re-running republishes a
 * new DNA version and leaves existing listings in place.
 * Returns the routing target the voice webhook needs.
 */
export async function seedMarketingReceptionTenant(): Promise<{ tenantId: string; channelConfigId: string }> {
  // DNA publish needs an actor user id — attribute to a platform-staff user
  // (roles live on TenantMember.roleDefinition), falling back to any user.
  const staff = await prisma.tenantMember.findFirst({
    where:  { roleDefinition: { isPlatformRole: true } },
    select: { userId: true },
  })
  const actorId = staff?.userId ?? (await prisma.user.findFirst({ select: { id: true } }))?.id
  if (!actorId) throw new Error('seedMarketingReceptionTenant: no user to attribute DNA publish')

  let tenant = await prisma.tenant.findUnique({ where: { slug: MARKETING_TENANT_SLUG } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug:              MARKETING_TENANT_SLUG,
        displayName:       'MyOrbisAgents Reception',
        registrationEmail: 'reception@myorbisagents.com',
        isDemo:            true,               // excluded from paying-tenant rosters
        industryVertical:  'REAL_ESTATE',      // demoKind stays null → SANDBOX reset never wipes it
      },
    })
  }
  const tenantId = tenant.id

  await applyDemoEntitlements(tenantId)

  const draft = await createDNADraft(tenantId, marketingDNA())
  await publishDNA(tenantId, draft.id, actorId)

  await updateChannel(tenantId, 'WIDGET', { isEnabled: true }).catch(() => {})
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

/** Resolve the reception tenant + its INBOUND channel for the voice webhook. */
export async function resolveMarketingReceptionTarget(): Promise<{ tenantId: string; channelConfigId: string } | null> {
  const t = await prisma.tenant.findUnique({
    where:   { slug: MARKETING_TENANT_SLUG },
    include: { channelConfigs: { where: { channelType: 'INBOUND' } } },
  })
  if (!t) return null
  return { tenantId: t.id, channelConfigId: t.channelConfigs[0]?.id ?? '' }
}
