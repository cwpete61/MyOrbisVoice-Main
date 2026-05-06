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
 * Prompt construction
 * ──────────────────────────────────────────────────────────────────────── */

function buildSystemPrompt(section: DnaSection, tone: string): string {
  const spec = SECTION_SPECS[section]
  return [
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
  _tenantId: string,
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

  const systemPrompt = buildSystemPrompt(section, tone)

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
