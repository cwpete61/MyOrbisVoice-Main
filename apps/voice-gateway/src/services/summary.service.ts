import OpenAI from 'openai'
import { env } from '../lib/env.js'
import { getConfigValue } from '../lib/config.js'
import type { TranscriptEntry } from './conversation.service.js'

async function getOpenAiKey(): Promise<string> {
  const dbKey = await getConfigValue('openai_api_key')
  return dbKey || env.OPENAI_API_KEY
}

async function getOpenAiModel(): Promise<string> {
  const dbModel = await getConfigValue('openai_model')
  return dbModel || 'gpt-4o-mini'
}

export async function cleanTranscript(transcript: TranscriptEntry[]): Promise<TranscriptEntry[]> {
  if (transcript.length === 0) return transcript
  const apiKey = await getOpenAiKey()
  if (!apiKey) return transcript
  const openai = new OpenAI({ apiKey })
  const model = await getOpenAiModel()

  const raw = transcript.map(e => ({ role: e.role, text: e.text }))

  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a transcript formatter. You receive a JSON array of transcript entries. Each entry has "role" and "text". Fix ONLY spacing and formatting artifacts caused by streaming ASR (e.g. "Ye s" → "Yes", "do ing" → "doing", "Than k you" → "Thank you", "that\' s" → "that\'s"). Do NOT change any words, add punctuation that was not there, or alter meaning. Return the corrected entries as a JSON array with the same structure. Output raw JSON only, no markdown.',
        },
        { role: 'user', content: JSON.stringify(raw) },
      ],
      max_tokens: 1000,
      temperature: 0,
    })

    const content = res.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(content) as { role: string; text: string }[]
    return transcript.map((entry, i) => ({
      ...entry,
      text: parsed[i]?.text ?? entry.text,
    }))
  } catch {
    return transcript
  }
}

export async function generateSummary(transcript: TranscriptEntry[]): Promise<string> {
  if (transcript.length === 0) return 'No conversation.'
  const apiKey = await getOpenAiKey()
  if (!apiKey) return 'Summary unavailable (no OpenAI key configured).'

  try {
    const openai = new OpenAI({ apiKey })
    const text = transcript
      .map(e => `${e.role === 'user' ? 'Caller' : 'Agent'}: ${e.text}`)
      .join('\n')

    const model = await getOpenAiModel()
    const res = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You summarize call transcripts in 2-3 sentences. Focus on: what the caller needed, what was resolved or promised, and any next steps. Be factual and concise.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0.2,
    })

    return res.choices[0]?.message?.content?.trim() ?? 'Summary unavailable.'
  } catch (err) {
    console.error('[summary] generation failed:', err)
    return 'Summary unavailable (generation error).'
  }
}

export type AttentionLevel = 'NONE' | 'WATCH' | 'ALERT'

/** Pre-showing handoff for the agent — extracted only from real-estate BUYER
 *  calls. Every field is what the caller actually stated; anything not said is
 *  null/empty. Fair-Housing-safe: stated needs only, never inferred profiling. */
export interface ShowingBrief {
  financing:       string | null   // e.g. "Pre-approved ~$450k", "Cash", "Not yet — needs lender"
  timeline:        string | null   // e.g. "Ready now", "30-60 days", "Just looking"
  motivation:      string | null   // why they're moving
  budget:          string | null   // stated price range
  area:            string | null   // areas / commute
  mustHaves:       string[]        // stated must-haves
  dealBreakers:    string[]        // stated deal-breakers
  decisionMakers:  string | null   // who else decides / is attending
  alreadyHasAgent: boolean | null  // working with another agent?
  redFlags:        string[]        // e.g. "not pre-approved", "has agent — confirm", "selling first"
}

export interface ConversationAnalysis {
  summary:         string
  attentionLevel:  AttentionLevel
  attentionReason: string | null
  showingBrief:    ShowingBrief | null
}

/** Coerce the model's showingBrief object into a valid ShowingBrief, or null if
 *  it captured nothing meaningful. Defensive against loose LLM output. */
function normalizeShowingBrief(raw: unknown): ShowingBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => (x as string).trim()) : [])
  const brief: ShowingBrief = {
    financing:       str(r['financing']),
    timeline:        str(r['timeline']),
    motivation:      str(r['motivation']),
    budget:          str(r['budget']),
    area:            str(r['area']),
    mustHaves:       arr(r['mustHaves']),
    dealBreakers:    arr(r['dealBreakers']),
    decisionMakers:  str(r['decisionMakers']),
    alreadyHasAgent: typeof r['alreadyHasAgent'] === 'boolean' ? (r['alreadyHasAgent'] as boolean) : null,
    redFlags:        arr(r['redFlags']),
  }
  const hasAny = brief.financing || brief.timeline || brief.motivation || brief.budget || brief.area
    || brief.decisionMakers || brief.alreadyHasAgent !== null
    || brief.mustHaves.length || brief.dealBreakers.length || brief.redFlags.length
  return hasAny ? brief : null
}

/**
 * Single post-call AI pass that produces the summary AND the admin-attention
 * assessment in one LLM call (cheaper than two). Powers the admin central
 * call log's colour + alerting. Degrades safely — any failure returns a
 * NONE-level result so call finalize is never blocked.
 */
export async function analyzeConversation(transcript: TranscriptEntry[]): Promise<ConversationAnalysis> {
  if (transcript.length === 0) {
    return { summary: 'No conversation.', attentionLevel: 'NONE', attentionReason: null, showingBrief: null }
  }
  const apiKey = await getOpenAiKey()
  if (!apiKey) {
    return { summary: 'Summary unavailable (no OpenAI key configured).', attentionLevel: 'NONE', attentionReason: null, showingBrief: null }
  }

  try {
    const openai = new OpenAI({ apiKey })
    const text = transcript
      .map(e => `${e.role === 'user' ? 'Caller' : 'Agent'}: ${e.text}`)
      .join('\n')
    const model = await getOpenAiModel()

    const res = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You review a completed business phone call transcript. Respond with JSON only: ' +
            '{"summary": string, "attentionLevel": "NONE"|"WATCH"|"ALERT", "attentionReason": string|null, "showingBrief": object|null}. ' +
            'summary: 2-3 factual sentences — what the caller needed, what was resolved or promised, next steps. ' +
            'attentionLevel = ALERT when the caller was frustrated or angry, an issue went unresolved, a booking ' +
            'failed or was abandoned, the caller asked for a human/manager/escalation, or the caller sounded ' +
            'confused or misled. WATCH for milder concern — mild dissatisfaction, an unclear outcome, or a promise ' +
            'that needs follow-up. NONE for a normal, successful call. ' +
            'attentionReason: one short sentence naming the issue when WATCH or ALERT, otherwise null. ' +
            'showingBrief: ONLY if this is a real-estate BUYER inquiring about seeing or buying a home, extract a pre-showing brief for the agent as ' +
            '{"financing": string|null, "timeline": string|null, "motivation": string|null, "budget": string|null, "area": string|null, ' +
            '"mustHaves": string[], "dealBreakers": string[], "decisionMakers": string|null, "alreadyHasAgent": boolean|null, "redFlags": string[]}. ' +
            'Use ONLY what the caller actually stated; set any unmentioned field to null (or [] for lists). Add redFlags like "not pre-approved", "already has an agent — confirm", "needs to sell first". ' +
            'FAIR HOUSING: capture stated needs only — NEVER infer or record race, religion, family status, national origin, or steer. If the call is not a real-estate buyer, set showingBrief to null.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 600,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })

    const content = res.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(content) as Partial<ConversationAnalysis>
    const level: AttentionLevel =
      parsed.attentionLevel === 'ALERT' || parsed.attentionLevel === 'WATCH' ? parsed.attentionLevel : 'NONE'
    return {
      summary:         parsed.summary?.trim() || 'Summary unavailable.',
      attentionLevel:  level,
      attentionReason: level === 'NONE' ? null : (parsed.attentionReason?.trim() || null),
      showingBrief:    normalizeShowingBrief(parsed.showingBrief),
    }
  } catch (err) {
    console.error('[summary] analysis failed:', err)
    return { summary: 'Summary unavailable (generation error).', attentionLevel: 'NONE', attentionReason: null, showingBrief: null }
  }
}
