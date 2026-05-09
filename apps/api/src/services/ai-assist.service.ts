/**
 * AI-assisted draft generation for the Business DNA editor.
 *
 * Tenants click "Generate with AI" on a section and we ask gpt-4o-mini for a
 * structured draft. Output is the raw section JSON shape, which the form then
 * pre-fills. Users still review and save manually.
 *
 * Implementation notes:
 *   - We call OpenAI via fetch (no SDK in apps/api) to avoid a new dependency.
 *   - We use JSON mode (response_format=json_object) so the model returns a
 *     parseable object every time.
 *   - On bad/missing JSON we retry once with a stricter user message; if that
 *     still fails we throw 422.
 *   - The platform OpenAI key is read via getOpenAiApiKey() — never from
 *     process.env directly.
 */

import { AppError } from '@voiceautomation/shared'
import { getOpenAiApiKey, getConfigValue } from './system-config.service.js'
import { resolveAggressionTier, type AggressionTier } from '../lib/aggression-tier.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_OUTPUT_TOKENS = 2000

export type DnaSection =
  | 'identity'
  | 'sales'
  | 'appointment'
  | 'support'
  | 'language'
  | 'operations'

export interface GenerationSeed {
  businessName?: string
  industry?: string
  brief?: string
  tone?: string
}

/* ─────────────────────────────────────────────────────────────────────────
 * Per-section prompt strategy
 *
 * Each entry defines the literal JSON example we show to the model and a
 * validator that confirms required keys are present after parse. The
 * validators are intentionally lenient about extra keys but strict about the
 * top-level shape so the form can render the result.
 * ──────────────────────────────────────────────────────────────────────── */

interface SectionSpec {
  description: string
  schemaExample: string
  validate: (parsed: unknown) => parsed is Record<string, unknown>
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

const SECTION_SPECS: Record<DnaSection, SectionSpec> = {
  identity: {
    description:
      'Generate the business identity for a voice agent: business name, agent persona name, tagline, descriptions, tone, industry, and target customers.',
    schemaExample: `{
  "businessName": "string — the actual company name",
  "agentName": "string — a friendly first name the AI agent will use to introduce itself (e.g. Sarah, Jordan, Alex). Pick something neutral and easy to pronounce. Optional but recommended.",
  "tagline": "short string under 80 chars",
  "shortDescription": "1-2 sentences for general use",
  "elevatorPitch": "2-3 sentences, conversational, what we do and who for",
  "tone": "1 sentence describing how the agent should sound",
  "voicePreference": "leave empty unless seed specifies",
  "industry": "string",
  "targetCustomers": "1 sentence describing who you serve"
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      const required = ['businessName', 'shortDescription', 'elevatorPitch', 'tone', 'industry', 'targetCustomers']
      return required.every((k) => typeof p[k] === 'string')
    },
  },
  sales: {
    description:
      'Generate a sales playbook for a voice agent: who is a good-fit caller, discovery questions, demo flow, and objection handling.',
    schemaExample: `{
  "qualificationCriteria": ["3-5 string criteria for who's a good-fit caller"],
  "discoveryQuestions": ["4-6 conversational discovery questions"],
  "demoFlow": "1-2 sentences describing how a demo/intake call should flow",
  "objectionHandling": {
    "tooExpensive": "1-2 sentence response",
    "concernsAboutAi": "1-2 sentence response",
    "privacy": "1-2 sentence response"
  }
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      if (!Array.isArray(p['qualificationCriteria'])) return false
      if (!Array.isArray(p['discoveryQuestions'])) return false
      if (typeof p['demoFlow'] !== 'string') return false
      if (!isObj(p['objectionHandling'])) return false
      return true
    },
  },
  appointment: {
    description:
      'Generate appointment booking rules for a voice agent: default duration, appointment types, booking and cancellation policies.',
    schemaExample: `{
  "defaultDuration": 30,
  "appointmentTypes": [{ "name": "string", "duration": 30, "description": "string" }],
  "bookingPolicy": "1-2 sentences on default scheduling rules",
  "cancellationPolicy": "1-2 sentences on cancellations and no-shows"
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      if (typeof p['defaultDuration'] !== 'number') return false
      if (!Array.isArray(p['appointmentTypes'])) return false
      if (typeof p['bookingPolicy'] !== 'string') return false
      if (typeof p['cancellationPolicy'] !== 'string') return false
      return true
    },
  },
  support: {
    description:
      'Generate a customer-support playbook for a voice agent: common issues with fixes, and escalation rules.',
    schemaExample: `{
  "commonIssues": [{ "issue": "string", "fix": "1-2 sentences" }],
  "escalationRules": ["3-5 strings — when to escalate to a human"],
  "supportEmail": "leave empty unless seed specifies",
  "founderContact": "leave empty unless seed specifies"
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      if (!Array.isArray(p['commonIssues'])) return false
      if (!Array.isArray(p['escalationRules'])) return false
      return true
    },
  },
  language: {
    description:
      'Generate language preferences for a voice agent: vocabulary it should prefer and language it must never use.',
    schemaExample: `{
  "primaryLanguage": "English",
  "supportedLanguages": ["English"],
  "vocabularyPreferences": ["3-5 words/phrases the agent should prefer"],
  "prohibitedLanguage": ["3-5 things the agent should never say or claim"]
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      if (typeof p['primaryLanguage'] !== 'string') return false
      if (!Array.isArray(p['supportedLanguages'])) return false
      if (!Array.isArray(p['vocabularyPreferences'])) return false
      if (!Array.isArray(p['prohibitedLanguage'])) return false
      return true
    },
  },
  operations: {
    description:
      'Generate ONLY the after-hours behavior policy for a voice agent. Do NOT generate timezone or business hours — those are factual config the user must set.',
    schemaExample: `{
  "afterHoursBehavior": "2-3 sentence policy for what the agent does outside business hours"
}`,
    validate: (p): p is Record<string, unknown> => {
      if (!isObj(p)) return false
      return typeof p['afterHoursBehavior'] === 'string' && p['afterHoursBehavior'].length > 0
    },
  },
}

/* ─────────────────────────────────────────────────────────────────────────
 * Marketing voice overlay — encodes the active Aggression Tier into a
 * paragraph the model gets prepended to its system prompt. Source of truth:
 * docs/marketing-style-guide.md (the 4-tier Aggression Spectrum + voice
 * rules per tier). Universal anti-patterns are also injected so even
 * Aggressive output stays truthful.
 * ──────────────────────────────────────────────────────────────────────── */

const TIER_VOICE: Record<AggressionTier, string> = {
  conservative:
    'Use a calm, professional, fact-based voice. No exclamation points. ' +
    'No urgency tactics or scarcity language. CTAs are invitations ("Schedule a consultation," "Learn more"). ' +
    'Statements over claims. Specific numbers cited where used. Tone matches what dental practices, law firms, ' +
    'and B2B services expect from a vendor email — restrained, credible, never pushy.',
  balanced:
    'Use a modern direct-response voice — emotional but credible. Soft urgency only when there is a real ' +
    'reason ("limited slots this week," "we onboard 5 tenants per month"). CTAs are direct but inviting ' +
    '("Get your free walkthrough," "See if this fits"). Mix story and proof. PAS framing (problem → ' +
    'agitate → solve) works well. This is the default tone for most service businesses; the reader should ' +
    'feel respected, not sold-to.',
  direct:
    'Use a hard direct-response voice — story-led, urgency built in, hard offers. Specific deadlines and ' +
    'real bonuses required. Cost-of-delay framing. Hard CTAs ("Claim your spot before midnight Sunday," ' +
    '"This price ends Friday"). Some emotional intensity. AIDA structure (attention → interest → desire → ' +
    'action). The reader should feel a clear choice in front of them, with consequences for not deciding.',
  aggressive:
    'Use a high-intensity launch voice. Caps and intensifiers used sparingly but deliberately for emphasis. ' +
    'Stacked offers and bonuses. Pattern interrupts in subject lines. "STOP losing X" / "DO NOT miss this" ' +
    'framing is allowed. ALL claims must remain truthful — invent nothing, cite real numbers. This tier is ' +
    'for short windows (Black Friday, launches); use sparingly.',
}

const UNIVERSAL_RULES =
  'Universal rules (apply at every tier — no exceptions): ' +
  '(1) Numbers must be sourceable — cite Forbes / HBR / BIA-Kelsey / a stated industry source on every statistic, ' +
  'or omit the number. ' +
  '(2) Stories must be either real (with a real customer to point to) OR explicitly labeled hypothetical. ' +
  'Never fabricate quoted customers. ' +
  '(3) Urgency must be enforceable. Real deadlines must trigger; fake urgency burns trust. ' +
  '(4) Avoid LLM hedging ("might be worth considering," "potentially," "just wanted to reach out"). ' +
  '(5) Avoid owner-centered openings ("we are excited to..."). ' +
  '(6) Avoid adjective stacking ("powerful, intuitive, beautiful platform") — stack proof, not adjectives. ' +
  '(7) Avoid generic social proof ("trusted by businesses worldwide"); use specific numbers or none.'

export function buildVoiceOverlay(tier: AggressionTier): string {
  return [
    `Marketing voice tier: ${tier.toUpperCase()}.`,
    TIER_VOICE[tier],
    '',
    UNIVERSAL_RULES,
  ].join('\n')
}

/* ─────────────────────────────────────────────────────────────────────────
 * Prompt construction
 * ──────────────────────────────────────────────────────────────────────── */

function buildSystemPrompt(section: DnaSection, tone: string, voiceOverlay: string): string {
  const spec = SECTION_SPECS[section]
  return [
    voiceOverlay,
    '',
    `You draft Business DNA content for a voice-agent SaaS. ${spec.description}`,
    '',
    'Hard rules:',
    `- Tone the agent should sound like: ${tone}.`,
    '- Do NOT invent facts. No specific prices, no specific employee names, no claims of certifications, awards, or guarantees.',
    '- Stay relevant to the industry the user provides. If the industry is vague, write for a general small business.',
    '- Keep content short, plain-language, and conversational. Non-technical business owners will read this.',
    '- Return ONLY a single JSON object, no prose, no markdown, no code fences. The JSON must match this exact top-level shape:',
    spec.schemaExample,
    '',
    'If a field in the example says "leave empty unless seed specifies", return an empty string for it unless the user input clearly contains that detail.',
  ].join('\n')
}

function buildUserPrompt(seed: GenerationSeed, strict = false): string {
  const lines: string[] = []
  lines.push('Tenant input:')
  lines.push(`- Business name: ${seed.businessName?.trim() || '(not provided)'}`)
  lines.push(`- Industry: ${seed.industry?.trim() || '(general small business)'}`)
  lines.push(`- What the business does: ${seed.brief?.trim() || '(not provided — infer from business name and industry)'}`)
  lines.push(`- Tone preference: ${seed.tone?.trim() || 'professional, warm, conversational'}`)
  lines.push('')
  lines.push('Generate the section now. Return ONLY the JSON object.')
  if (strict) {
    lines.push('')
    lines.push('IMPORTANT: Your previous response was malformed. Return strictly valid JSON matching the example shape exactly. No surrounding text.')
  }
  return lines.join('\n')
}

/* ─────────────────────────────────────────────────────────────────────────
 * OpenAI call (fetch-based, no SDK)
 * ──────────────────────────────────────────────────────────────────────── */

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

async function callOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    throw new AppError(
      isAbort ? 'TIMEOUT' : 'UPSTREAM_ERROR',
      isAbort ? 'AI is taking too long, try again.' : 'Could not reach the AI service.',
      isAbort ? 504 : 502,
    )
  }
  clearTimeout(timer)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[ai-assist] OpenAI returned non-2xx:', res.status, text.slice(0, 500))
    throw new AppError(
      'UPSTREAM_ERROR',
      `AI service returned ${res.status}.`,
      502,
    )
  }

  const json = (await res.json().catch(() => null)) as ChatCompletionResponse | null
  const content = json?.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new AppError('UPSTREAM_ERROR', 'AI returned an empty response.', 502)
  }
  return content
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public entry point
 * ──────────────────────────────────────────────────────────────────────── */

export async function generateDnaSection(
  tenantId: string,
  section: DnaSection,
  seed: GenerationSeed,
): Promise<Record<string, unknown>> {
  const spec = SECTION_SPECS[section]
  if (!spec) {
    throw new AppError('BAD_REQUEST', `Unsupported section: ${section}`, 400)
  }

  const apiKey = await getOpenAiApiKey()
  if (!apiKey) {
    throw new AppError(
      'NOT_CONFIGURED',
      'OpenAI API key is not set in system config.',
      502,
    )
  }
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'
  const tone = seed.tone?.trim() || 'professional, warm, conversational'

  // Active marketing voice tier from the tenant's BusinessProfile (default
  // 'balanced'). Per-call campaign overrides aren't relevant here because
  // DNA generation is a tenant-level operation, not per-campaign.
  const tier = await resolveAggressionTier(tenantId)
  const voiceOverlay = buildVoiceOverlay(tier)

  const systemPrompt = buildSystemPrompt(section, tone, voiceOverlay)

  // First attempt
  const first = await callOpenAi(apiKey, model, systemPrompt, buildUserPrompt(seed, false))
  let parsed: unknown
  try {
    parsed = JSON.parse(first)
  } catch {
    parsed = null
  }
  if (parsed && spec.validate(parsed)) {
    return parsed
  }

  // Second attempt — stricter user message
  const second = await callOpenAi(apiKey, model, systemPrompt, buildUserPrompt(seed, true))
  try {
    parsed = JSON.parse(second)
  } catch {
    parsed = null
  }
  if (parsed && spec.validate(parsed)) {
    return parsed
  }

  throw new AppError(
    'AI_INVALID_RESPONSE',
    "AI couldn't generate valid content — try again or fill manually.",
    422,
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Campaign email generator
 *
 * Given a brief + optional context (campaign name, trigger tag, business
 * snippet), generate a subject line + body that follow the active marketing
 * voice tier. Source frameworks: PAS (Balanced), AIDA (Direct), Caples-style
 * subject formulas. Per-campaign aggressionTier overrides the tenant default
 * via resolveAggressionTier(tenantId, campaignId).
 * ──────────────────────────────────────────────────────────────────────── */

export interface CampaignEmailSeed {
  brief:        string                  // What the email is about — "remind booked patients about tomorrow's appointment"
  campaignName?: string                 // Optional context — "Booking Confirmation"
  triggerTag?:   string                 // Optional context — "booked"
  businessName?: string                 // Pulled from BusinessProfile when present
  audience?:    string                  // "patients with confirmed appointments" / "leads who hung up"
}

export interface CampaignEmailDraft {
  subject: string
  body:    string
  tier:    AggressionTier
}

export async function generateCampaignEmail(
  tenantId: string,
  seed: CampaignEmailSeed,
  campaignId?: string | null,
): Promise<CampaignEmailDraft> {
  if (!seed.brief?.trim()) {
    throw new AppError('BAD_REQUEST', 'Brief is required.', 400)
  }

  const apiKey = await getOpenAiApiKey()
  if (!apiKey) {
    throw new AppError(
      'NOT_CONFIGURED',
      'OpenAI API key is not set in system config.',
      502,
    )
  }
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'

  const tier = await resolveAggressionTier(tenantId, campaignId ?? null)
  const voiceOverlay = buildVoiceOverlay(tier)

  // Framework guidance varies by tier — per docs/marketing-style-guide.md
  const framework =
    tier === 'conservative' ? 'BAB (Before, After, Bridge) or 4Ps (Promise, Picture, Proof, Push). Lead with the customer-as-hero, not the brand.'
    : tier === 'balanced'   ? 'PAS (Problem, Agitate, Solve). State the situation, twist the knife once with a specific cost-of-inaction, then offer the solution.'
    : tier === 'direct'     ? 'AIDA (Attention, Interest, Desire, Action). Open with a Caples-style specific-benefit hook. Build urgency with a real deadline. End with a hard CTA.'
    : 'AIDA + Kennedy offer formula. Lead with a pattern interrupt. Stack a specific offer + real deadline + cost-of-delay. Close hard.'

  const systemPrompt = [
    voiceOverlay,
    '',
    'You are drafting a SINGLE outbound email for a small service business.',
    '',
    `Framework to follow: ${framework}`,
    '',
    'Structural rules:',
    '- Subject line: 6-10 words, customer-focused, specific. Caples-style ("How to...", "Why...", "[Specific benefit] in [specific time]"). No emojis except at "aggressive" tier.',
    '- Body: 80-180 words for conservative/balanced, 100-220 for direct/aggressive. Short paragraphs (1-3 sentences each). White space matters.',
    '- Use {firstName}, {businessName}, {appointmentDate}, {appointmentTime} as merge tokens where contextually appropriate. Do not invent merge tokens.',
    '- One CTA. The CTA reflects the tier (invitation at conservative; direct at balanced; hard at direct/aggressive).',
    '- Plain text. No HTML tags, no markdown formatting, no signature block (the platform appends one).',
    '',
    'Return ONLY a single JSON object: { "subject": string, "body": string }. No prose, no markdown, no code fences.',
  ].join('\n')

  const userPrompt = [
    'Brief from the tenant:',
    seed.brief.trim(),
    '',
    'Context:',
    `- Business name: ${seed.businessName?.trim() || '(pulled from {businessName} merge token at send time)'}`,
    `- Campaign name: ${seed.campaignName?.trim() || '(not provided)'}`,
    `- Trigger tag: ${seed.triggerTag?.trim() || '(not provided)'}`,
    `- Audience: ${seed.audience?.trim() || '(infer from the brief)'}`,
    '',
    'Generate the email now. Return ONLY the JSON object.',
  ].join('\n')

  const tryParse = (raw: string): CampaignEmailDraft | null => {
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return null }
    if (!isObj(parsed)) return null
    const subject = parsed['subject']
    const body    = parsed['body']
    if (typeof subject !== 'string' || typeof body !== 'string') return null
    if (subject.length < 4 || body.length < 30) return null
    return { subject: subject.trim(), body: body.trim(), tier }
  }

  const first = await callOpenAi(apiKey, model, systemPrompt, userPrompt)
  const parsed = tryParse(first)
  if (parsed) return parsed

  // Single retry with stricter user prompt
  const second = await callOpenAi(apiKey, model, systemPrompt, userPrompt + '\n\nIMPORTANT: Your previous response was malformed. Return strictly { "subject": string, "body": string } with no surrounding text.')
  const reparsed = tryParse(second)
  if (reparsed) return reparsed

  throw new AppError(
    'AI_INVALID_RESPONSE',
    "AI couldn't generate valid content — try again or write the email manually.",
    422,
  )
}
