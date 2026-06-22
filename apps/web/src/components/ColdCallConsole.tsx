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

// What the partner's TEST-CALL exposed — the call experience MyOrbisVoice fixes.
// The call IS the research + the proof. `line` drops into the opener.
const FINDINGS: { key: string; label: Bi; line: Bi }[] = [
  { key: 'noanswer', label: { en: 'No answer (business hours)', es: 'Sin respuesta (en horario)' },
    line: { en: 'no one picked up — and this was during your open hours', es: 'nadie contestó — y era en tu horario de atención' } },
  { key: 'voicemail', label: { en: 'Straight to voicemail', es: 'Directo al buzón' },
    line: { en: 'it went straight to voicemail in the middle of the day', es: 'cayó directo al buzón a media jornada' } },
  { key: 'rangout', label: { en: 'Rang out / dropped', es: 'Sonó y se cortó' },
    line: { en: 'it just rang and rang, then dropped', es: 'sonó y sonó, y luego se cortó' } },
  { key: 'hold', label: { en: 'Long hold', es: 'Espera larga' },
    line: { en: 'I got put on hold and waited a long time before giving up', es: 'me dejaron en espera mucho tiempo hasta que colgué' } },
  { key: 'afterhours', label: { en: 'After-hours dead line', es: 'Línea muerta fuera de horario' },
    line: { en: 'after hours the line just rang out — no way to even leave a message', es: 'fuera de horario la línea solo sonó — sin forma de dejar un mensaje' } },
  { key: 'vmfull', label: { en: 'Voicemail full / not set up', es: 'Buzón lleno / sin configurar' },
    line: { en: 'the voicemail was full or not set up, so I couldn’t leave anything', es: 'el buzón estaba lleno o sin configurar, así que no pude dejar nada' } },
  { key: 'nobooking', label: { en: 'Answered, but no booking', es: 'Contestaron, pero sin agendar' },
    line: { en: 'someone answered but didn’t offer to book me or take my info', es: 'alguien contestó pero no ofreció agendarme ni tomó mis datos' } },
  { key: 'nocallback', label: { en: 'No callback after voicemail', es: 'Sin devolución tras el buzón' },
    line: { en: 'I left a voicemail and never got a call back', es: 'dejé un mensaje y nunca me devolvieron la llamada' } },
]

export function ColdCallConsole() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'

  const [f, setF] = useState({ contact: '', business: '' })
  const [findingKey, setFindingKey] = useState('noanswer')
  const [copied, setCopied] = useState('')

  const finding = FINDINGS.find((x) => x.key === findingKey)!
  const v = useMemo(() => ({
    contact: f.contact, business: f.business, finding: pick(finding.line, L),
  }), [f, finding, L])

  const SCRIPT: { tag: Bi; body: Bi }[] = [
    { tag: { en: '1 · Opener — lead with the call (no pitch)', es: '1 · Apertura — abre con la llamada (sin venta)' },
      body: { en: 'Hi {contact}, I called {business} a little earlier the way a new customer would — {finding}. Figured you’d want to know, because that’s the kind of thing that quietly costs booked jobs. I put together a quick breakdown of what happened on the call — no charge, no strings. Okay if I send it over?',
              es: 'Hola {contact}, llamé a {business} hace un rato como lo haría un cliente nuevo — {finding}. Pensé que querrías saberlo, porque eso suele costar trabajos agendados sin que te enteres. Armé un resumen rápido de lo que pasó en la llamada — gratis, sin compromiso. ¿Te lo puedo enviar?' } },
    { tag: { en: '2 · If "what is it / how much?"', es: '2 · Si preguntan "¿qué es / cuánto?"' },
      body: { en: 'It’s free — just a short breakdown of what I heard when I called, plus what it’d take to stop those calls from slipping. Want it by text or email?',
              es: 'Es gratis — solo un resumen de lo que escuché al llamar, y qué haría falta para que esas llamadas dejen de escaparse. ¿Te lo mando por mensaje o correo?' } },
    { tag: { en: '3 · Dig a little (let them feel it)', es: '3 · Indaga un poco (que lo sientan)' },
      body: { en: 'Quick question — when you’re slammed on a job or it’s after hours and a new customer calls, where does that call usually go? … Right. Every one of those is a job someone else probably booked.',
              es: 'Pregunta rápida — cuando estás a tope en un trabajo o es fuera de horario y llama un cliente nuevo, ¿a dónde va esa llamada normalmente? … Exacto. Cada una de esas es un trabajo que probablemente agendó alguien más.' } },
    { tag: { en: '4 · One problem, one price (only if they ask)', es: '4 · Un problema, un precio (solo si preguntan)' },
      body: { en: 'The fix is simple: a MyOrbisVoice AI receptionist on your line — answers every call 24/7, captures the lead, books the appointment, and texts you the details. One line item, one price. Want me to set it up?',
              es: 'La solución es simple: una recepcionista con IA de MyOrbisVoice en tu línea — contesta cada llamada 24/7, captura al cliente, agenda la cita y te manda los datos por mensaje. Un solo cargo, un precio. ¿Te la configuro?' } },
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
            ? 'No llames en frío sin nada. Primero haz una llamada de prueba a su línea, anota qué pasó, y el guion se arma solo alrededor de eso. Tú marcas — nunca automatizamos llamadas en frío (riesgo de TCPA / reputación de número).'
            : 'Never call cold with nothing. Run a test-call to their line first, note what happened, and the script builds itself around it. You dial — we never auto-cold-call (TCPA / number-reputation risk).'}
        </p>
      </div>

      {/* Compliance */}
      <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {L === 'es'
          ? 'Solo llamadas manuales, B2B (al número público del negocio). Respeta el registro No-Llamar y si piden que no llames, detente. La llamada de prueba (pestaña Evaluación de Captura → Llamada en vivo) ES tu investigación — lo que escuches ahí es lo que mencionas en la apertura.'
          : 'Manual calls only, B2B (the business’s public number). Respect Do-Not-Call and stop if asked. The test-call (Lead Capture Evaluation tab → Live test call) IS your research — what you hear there is exactly what you open with.'}
      </div>

      {/* Prospect inputs */}
      <div className="rounded-xl p-4 grid gap-2 sm:grid-cols-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <input style={inp} placeholder={L === 'es' ? 'Nombre del contacto' : 'Contact name'} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Nombre del negocio' : 'Business name'} value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} />
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--text-tertiary)' }}>
          {L === 'es' ? 'Qué pasó cuando llamaste (de la llamada de prueba)' : 'What happened when you called (from the test-call)'}
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
