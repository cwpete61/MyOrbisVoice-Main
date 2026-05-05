#!/usr/bin/env tsx
/**
 * i18n auto-fill: backfill missing Spanish keys via OpenAI.
 *
 * Reads en.json + es.json, finds keys present in en.json but missing in
 * es.json, sends the English values to OpenAI with a system prompt that
 * matches the project's translation conventions (Latin American Spanish,
 * informal "tú", brand terms stay English), writes results to es.json.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... pnpm i18n:fill
 *   pnpm i18n:fill --dry-run    # show what would change without writing
 *   pnpm i18n:fill --max=20     # limit to first 20 missing keys
 *
 * The OpenAI key is read from the OPENAI_API_KEY env var. Get it from the
 * MyOrbisVoice admin UI (Admin → System Settings → OpenAI). DO NOT commit
 * the key — paste it inline or in your shell session only.
 *
 * Auto-translated values are written with a "_auto" sibling in the parent
 * object, e.g.:
 *   "myKey": "translated value"
 *   "_auto_myKey": true
 * So you can grep for "_auto" later and review/refine. Remove the marker
 * after a human review pass.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..')
const DICT_DIR = join(REPO_ROOT, 'apps/web/src/lib/i18n/dictionaries')
const EN_PATH = join(DICT_DIR, 'en.json')
const ES_PATH = join(DICT_DIR, 'es.json')

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini'

const SYSTEM_PROMPT = `You translate user-facing UI strings from English to Latin American Spanish for the OrbisVoice SaaS product.

CONVENTIONS (non-negotiable):
- Latin American Spanish, informal "tú" form (NOT "usted").
- Match the established voice from these reference translations: "Panel", "ADN del negocio", "Cómo cobras", "Histórico", "Saldo disponible", "Próximamente", "Cerrar sesión".
- Keep ENGLISH (do not translate, render verbatim): "MyOrbisVoice", "OrbisVoice", "Stripe", "Stripe Connect", "Stripe Connect Express", "Twilio", "Google", "Gmail", "Google Calendar", "Gemini", "WhatsApp", "Bunny", "OpenAI", "Reoon", voice names (Zephyr, Despina, Aoede, Charon, Fenrir, Puck, Sulafat), plan names (Free, Basic, Pro, LTD, Premier, Enterprise), system enum codes (BOOKED, CALLBACK_REQUESTED, MISSED_CALL, appointment-scheduled, etc.), template tokens like {firstName} or {n} (keep curly braces and the literal name), tax form names (W-9, W-8BEN, 1099-NEC), URLs, technical identifiers in code blocks.
- Currency: keep "$" and USD amounts as-is.
- Pluralization: Spanish handles natural agreement; if the source has separate singular/plural keys, preserve the distinction.
- Tone: SaaS marketing-product voice. Direct, clear, friendly. Match the energy of the original.
- DO NOT add extra punctuation or sentences. Translate exactly what's given, preserving leading/trailing whitespace and formatting (markdown asterisks, em-dashes, parentheses, line breaks).

OUTPUT FORMAT: Return ONLY valid JSON, an object mapping each input key to its Spanish translation. No explanation, no code fences, no surrounding markdown.`

// ── Helpers ──────────────────────────────────────────────────────────────────

function flatten(obj: unknown, prefix = ''): Map<string, string> {
  const map = new Map<string, string>()
  if (obj === null || typeof obj !== 'object') return map
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') {
      for (const [kk, vv] of flatten(v, path)) map.set(kk, vv)
    } else if (typeof v === 'string') {
      map.set(path, v)
    }
  }
  return map
}

function setDeep(obj: Record<string, unknown>, path: string, value: string) {
  const parts = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]!] = value
}

async function translateBatch(items: Record<string, string>): Promise<Record<string, string>> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY env var is not set.')
    console.error('Get the key from https://app.myorbisvoice.com/admin/system-settings → OpenAI card,')
    console.error('then run: OPENAI_API_KEY=sk-... pnpm i18n:fill')
    process.exit(2)
  }

  const userPrompt = `Translate these English UI strings to Latin American Spanish (informal "tú").

Return ONLY a JSON object with the same keys, values are the translations.

Input:
${JSON.stringify(items, null, 2)}`

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${txt}`)
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')

  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI returned invalid JSON: ' + content.slice(0, 200))
  }
  return parsed
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const maxArg = args.find(a => a.startsWith('--max='))
  const max = maxArg ? parseInt(maxArg.split('=')[1] ?? '0', 10) : 0

  const enRaw = JSON.parse(readFileSync(EN_PATH, 'utf8'))
  const esRaw = JSON.parse(readFileSync(ES_PATH, 'utf8'))

  const enFlat = flatten(enRaw)
  const esFlat = flatten(esRaw)

  const missing: Record<string, string> = {}
  let count = 0
  for (const [k, v] of enFlat) {
    if (!esFlat.has(k)) {
      missing[k] = v
      count++
      if (max > 0 && count >= max) break
    }
  }

  const total = Object.keys(missing).length
  if (total === 0) {
    console.log('✓ es.json has every key from en.json — nothing to backfill')
    return
  }

  console.log(`Found ${total} missing es.json keys. Translating in batches…`)

  if (dryRun) {
    console.log('\n[dry-run] would translate:')
    for (const [k, v] of Object.entries(missing).slice(0, 20)) {
      console.log(`  ${k}: ${v.slice(0, 80)}`)
    }
    if (total > 20) console.log(`  … ${total - 20} more`)
    return
  }

  // Batch by ~30 keys per OpenAI call to keep prompts manageable
  const BATCH_SIZE = 30
  const keys = Object.keys(missing)
  const merged: Record<string, string> = {}
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)
    const batchInput: Record<string, string> = {}
    for (const k of batch) batchInput[k] = missing[k]!
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(keys.length / BATCH_SIZE)} (${batch.length} keys)… `)
    try {
      const result = await translateBatch(batchInput)
      Object.assign(merged, result)
      console.log('✓')
    } catch (err) {
      console.log('✗')
      console.error('  Batch failed:', err instanceof Error ? err.message : String(err))
    }
  }

  // Apply to esRaw
  let written = 0
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v !== 'string') continue
    setDeep(esRaw as Record<string, unknown>, k, v)
    written++
  }

  // Pretty-print and write back
  writeFileSync(ES_PATH, JSON.stringify(esRaw, null, 2) + '\n')
  console.log(`\n✓ Wrote ${written} translations to es.json`)
  console.log('  Review the additions, then run: pnpm i18n:check')
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
