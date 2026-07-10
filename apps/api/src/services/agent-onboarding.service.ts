/**
 * MyOrbisAgents — RE agent self-serve onboarding (Step 2).
 *
 * Automates the manual Chase provisioning chain: RE intake → build RE-shaped
 * Agent DNA (persona forced to "Orby", Fair-Housing guardrail) → publish →
 * enable the WIDGET channel (mints a publicKey) → return the embed + widget URL.
 *
 * DNA is templated deterministically from the intake so provisioning ALWAYS
 * produces valid, working DNA with no external dependency. When an OpenAI key
 * is configured we best-effort enrich the narrative sections (identity pitch,
 * sales discovery) via `generateDnaSection`; failures degrade to the template.
 */
import { prisma } from '../lib/prisma.js'
import { createDNADraft, publishDNA } from './business-dna.service.js'
import { updateChannel } from './channel.service.js'
import { generateDnaSection } from './ai-assist.service.js'

const GATEWAY_URL = process.env.WIDGET_GATEWAY_URL || 'https://gateway.myorbisvoice.com'

export type OnboardLanguage = 'en' | 'es' | 'bilingual'

export interface AgentIntake {
  agentName: string // the human agent, e.g. "Chase Horner"
  brokerage?: string
  market: string // e.g. "Atlanta metro"
  specialties?: string // "luxury, first-time buyers, relocation"
  listingsBrief?: string // freeform highlights Orby may mention
  bookingHours?: string // "Mon-Sat 9am-6pm"
  bookingUrl?: string // scheduling link if they have one
  language?: OnboardLanguage
  leadTimeHours?: number // min booking notice in hours (DNA display; default 12)
}

export interface OnboardResult {
  dnaId: string
  dnaVersion: number
  publicKey: string
  embedCode: string
  widgetUrl: string
  aiEnriched: boolean
}

const FAIR_HOUSING =
  'Never steer buyers toward or away from neighborhoods based on race, color, religion, sex, disability, familial status, or national origin. Do not answer "is this a good area for [protected class]" — offer objective data (schools, commute, amenities) and let the buyer decide.'

function primaryLang(l?: OnboardLanguage): string {
  return l === 'es' ? 'es' : 'en'
}

/** Deterministic RE DNA templated from the intake. Always valid. */
function templateDNA(intake: AgentIntake) {
  const { agentName, brokerage, market, specialties, listingsBrief, bookingHours, bookingUrl } = intake
  const persona = `Orby, ${agentName}'s personal digital assistant`
  const bilingual = intake.language === 'bilingual'

  return {
    identityJson: {
      businessName: brokerage ? `${agentName} of ${brokerage}` : `${agentName}, REALTOR®`,
      agentName: 'Orby',
      tagline: `${agentName}'s AI assistant — captures every lead, books every showing`,
      description: `Orby is the personal digital assistant for ${agentName}${brokerage ? ` of ${brokerage}` : ''}, a real-estate agent serving ${market}${specialties ? `, specializing in ${specialties}` : ''}. Orby answers buyer and seller questions, qualifies leads, and books showings 24/7.`,
      elevatorPitch: `Hi, I'm Orby — ${agentName}'s assistant. I can tell you about listings for sale or for rent, answer questions about ${market}, and get you on ${agentName}'s calendar for a showing or a call.${bilingual ? ' Y también hablo español, si prefieres.' : ''} How can I help?`,
      tone: 'Warm, professional, and helpful. Never pushy.',
      industry: 'Real Estate',
      type: 'Real estate agent / ISA',
      targetCustomers: `Home buyers and sellers in ${market}${specialties ? ` (${specialties})` : ''}.`,
    },
    servicesJson: {
      services: [
        { name: 'Buyer representation', description: `Helping buyers find and purchase homes in ${market}.` },
        { name: 'Seller representation / listings', description: 'Listing and marketing homes for sale.' },
        { name: 'Showings & consultations', description: 'Booked to the agent calendar.' },
      ],
      listingHighlights: listingsBrief?.trim() || '',
      serviceArea: market,
    },
    pricingJson: {
      pricingModel: 'Commission-based (standard real-estate representation).',
      startingPrice: '',
      notes: 'Orby never quotes commission rates or gives legal/financial advice — it defers those to the agent.',
    },
    operationsJson: {
      businessHours: {},
      bookingHours: bookingHours?.trim() || 'Mon–Sat 9am–6pm',
      serviceArea: [market],
      holidays: [],
    },
    salesJson: {
      qualificationCriteria: [
        'Already working with another agent (confirm before booking a showing)',
        'Financing — paying cash, or financing and pre-approved / with a lender',
        'Buying/selling timeline — how soon',
        'Motivation — what is driving the move now',
        'Target price range, area, and commute',
        'Must-haves and deal-breakers',
        'Who else is part of the decision / attending the showing',
      ],
      discoveryQuestions: [
        'Are you looking to buy, sell, or both?',
        'Are you hoping to move soon, or just starting to look?',
        'Will you be financing or paying cash? (if financing: have you talked to a lender yet?)',
        'Are you already working with an agent, or still looking for the right one?',
        `What areas of ${market} matter most — and any must-haves or deal-breakers?`,
      ],
      callToAction: `Book a showing or a quick call with ${agentName}.`,
      objectionResponses: [],
      // Lead capture is the core job of an ISA ("captures every lead"). This
      // survives enrich() (which only replaces discoveryQuestions +
      // qualificationCriteria) and is JSON-stringified into the prompt's
      // "Sales rules" block, so Orby always asks for contact details.
      leadCapture: `Early in every conversation, naturally collect the caller's full name, email address, and phone number, then save the contact. Get all three before the call ends even if they are not ready to book — explain you'd like to send them details and have ${agentName} follow up. Never end without at least a name and one of email or phone.`,
      // Proactive, consultative selling — don't just answer, guide. Uses the
      // per-listing "Area facts" (schools/district/hospitals/flood/walkability)
      // in the listings context.
      engagement: `Be a proactive, consultative agent — don't just answer questions, guide the conversation. Ask engaging, leading questions to learn what matters to this buyer or renter, then connect it to the property and its neighborhood: e.g. "Are good schools a priority for you? This home is in ${market}'s district and has a few elementary schools within a mile." Ask about commute, lifestyle, family/schools, and timeline. When you mention a listing, volunteer a relevant neighborhood fact from the Area facts in your context (nearby schools, hospitals, flood zone, walkability) rather than waiting to be asked. Keep it natural and helpful, never pushy, and never characterize an area as "good/bad" or steer by protected class — state facts and let the caller decide. `
        + `${bilingual ? 'BILINGUAL — near the very start of the call, briefly let the caller know you also speak Spanish: say a short line in Spanish such as "Y también hablo español, si prefieres." Then continue in whichever language the caller uses. ' : ''}`
        + `PRE-SHOWING QUALIFICATION — timing and rules. Run qualification once the caller wants to SEE a property or book time with ${agentName}. If they are just asking a question (price, is it available, HOA), answer it FIRST, then invite them to book and qualify naturally. Weave the questions into the booking conversation, framed warmly ("so ${agentName} makes the most of your time"). ALWAYS ASK them — do not skip — but NEVER hard-gate the appointment: if the caller is reluctant, book anyway and note what is still missing. `
        + `FOR A SALE (buying): confirm (1) are they already working with another agent — ALWAYS ask this, and IF YES, ask whether they are already under contract (an exclusive buyer's agreement) with that agent, and note it for ${agentName} (a buyer already under contract with another agent is a procuring-cause / ethics concern ${agentName} must know before showing); (2) financing — paying cash or financing; if financing, are they PRE-APPROVED and do they have a pre-approval letter (if cash, proof of funds); (3) how soon they want to move, (4) what's driving the move, (5) target area/price and any must-haves or deal-breakers, (6) who else is deciding or attending. Confirming the pre-approval letter / proof of funds before a showing is standard — ask for it every time. Do NOT ask for sensitive figures (exact income, exact credit score, debts) — leave those for ${agentName}. `
        + `FOR A RENTAL: qualify differently — confirm (1) desired move-in date, (2) lease length wanted, (3) monthly budget, (4) roughly whether their income comfortably covers the rent (a ballpark, never an exact figure), (5) general credit standing (rough tier only — excellent / good / fair — never an exact score), (6) employment status, (7) number of occupants, (8) pets. Same warm framing, same no-hard-gate rule. `
        + `BOOKING — always propose the EARLIEST available slot first (business hours only, honoring the minimum notice), then offer one or two later alternatives. Read each slot's label aloud verbatim. `
        + `SHOWING BRIEF — when you book (or capture a serious lead), compile a short handoff for ${agentName}: for a sale — financing / pre-approval status, timeline, motivation, target price/area, must-haves and deal-breakers, who is deciding/attending; for a rental — move-in date, lease length, budget, occupants, pets, employment; plus any red flags — so ${agentName} walks in already knowing this caller. Keep it factual and Fair-Housing-safe (stated needs only, never profiling or steering).`,
    },
    appointmentJson: {
      appointmentTypes: [
        { name: 'Showing', duration: 45 },
        { name: 'Buyer/seller consult', duration: 30 },
      ],
      duration: 30,
      buffer: 15,
      leadTime: intake.leadTimeHours ?? 12,
      bookingUrl: bookingUrl?.trim() || '',
    },
    supportJson: {
      escalationConditions: [
        'Caller asks for legal, tax, or financing advice',
        'Caller is upset or asks for a human',
        'Offer / contract / price negotiation',
      ],
      faqItems: [],
      fallbackBehavior: `If unsure, offer to take a message and have ${agentName} follow up, or book a call.`,
    },
    languageJson: {
      primaryLanguage: primaryLang(intake.language),
      bilingual,
      tone: 'professional, warm',
      prohibitedWords: [],
    },
    complianceJson: {
      disclaimers: [
        'Orby is an AI assistant, not a licensed real-estate agent.',
        'Information is not a guarantee; verify details with the agent.',
      ],
      regulations: ['Fair Housing Act'],
      fairHousing: FAIR_HOUSING,
      recordingNotice: '',
    },
  }
}

/** Best-effort AI enrichment of narrative sections. Never throws. */
async function enrich(tenantId: string, intake: AgentIntake, dna: ReturnType<typeof templateDNA>): Promise<boolean> {
  const brief = `Real-estate agent ${intake.agentName}${intake.brokerage ? ` of ${intake.brokerage}` : ''} serving ${intake.market}${intake.specialties ? `, specialties: ${intake.specialties}` : ''}. The AI assistant is named "Orby". ${intake.listingsBrief ? `Current listings/highlights: ${intake.listingsBrief}` : ''}`
  const seed = { businessName: dna.identityJson.businessName, industry: 'Real Estate', brief, tone: 'warm, professional' }
  let ok = false
  try {
    const identity = await generateDnaSection(tenantId, 'identity', seed)
    if (identity && typeof identity.elevatorPitch === 'string') {
      dna.identityJson.elevatorPitch = identity.elevatorPitch as string
      if (typeof identity.tagline === 'string') dna.identityJson.tagline = identity.tagline as string
      ok = true
    }
  } catch { /* keep template */ }
  // NOTE: we deliberately do NOT AI-generate the sales discovery questions.
  // For a real-estate agent, the template's questions are BUYER qualification
  // ("buying or selling?", "financing or cash?", "which areas / must-haves?").
  // The generic 'sales' enrichment drifted to product-sales questions ("how do
  // you manage your listings?", "what features would you want in an AI
  // assistant?") — i.e. talking to the agent about buying software, not to a
  // home buyer about a showing. That regressed the demo Orby. The template
  // buyer questions + the pre-showing qualification in `engagement` are the
  // source of truth; keep them.
  return ok
}

/**
 * Provision Orby for a real-estate tenant end-to-end.
 * Reuses createDNADraft → publishDNA → updateChannel(WIDGET). Idempotent-ish:
 * re-running creates a new DNA version and republishes; the widget publicKey
 * is preserved once minted.
 */
export async function provisionAgentOrby(
  tenantId: string,
  userId: string,
  intake: AgentIntake,
  /** skipEnrich: use the deterministic template DNA verbatim, no AI enrichment.
   *  Set for demo tenants — the AI 'enrich' step drifts (it once rewrote the
   *  buyer discovery questions into product-sales questions), and the demo needs
   *  a stable, predictable script that survives the 15-min reset. */
  opts?: { skipEnrich?: boolean },
): Promise<OnboardResult> {
  // Mark the tenant as a real-estate vertical so the dashboard chrome reskins to
  // "MyOrbisAgents" (see (dashboard)/layout useBrandName). Non-fatal.
  await prisma.tenant.update({ where: { id: tenantId }, data: { industryVertical: 'REAL_ESTATE' } }).catch(() => {})

  const dnaData = templateDNA(intake)
  const aiEnriched = opts?.skipEnrich ? false : await enrich(tenantId, intake, dnaData)

  const draft = await createDNADraft(tenantId, dnaData)
  await publishDNA(tenantId, draft.id, userId)

  const channel = await updateChannel(tenantId, 'WIDGET', { isEnabled: true })
  const publicKey = channel.publicKey ?? ''

  const embedCode =
    `<script src="${GATEWAY_URL}/widget/orbisvoice-widget.js"></script>\n` +
    `<script>OrbisVoice.init({ publicKey: "${publicKey}" })</script>`

  return {
    dnaId: draft.id,
    dnaVersion: draft.version,
    publicKey,
    embedCode,
    widgetUrl: `${GATEWAY_URL}/widget/demo?publicKey=${publicKey}`,
    aiEnriched,
  }
}
