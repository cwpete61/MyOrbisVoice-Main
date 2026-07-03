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
      businessName: brokerage ? `${agentName} · ${brokerage}` : `${agentName}, REALTOR®`,
      agentName: 'Orby',
      tagline: `${agentName}'s AI assistant — captures every lead, books every showing`,
      description: `Orby is the personal digital assistant for ${agentName}${brokerage ? ` of ${brokerage}` : ''}, a real-estate agent serving ${market}${specialties ? `, specializing in ${specialties}` : ''}. Orby answers buyer and seller questions, qualifies leads, and books showings 24/7.`,
      elevatorPitch: `Hi, I'm Orby — ${agentName}'s assistant. I can tell you about listings, answer questions about ${market}, and get you on ${agentName}'s calendar for a showing or a call. How can I help?`,
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
        'Buying or selling timeline',
        'Pre-approved / working with a lender (buyers)',
        'Target price range and area',
        `Currently working with another agent?`,
      ],
      discoveryQuestions: [
        'Are you looking to buy, sell, or both?',
        `What areas of ${market} are you focused on?`,
        'What is your ideal timeline?',
        'Have you spoken with a lender yet?',
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
      engagement: `Be a proactive, consultative agent — don't just answer questions, guide the conversation. Ask engaging, leading questions to learn what matters to this buyer, then connect it to the home and its neighborhood: e.g. "Are good schools a priority for you? This home is in ${market}'s district and has a few elementary schools within a mile." Ask about their commute ("Where do you work? I can tell you what's nearby"), lifestyle ("Do you want to be near parks, shops, restaurants?"), family/schools, and timeline. When you mention a listing, volunteer a relevant neighborhood fact from the Area facts in your context (nearby schools, hospitals, flood zone, walkability) rather than waiting to be asked. Keep it natural and helpful, never pushy, and never characterize an area as "good/bad" or steer by protected class — state facts and let the buyer decide.`,
    },
    appointmentJson: {
      appointmentTypes: [
        { name: 'Showing', duration: 45 },
        { name: 'Buyer/seller consult', duration: 30 },
      ],
      duration: 30,
      buffer: 15,
      leadTime: 12,
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
  try {
    const sales = await generateDnaSection(tenantId, 'sales', seed)
    if (sales && Array.isArray(sales.discoveryQuestions) && sales.discoveryQuestions.length) {
      dna.salesJson.discoveryQuestions = sales.discoveryQuestions as string[]
      if (Array.isArray(sales.qualificationCriteria) && sales.qualificationCriteria.length) {
        dna.salesJson.qualificationCriteria = sales.qualificationCriteria as string[]
      }
      ok = true
    }
  } catch { /* keep template */ }
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
): Promise<OnboardResult> {
  // Mark the tenant as a real-estate vertical so the dashboard chrome reskins to
  // "MyOrbisAgents" (see (dashboard)/layout useBrandName). Non-fatal.
  await prisma.tenant.update({ where: { id: tenantId }, data: { industryVertical: 'REAL_ESTATE' } }).catch(() => {})

  const dnaData = templateDNA(intake)
  const aiEnriched = await enrich(tenantId, intake, dnaData)

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
