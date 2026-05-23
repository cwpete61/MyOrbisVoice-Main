// Marketing Kit AI helpers — translate a single piece of copy to the OTHER
// language, and generate a fresh description from a video title. Both use
// the platform OpenAI key (SystemConfig: openai_api_key).
//
// Why this exists: the admin Upload modal lets admins fill copy in ONE
// language; the project's bilingual rule (CLAUDE.md) still requires both
// English and Spanish in the DB, so the route handler calls translateText()
// once for the title and once for the description before persisting.
//
// Style: Latin American Spanish, informal "tú". Brand names stay English
// (MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, MyOrbisResults, Orby). Numeric
// values, dollar signs, and code tokens pass through unchanged.

import { AppError } from '@voiceautomation/shared'
import { getOpenAiApiKey, getConfigValue } from './system-config.service.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 25_000

const BRAND_TERMS = 'MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, MyOrbisResults, Orby, Map Pack, GBP, Google Business Profile'

async function callOpenAi(system: string, user: string, model: string, apiKey: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(OPENAI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    throw new AppError(isAbort ? 'TIMEOUT' : 'UPSTREAM_ERROR',
      isAbort ? 'AI is taking too long, try again.' : 'Could not reach the AI service.',
      isAbort ? 504 : 502)
  }
  clearTimeout(timer)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPSTREAM_ERROR', `OpenAI ${res.status}: ${text.slice(0, 200)}`, 502)
  }
  const json = await res.json() as { choices?: { message?: { content?: string } }[] }
  const out = json.choices?.[0]?.message?.content?.trim()
  if (!out) throw new AppError('AI_INVALID_RESPONSE', 'AI returned an empty response.', 422)
  return out
}

async function getKeyAndModel() {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey) throw new AppError('NOT_CONFIGURED', 'OpenAI API key is not set in system config.', 502)
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'
  return { apiKey, model }
}

// Translates a single piece of marketing copy from `from` into the OTHER
// language. Returns plain text only — no JSON, no preamble.
export async function translateText(text: string, from: 'en' | 'es'): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const { apiKey, model } = await getKeyAndModel()
  const toLang = from === 'en' ? 'Spanish (Latin American, informal "tú")' : 'English'
  const fromLang = from === 'en' ? 'English' : 'Spanish'
  const system = [
    `You translate short marketing copy from ${fromLang} to ${toLang}.`,
    `Keep these brand and product terms EXACTLY as written, untranslated: ${BRAND_TERMS}.`,
    'Keep numbers, dollar signs, hashtags, URLs and merge tokens unchanged.',
    'Match the tone of the source (energetic, direct-response). Do not pad or summarize.',
    'Return ONLY the translation. No quotes, no preamble, no notes.',
  ].join(' ')
  return (await callOpenAi(system, trimmed, model, apiKey)).replace(/^["']|["']$/g, '').trim()
}

// Generates a 1-2 sentence partner-facing description for a video, in `lang`,
// based on the title + the kit "intent" (which tab it lives in).
const INTENT_PURPOSE: Record<string, string> = {
  'pitch-product':    'pitch MyOrbisVoice to a small-business customer',
  'recruit-partners': 'pitch the MyOrbisVoice partner program to a prospective partner',
  'how-to-sell':      'teach current partners how to sell MyOrbisVoice more effectively',
  'social-cuts':      'a short 9:16 hook for partners to post on TikTok / Reels / Shorts',
}
export async function generateMarketingDescription(opts: {
  title: string; intent: string; lang: 'en' | 'es'
}): Promise<string> {
  const title = opts.title.trim()
  if (!title) throw new AppError('VALIDATION_ERROR', 'title is required', 422)
  const { apiKey, model } = await getKeyAndModel()
  const purpose = INTENT_PURPOSE[opts.intent] ?? 'partner-facing marketing video'
  const language = opts.lang === 'es' ? 'Latin American Spanish (informal "tú")' : 'English'
  const system = [
    'You write short marketing-asset descriptions for an admin video library.',
    `Audience: marketing partners reading a one-line description to decide whether to use the video.`,
    `Purpose of this asset: ${purpose}.`,
    `Write in ${language}.`,
    `Keep these brand and product terms in English: ${BRAND_TERMS}.`,
    'Style: 1-2 sentences, 18-40 words total. Confident, direct-response, no fluff. State what the video shows and when a partner should use it.',
    'Return ONLY the description. No quotes, no preamble, no markdown.',
  ].join(' ')
  const user = `Video title: ${title}`
  return (await callOpenAi(system, user, model, apiKey)).replace(/^["']|["']$/g, '').trim()
}
