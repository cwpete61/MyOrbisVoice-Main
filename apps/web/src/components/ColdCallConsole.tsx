'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/I18nProvider'

/**
 * Cold Call console — research-first MANUAL calling script. The partner dials;
 * the platform arms them with the prospect + the specific GBP-audit finding + a
 * value-first opener (no pitch), objection lines, and the one-problem-one-price
 * offer. No AI auto-dialing (TCPA / carrier-reputation — see backlog #19); the
 * AI only handles the consented bridged test-call. Client-only, bilingual.
 */

type Bi = { en: string; es: string }
const pick = (b: Bi, L: 'en' | 'es') => (L === 'es' ? b.es : b.en)
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]?.trim() || `[${k}]`)

const FINDINGS: { key: string; label: Bi; line: Bi }[] = [
  { key: 'missedcalls', label: { en: 'Missed / after-hours calls', es: 'Llamadas perdidas / fuera de horario' },
    line: { en: 'a few calls going unanswered — especially after hours', es: 'algunas llamadas sin contestar — sobre todo fuera de horario' } },
  { key: 'nowebsite', label: { en: 'No website linked', es: 'Sin sitio web' },
    line: { en: 'no website linked on your Google listing', es: 'ningún sitio web en tu ficha de Google' } },
  { key: 'lowreviews', label: { en: 'Few / low reviews', es: 'Pocas reseñas' },
    line: { en: 'fewer reviews than the competitor right above you', es: 'menos reseñas que el competidor justo arriba de ti' } },
  { key: 'noreplies', label: { en: 'Not replying to reviews', es: 'No responde reseñas' },
    line: { en: 'reviews that haven’t been replied to', es: 'reseñas sin responder' } },
  { key: 'incomplete', label: { en: 'Incomplete Google profile', es: 'Perfil de Google incompleto' },
    line: { en: 'a couple of gaps on your Google profile', es: 'un par de huecos en tu perfil de Google' } },
]

export function ColdCallConsole() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'

  const [f, setF] = useState({ contact: '', business: '', city: '', niche: '' })
  const [findingKey, setFindingKey] = useState('missedcalls')
  const [copied, setCopied] = useState('')

  const finding = FINDINGS.find((x) => x.key === findingKey)!
  const v = useMemo(() => ({
    contact: f.contact, business: f.business, city: f.city,
    niche: f.niche || (L === 'es' ? 'tu giro' : 'your line of work'),
    finding: pick(finding.line, L),
  }), [f, finding, L])

  const SCRIPT: { tag: Bi; body: Bi }[] = [
    { tag: { en: '1 · Opener — lead with what you found (no pitch)', es: '1 · Apertura — abre con lo que encontraste (sin venta)' },
      body: { en: 'Hi {contact}, I was looking at {niche} businesses in {city} and came across {business} — you’ve got some solid reviews. I noticed {finding} that might be costing you calls. I put together a quick breakdown — no charge, no strings. Is it okay to send it over?',
              es: 'Hola {contact}, estaba viendo negocios de {niche} en {city} y encontré {business} — tienes buenas reseñas. Noté {finding} que podría estarte costando llamadas. Armé un resumen rápido — gratis, sin compromiso. ¿Te lo puedo enviar?' } },
    { tag: { en: '2 · If "what is it / how much?"', es: '2 · Si preguntan "¿qué es / cuánto?"' },
      body: { en: 'It’s free — just a breakdown of what I found when I looked you up, like a customer would. Want me to text or email it?',
              es: 'Es gratis — solo un resumen de lo que encontré al buscarte, como lo haría un cliente. ¿Te lo mando por mensaje o correo?' } },
    { tag: { en: '3 · Proof (after a test-call)', es: '3 · Prueba (después de una llamada de prueba)' },
      body: { en: 'Actually — I called your line earlier as a customer would. Here’s what happened: [what you heard]. That’s the kind of thing the breakdown covers.',
              es: 'De hecho — llamé a tu línea como lo haría un cliente. Esto fue lo que pasó: [lo que escuchaste]. Eso es lo que cubre el resumen.' } },
    { tag: { en: '4 · One problem, one price (only if they ask)', es: '4 · Un problema, un precio (solo si preguntan)' },
      body: { en: 'The biggest leak is the calls slipping through. We can put a MyOrbisVoice AI receptionist on your line — answers 24/7, captures the lead, books the appointment. One line item, one price. Want me to set it up?',
              es: 'La mayor fuga son las llamadas que se escapan. Podemos poner una recepcionista con IA de MyOrbisVoice en tu línea — contesta 24/7, captura al cliente, agenda la cita. Un solo cargo, un precio. ¿Te la configuro?' } },
    { tag: { en: '5 · Soft close — no pressure', es: '5 · Cierre suave — sin presión' },
      body: { en: 'No pressure either way — the breakdown is yours to keep. What’s the best email or number to send it to?',
              es: 'Sin presión — el resumen es tuyo de todas formas. ¿A qué correo o número te lo envío?' } },
  ]

  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(''), 1500) }).catch(() => {})
  }
  const inp = { padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as React.CSSProperties

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {L === 'es' ? 'Llamada en frío (manual)' : 'Cold Call (manual)'}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'No llames en frío sin nada. Llena los datos del prospecto + lo que encontraste en su perfil, y el guion se arma solo. Tú marcas — nunca automatizamos llamadas en frío (riesgo de TCPA / reputación de número).'
            : 'Never call cold with nothing. Fill in the prospect + what you found on their profile, and the script writes itself. You dial — we never auto-cold-call (TCPA / number-reputation risk).'}
        </p>
      </div>

      {/* Compliance */}
      <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {L === 'es'
          ? 'Solo llamadas manuales, B2B (al número público del negocio). Respeta el registro No-Llamar y si piden que no llames, detente. Tip: corre una llamada de prueba primero (pestaña Evaluación de Captura → Llamada en vivo) para tener una prueba real que mencionar.'
          : 'Manual calls only, B2B (the business’s public number). Respect Do-Not-Call and stop if asked. Tip: run a test-call first (Lead Capture Evaluation tab → Live test call) so you have a real, specific thing to mention.'}
      </div>

      {/* Prospect inputs */}
      <div className="rounded-xl p-4 grid gap-2 sm:grid-cols-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <input style={inp} placeholder={L === 'es' ? 'Nombre del contacto' : 'Contact name'} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Nombre del negocio' : 'Business name'} value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Ciudad' : 'City'} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Giro (HVAC, dental…)' : 'Niche (HVAC, dental…)'} value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} />
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--text-tertiary)' }}>
          {L === 'es' ? 'Qué encontraste (de la Auditoría GBP)' : 'What you found (from the GBP Audit)'}
          <select style={{ ...inp, width: '100%', marginTop: 4 }} value={findingKey} onChange={(e) => setFindingKey(e.target.value)}>
            {FINDINGS.map((x) => <option key={x.key} value={x.key}>{pick(x.label, L)}</option>)}
          </select>
        </label>
      </div>

      {/* Script */}
      <div className="space-y-2.5">
        {SCRIPT.map((s, i) => {
          const text = fill(pick(s.body, L), v)
          return (
            <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--brand-600, var(--brand-500, oklch(50% 0.11 193)))' }}>{pick(s.tag, L)}</span>
                <button onClick={() => copy(`s${i}`, text)} className="text-xs px-2 py-1 rounded shrink-0" style={{ border: '1px solid var(--border-subtle)', color: copied === `s${i}` ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--text-tertiary)' }}>
                  {copied === `s${i}` ? (L === 'es' ? '¡Copiado!' : 'Copied!') : (L === 'es' ? 'Copiar' : 'Copy')}
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>
            </div>
          )
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {L === 'es'
          ? 'Después de la llamada: si dicen que sí al resumen, envía el reporte (pestaña Evaluación de Captura → Crear enlace del reporte) y registra el resultado en Contactos.'
          : 'After the call: if they say yes to the breakdown, send the report (Lead Capture Evaluation tab → Create report link) and log the outcome in Contacts.'}
      </p>
    </div>
  )
}
