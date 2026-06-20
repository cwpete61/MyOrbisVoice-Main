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

// Text content runs through any OpenAI-compatible chat-completions endpoint.
// Switch provider via the `content_provider` config (Hub-first): openai (default),
// gemini (free tier), groq (free tier), or ollama (local, $0 — only when the API
// runs co-located with Ollama). Keeps the OpenAI bill near $0. Image generation
// (gpt-image-1) is OpenAI-only and stays pinned in generateAiImage.
const CONTENT_PROVIDERS: Record<string, { url: string; keyName: string; defaultModel: string }> = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', keyName: 'openai_api_key', defaultModel: 'gpt-4o-mini' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyName: 'gemini_api_key', defaultModel: 'gemini-2.0-flash' },
  groq:   { url: 'https://api.groq.com/openai/v1/chat/completions', keyName: 'groq_api_key', defaultModel: 'llama-3.3-70b-versatile' },
  ollama: { url: (process.env['OLLAMA_URL'] ?? 'http://localhost:11434') + '/v1/chat/completions', keyName: '', defaultModel: 'qwen2.5' },
}
const REQUEST_TIMEOUT_MS = 25_000

const BRAND_TERMS = 'MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, MyOrbisResults, Orby, Map Pack, GBP, Google Business Profile'

async function callOpenAi(url: string, system: string, user: string, model: string, apiKey: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
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

// Resolve the active text-content provider → { url, apiKey, model }. Used by
// every text generator below. Image gen bypasses this (OpenAI-only).
async function getKeyAndModel(): Promise<{ url: string; apiKey: string; model: string }> {
  const name = ((await getConfigValue('content_provider')) || 'openai').toLowerCase()
  const p = CONTENT_PROVIDERS[name] ?? CONTENT_PROVIDERS['openai']!
  const apiKey = p.keyName ? ((await getConfigValue(p.keyName)) ?? '') : 'local'
  if (p.keyName && !apiKey) {
    throw new AppError('NOT_CONFIGURED', `Content provider '${name}' key (${p.keyName}) is not set in system config.`, 502)
  }
  const model = (await getConfigValue('content_model')) || p.defaultModel
  return { url: p.url, apiKey, model }
}

// Translates a single piece of marketing copy from `from` into the OTHER
// language. Returns plain text only — no JSON, no preamble.
export async function translateText(text: string, from: 'en' | 'es'): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const { url, apiKey, model } = await getKeyAndModel()
  const toLang = from === 'en' ? 'Spanish (Latin American, informal "tú")' : 'English'
  const fromLang = from === 'en' ? 'English' : 'Spanish'
  const system = [
    `You translate short marketing copy from ${fromLang} to ${toLang}.`,
    `Keep these brand and product terms EXACTLY as written, untranslated: ${BRAND_TERMS}.`,
    'Keep numbers, dollar signs, hashtags, URLs and merge tokens unchanged.',
    'Match the tone of the source (energetic, direct-response). Do not pad or summarize.',
    'Return ONLY the translation. No quotes, no preamble, no notes.',
  ].join(' ')
  return (await callOpenAi(url, system, trimmed, model, apiKey)).replace(/^["']|["']$/g, '').trim()
}

// ── Full social-post generator ─────────────────────────────────────────────
// Single OpenAI call returns:
//   title         — short, partner-facing card title (≤60 chars)
//   description   — 2-3 sentence card body
//   captions:     — per-platform variants (X / IG / LinkedIn / TikTok)
//   imagePrompt   — gpt-image-1 prompt for the background (no text in image)
//
// The angle library entry (or free prompt) seeds the system message; lang
// + intent shape voice + framework choice.

export interface SocialPostPayload {
  title:       string
  description: string
  captions:    { x: string; ig: string; linkedin: string; tiktok: string }
  imagePrompt: string
}

const BRAND_PROTECT = `Keep these brand and product terms in English in BOTH languages, never translate: MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, MyOrbisResults, Orby, Map Pack, GBP, Google Business Profile.`

export async function generateSocialPost(opts: {
  brief:        string                    // angle.briefXx OR raw user prompt
  intent:       string                    // marketing-kit intent (tab)
  lang:         'en' | 'es'
  imageStyle?:  string                    // optional photo-style hint from the angle
  freeMode?:    boolean                   // true when admin typed a free prompt
}): Promise<SocialPostPayload> {
  const { url, apiKey, model } = await getKeyAndModel()
  const language = opts.lang === 'es' ? 'Latin American Spanish (informal "tú")' : 'English'

  const system = [
    'You write a single social-media post for a SaaS called MyOrbisVoice (AI voice agents for small local businesses).',
    `Write in ${language}.`,
    BRAND_PROTECT,
    'Tone: confident, direct-response, no fluff, no AI vocabulary (no "delve", "crucial", "robust", "comprehensive", "tapestry", "underscore", etc).',
    'Return STRICTLY a JSON object with this exact shape and nothing else (no preamble, no markdown fences):',
    `{
  "title": "short partner-facing card title, max 60 chars",
  "description": "2-3 sentences for the partner card under the title, max 220 chars",
  "captions": {
    "x":        "≤270 chars, hook-led, 0-1 hashtag, no emoji",
    "ig":       "Instagram caption with 1-2 line breaks, 1-3 emoji, hook on line 1, CTA on last line, ≤2200 chars but aim ≤600",
    "linkedin": "3 short paragraphs (40-90 words total), thought-leader voice, no emoji, no hashtags",
    "tiktok":   "≤150 chars, hooky, 1-2 trending hashtags allowed"
  },
  "imagePrompt": "Detailed prompt for an AI image generator (gpt-image-1) describing ONLY the background photograph. Cinematic, photographic, on-brand (deep blue + teal palette, warm interior amber as accent). 30-70 words. MUST end with the literal sentence: 'No text, no letters, no signage, no logos, no readable writing of any kind anywhere in the image.' Compose the scene with NO storefronts that have visible signs, NO menu boards, NO posters, NO numbered signs, NO book covers, NO documents. If a sign appears in concept it must be blurred beyond readability."
}`,
  ].join('\n')

  const user = [
    `Intent (which tab): ${opts.intent}`,
    `Angle / brief:`, opts.brief.trim(),
    opts.imageStyle ? `Suggested image style: ${opts.imageStyle}` : '',
    opts.freeMode ? 'This is a free-form admin prompt — follow it closely; use the brief as the message.' : 'This is from the curated angle library — keep the framework intact.',
  ].filter(Boolean).join('\n')

  const out = await callOpenAi(url, system, user, model, apiKey)
  // Strip accidental ```json fences if the model returns them.
  const clean = out.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  let parsed: SocialPostPayload
  try { parsed = JSON.parse(clean) }
  catch { throw new AppError('AI_INVALID_RESPONSE', 'AI returned non-JSON; retry or refine prompt.', 422) }
  // Defensive shape check — refuse partial payloads rather than persist garbage.
  if (!parsed.title || !parsed.description || !parsed.captions?.x || !parsed.captions?.ig || !parsed.captions?.linkedin || !parsed.captions?.tiktok || !parsed.imagePrompt) {
    throw new AppError('AI_INVALID_RESPONSE', 'AI response missing required fields.', 422)
  }
  return parsed
}

// ── AI image generation (gpt-image-1) ──────────────────────────────────────
// Returns raw bytes — caller is responsible for storing them (Bunny upload
// happens in marketing-kit.service.ts so this module stays storage-agnostic).
// Belt-and-suspenders no-text guardrail. gpt-image-1 still occasionally
// hallucinates signage / book covers / posters into backgrounds even when the
// prompt forbids it; prepending this hard instruction up front reduces the
// rate dramatically. We keep the user's prompt intact after it.
const NO_TEXT_GUARDRAIL = [
  'ABSOLUTE REQUIREMENT — read this first:',
  'The output image MUST contain ZERO text, ZERO letters, ZERO numbers, ZERO signage, ZERO logos, ZERO writing of any kind.',
  'No storefronts with visible signs. No menu boards. No book covers. No posters. No documents. No phone screens with visible text. No price tags. No numbered signs. No graffiti. No license plates.',
  'If the scene concept implies a sign, the sign must be blurred beyond all readability OR removed entirely.',
  'Violation of this rule = bad output. Comply strictly.',
  '',
  'Scene to render:',
].join(' ')

export async function generateAiImage(opts: { prompt: string; size?: '1024x1024' | '1024x1536' | '1536x1024'; quality?: 'low' | 'medium' | 'high' }): Promise<{ bytes: Buffer; mime: string }> {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey) throw new AppError('NOT_CONFIGURED', 'OpenAI API key required for image generation.', 502)
  const fullPrompt = `${NO_TEXT_GUARDRAIL}\n\n${opts.prompt.trim()}`
  // One retry on transient 5xx — gpt-image-1 occasionally 502s under load.
  const attempt = async () => {
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:   'gpt-image-1',
        prompt:  fullPrompt,
        size:    opts.size    ?? '1024x1024',
        quality: opts.quality ?? 'high',
        n:       1,
      }),
    })
  }
  let res = await attempt()
  if (!res.ok && res.status >= 500) {
    await new Promise(r => setTimeout(r, 1500))
    res = await attempt()
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPSTREAM_ERROR', `gpt-image-1 ${res.status}: ${text.slice(0, 200)}`, 502)
  }
  const json = await res.json() as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new AppError('AI_INVALID_RESPONSE', 'gpt-image-1 returned no image', 422)
  return { bytes: Buffer.from(b64, 'base64'), mime: 'image/png' }
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
  const { url, apiKey, model } = await getKeyAndModel()
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
  return (await callOpenAi(url, system, user, model, apiKey)).replace(/^["']|["']$/g, '').trim()
}

// ── Inbound Evaluation: neon graphic line generator ─────────────────────────
// Turns a partner's rough idea into ONE ultra-short, text-only graphic headline
// for the Graphics studio (neon background, big black/white type). Output uses
// real line breaks so it drops straight into the canvas. Honesty rule enforced:
// no invented stats or dollar figures — loss is a question or owner estimate.
export async function generateGraphicLine(opts: {
  idea: string; lang: 'en' | 'es'; track?: string
}): Promise<string> {
  const idea = opts.idea.trim()
  if (!idea) throw new AppError('VALIDATION_ERROR', 'idea is required', 422)
  const { url, apiKey, model } = await getKeyAndModel()
  const language = opts.lang === 'es' ? 'Latin American Spanish (informal "tú")' : 'English'
  const angle = GRAPHIC_TRACK_HINT[opts.track ?? ''] ?? 'a missed-call / lost-lead pain point for a local business'
  const system = [
    'You write ONE ultra-short social GRAPHIC headline for MyOrbisVoice (AI phone answering for local businesses).',
    `Write in ${language}.`,
    `Campaign angle: ${angle}.`,
    'The graphic is text-only on a bright neon background, so it must be SHORT and high-impact: 2 to 5 short lines, a few words each.',
    'Use real line breaks between lines (actual newlines, not the characters backslash-n).',
    'Punchy, direct-response, pattern-interrupt. No emoji, no hashtags, no quotes, no preamble, no explanation.',
    `Keep these brand and product terms in English: ${BRAND_TERMS}.`,
    'HONESTY RULE (mandatory): never invent statistics or dollar figures. Frame any loss as a question or the owner\'s own estimate, never a made-up stat.',
    'Return ONLY the headline text with line breaks.',
  ].join(' ')
  const out = await callOpenAi(url, system, `Idea: ${idea}`, model, apiKey)
  return out.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim()
}

const GRAPHIC_TRACK_HINT: Record<string, string> = {
  beta: 'honest beta-tester recruitment — "we need businesses to test our software, free report"',
  phantom: 'the Phantom Customer — the buyer who called and silently left through a gap',
  competitor: 'loss aversion — the job went to whoever picked up first',
  math: 'anti-hype honesty — no fake stats, the owner\'s own numbers',
  afterhours: 'after-hours leak — call your own line tonight and hear what a customer hears',
}
