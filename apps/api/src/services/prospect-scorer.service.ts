import { getOpenAiApiKey, getConfigValue } from './system-config.service.js'

// MyOrbisAgents prospect scorer (operator outreach tooling). Two halves:
//  1. extractProspect() — gpt-4o-mini parses a raw Zillow agent blob into fields.
//  2. scoreProspect()   — a DETERMINISTIC rubric turns those fields into a fit
//     score + tier (consistent + explainable; the AI never invents the number).

export interface ProspectFields {
  name: string
  brokerage?: string | null
  market?: string | null
  email?: string | null
  phone?: string | null
  salesLast12?: number | null
  totalSales?: number | null
  isTeam?: boolean
  teamSize?: string | null // solo | small | team | mega
  avgPriceUsd?: number | null
  priceRange?: string | null
  yearsExp?: number | null
  reviews?: number | null
  premierAgent?: boolean
  language?: string | null // en | es | bilingual
}

export interface Scored { score: number; tier: 'A' | 'B' | 'C'; recommendedTier: '297' | '497'; reasons: string[] }

// Deterministic fit rubric (plan §17a). Buyer = active solo/small producer
// (10-40 sales), ideally a Premier Agent, bonus bilingual/luxury.
export function scoreProspect(f: ProspectFields): Scored {
  let s = 0
  const reasons: string[] = []
  const sales = f.salesLast12 ?? null
  const team = (f.teamSize ?? '').toLowerCase()
  const mega = team === 'mega' || (sales != null && sales > 60)

  if (f.premierAgent) { s += 30; reasons.push('Premier Agent (+30)') }
  if (sales != null) {
    if (sales >= 10 && sales <= 40) { s += 20; reasons.push('sales in the 10-40 sweet spot (+20)') }
    else if (sales < 3) { s -= 20; reasons.push('near-inactive, <3 sales (-20)') }
  }
  if (team === 'solo' || team === 'small') { s += 15; reasons.push('solo / small team (+15)') }
  if (mega) { s -= 15; reasons.push('mega-team, likely already has an ISA (-15)') }
  if ((f.reviews ?? 0) >= 20) { s += 10; reasons.push('established producer, 20+ reviews (+10)') }
  const lang = (f.language ?? '').toLowerCase()
  if (lang === 'es' || lang === 'bilingual' || lang.includes('span')) { s += 10; reasons.push('bilingual / Spanish (+10)') }
  if ((f.avgPriceUsd ?? 0) >= 750000) { s += 10; reasons.push('luxury price point, high ACV (+10)') }

  s = Math.max(0, Math.min(100, s))
  const tier: 'A' | 'B' | 'C' = s >= 70 ? 'A' : s >= 50 ? 'B' : 'C'
  const recommendedTier: '297' | '497' = ((f.avgPriceUsd ?? 0) >= 750000 || (sales ?? 0) >= 20) ? '497' : '297'
  return { score: s, tier, recommendedTier, reasons }
}

const OPENAI = 'https://api.openai.com/v1/chat/completions'

// AI extraction — parse a messy Zillow agent profile into structured fields plus a
// short pitch angle + red flags. Returns null on any failure (no key / bad JSON).
export async function extractProspect(rawText: string): Promise<{ fields: ProspectFields; pitchAngle: string; redFlags: string } | null> {
  const key = await getOpenAiApiKey()
  if (!key) return null
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'
  const sys = 'You extract a US real-estate agent profile (pasted from Zillow) into strict JSON. ' +
    'Fields: name, brokerage, market (city/metro), email, phone, salesLast12 (number or null), totalSales, ' +
    'isTeam (boolean), teamSize (one of: solo, small, team, mega - infer from review count + sales: solo=individual, small=<~50 reviews, team=named team, mega=hundreds of sales/reviews), ' +
    'avgPriceUsd (integer or null), priceRange, yearsExp, reviews (number), premierAgent (boolean - true only if the text clearly says Premier Agent/advertises), language (en, es, or bilingual). ' +
    'Also: pitchAngle (one sentence tailored to this agent - luxury => protect high-value leads; volume solo => missed-call/speed-to-lead), and redFlags (short, e.g. "mega-team, already has ISA" or "near-inactive" or "" if none). ' +
    'Return ONLY JSON: { "fields": {...}, "pitchAngle": string, "redFlags": string }. Use null for unknowns; never invent numbers.'
  try {
    const r = await fetch(OPENAI, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: rawText.slice(0, 4000) }],
      }),
    })
    if (!r.ok) { console.error('[prospect-scorer] openai', r.status); return null }
    const d = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const txt = d.choices?.[0]?.message?.content
    if (!txt) return null
    const parsed = JSON.parse(txt) as { fields?: ProspectFields; pitchAngle?: string; redFlags?: string }
    if (!parsed.fields || !parsed.fields.name) return null
    return { fields: parsed.fields, pitchAngle: parsed.pitchAngle ?? '', redFlags: parsed.redFlags ?? '' }
  } catch (e) {
    console.error('[prospect-scorer] throw', e)
    return null
  }
}
