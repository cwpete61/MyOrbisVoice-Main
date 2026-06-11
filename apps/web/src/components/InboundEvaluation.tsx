'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/I18nProvider'
import { apiSaveEvalContact, apiContactSignupInvite } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

/**
 * Lead Capture Evaluation — the partner-facing scorecard tool behind the free
 * 15-minute inbound evaluation (see docs/campaigns/lead-eval-scoring-methodology.md).
 * Partner runs a few test calls, scores 6 categories, gets a 0–100 Lead Capture
 * Score + grade band + an optional cost-of-the-leak estimate. Fully bilingual.
 */

type Lvl = { pts: number; en: string; es: string }
type Cat = { key: string; max: number; en: string; es: string; noteEn: string; noteEs: string; levels: Lvl[] }

const CATEGORIES: Cat[] = [
  {
    key: 'speed', max: 20, en: 'Speed to Answer', es: 'Velocidad de respuesta',
    noteEn: 'The single biggest predictor of a captured lead. Business-hours call.',
    noteEs: 'El mayor predictor de un lead capturado. Llamada en horario de atención.',
    levels: [
      { pts: 20, en: 'Answered live within ~4 rings (≈20 sec)', es: 'Contestaron en vivo en ~4 timbres (≈20 seg)' },
      { pts: 13, en: 'Answered live in 5–8 rings', es: 'Contestaron en vivo en 5–8 timbres' },
      { pts: 8, en: 'Answered, but long hold / transferred around before a human', es: 'Contestaron, pero espera larga / te transfirieron antes de un humano' },
      { pts: 4, en: 'Went to voicemail during posted open hours', es: 'Fue a buzón de voz en horario de atención' },
      { pts: 0, en: 'Rang out with no answer and no voicemail, or busy signal', es: 'Sonó sin respuesta ni buzón, o tono de ocupado' },
    ],
  },
  {
    key: 'greeting', max: 15, en: 'Greeting & Professionalism', es: 'Saludo y profesionalismo',
    noteEn: 'How the call was answered — the first impression a paying customer gets.',
    noteEs: 'Cómo contestaron — la primera impresión que recibe un cliente que paga.',
    levels: [
      { pts: 15, en: 'Branded, warm greeting: business name + a name + offer to help', es: 'Saludo cálido con marca: nombre del negocio + un nombre + oferta de ayuda' },
      { pts: 10, en: 'Business name stated, professional, but no name / offer to help', es: 'Dijeron el nombre del negocio, profesional, pero sin nombre / oferta de ayuda' },
      { pts: 5, en: 'Generic "Hello?" / unclear if you reached the right place', es: 'Un "¿Bueno?" genérico / no quedó claro si era el lugar correcto' },
      { pts: 2, en: 'Rushed, distracted, background noise, or unprofessional', es: 'Apurado, distraído, ruido de fondo o poco profesional' },
    ],
  },
  {
    key: 'capture', max: 20, en: 'Lead Capture', es: 'Captura del lead',
    noteEn: 'Did they actually get information that lets them follow up with you?',
    noteEs: '¿Realmente obtuvieron datos para darte seguimiento?',
    levels: [
      { pts: 20, en: 'Captured name and phone/contact and the need', es: 'Capturaron nombre y teléfono/contacto y la necesidad' },
      { pts: 12, en: 'Captured the need + one contact detail', es: 'Capturaron la necesidad + un dato de contacto' },
      { pts: 5, en: 'Talked through the need but took no contact info', es: 'Hablaron de la necesidad pero no tomaron contacto' },
      { pts: 0, en: 'Gave info/price and ended the call without capturing anything', es: 'Dieron info/precio y colgaron sin capturar nada' },
    ],
  },
  {
    key: 'conversion', max: 20, en: 'Conversion Action (Next Step)', es: 'Acción de conversión (próximo paso)',
    noteEn: 'Did they move you toward becoming a customer, or just answer and stop?',
    noteEs: '¿Te movieron hacia ser cliente, o solo contestaron y ahí quedó?',
    levels: [
      { pts: 20, en: 'Concrete next step: booked/held an appointment, quote + scheduled follow-up, or a set time to talk', es: 'Próximo paso concreto: cita agendada, cotización + seguimiento, u hora fija para hablar' },
      { pts: 12, en: 'Soft next step: "I\'ll have someone call you back" with a name or timeframe', es: 'Paso suave: "alguien te devuelve la llamada" con un nombre o tiempo' },
      { pts: 6, en: 'Vague: "call us back if you want to schedule" (puts the work on you)', es: 'Vago: "llámanos si quieres agendar" (te deja el trabajo a ti)' },
      { pts: 0, en: 'No next step offered at all', es: 'No ofrecieron ningún próximo paso' },
    ],
  },
  {
    key: 'afterhours', max: 15, en: 'After-Hours Coverage', es: 'Cobertura fuera de horario',
    noteEn: 'What happens when someone calls outside open hours. Where most local businesses bleed the most leads.',
    noteEs: 'Qué pasa cuando llaman fuera de horario. Aquí se fugan más leads.',
    levels: [
      { pts: 15, en: 'Live answer, answering service, or smart routing that can book/triage', es: 'Respuesta en vivo, servicio de contestación, o ruteo inteligente que agenda/tría' },
      { pts: 10, en: 'Professional voicemail: states business name, hours, and a clear callback promise', es: 'Buzón profesional: dice el nombre del negocio, horario y una promesa clara de devolver la llamada' },
      { pts: 5, en: 'Generic voicemail with no useful info', es: 'Buzón genérico sin información útil' },
      { pts: 0, en: 'Rings forever, mailbox full, disconnected, or no after-hours path', es: 'Suena sin parar, buzón lleno, desconectado o sin ruta fuera de horario' },
    ],
  },
  {
    key: 'followup', max: 10, en: 'Follow-Up / Callback', es: 'Seguimiento / devolución',
    noteEn: 'You left a voicemail (or a missed call). Did they chase the lead?',
    noteEs: 'Dejaste un buzón (o una llamada perdida). ¿Persiguieron el lead?',
    levels: [
      { pts: 10, en: 'Called or texted back within ~1 business hour', es: 'Llamaron o enviaron texto en ~1 hora hábil' },
      { pts: 6, en: 'Same day', es: 'El mismo día' },
      { pts: 3, en: 'Next day', es: 'Al día siguiente' },
      { pts: 0, en: 'Never (by 48h)', es: 'Nunca (en 48h)' },
    ],
  },
]

type Grade = { min: number; letter: string; en: string; es: string; color: string }
const GRADES: Grade[] = [
  { min: 90, letter: 'A', en: 'Locked Tight', es: 'Bien cerrado', color: 'oklch(72% 0.17 145)' },
  { min: 75, letter: 'B', en: 'Solid — Minor Leaks', es: 'Sólido — fugas menores', color: 'oklch(78% 0.15 165)' },
  { min: 60, letter: 'C', en: 'Leaking Leads', es: 'Perdiendo clientes', color: 'oklch(80% 0.14 90)' },
  { min: 40, letter: 'D', en: 'Major Leaks', es: 'Fugas importantes', color: 'oklch(72% 0.16 55)' },
  { min: 0, letter: 'F', en: 'Critical', es: 'Crítico', color: 'oklch(63% 0.20 25)' },
]

const T = {
  heading: { en: 'Lead Capture Evaluation', es: 'Evaluación de captura de leads' },
  intro: {
    en: 'Score a prospect’s inbound responsiveness from a few test calls — a defensible 0–100 Lead Capture Score across 6 categories. Run Call #1 during their posted open hours; score from notes taken during the call.',
    es: 'Evalúa la capacidad de respuesta de un prospecto con unas llamadas de prueba — un Puntaje de Captura de 0–100 en 6 categorías. Haz la Llamada #1 en su horario de atención; califica con notas tomadas durante la llamada.',
  },
  leadDetails: { en: 'Lead details', es: 'Datos del lead' },
  business: { en: 'Business name', es: 'Nombre del negocio' },
  businessPh: { en: 'e.g. Allentown HVAC Co.', es: 'ej. Climas Allentown' },
  contactName: { en: 'Contact name', es: 'Nombre del contacto' },
  email: { en: 'Email', es: 'Correo' },
  bizPhone: { en: 'Business phone', es: 'Teléfono del negocio' },
  personalPhone: { en: 'Personal phone', es: 'Teléfono personal' },
  address: { en: 'Address', es: 'Dirección' },
  niche: { en: 'Niche / Industry', es: 'Nicho / Industria' },
  nichePh: { en: 'e.g. HVAC, Dental, Salon', es: 'ej. Climas, Dental, Salón' },
  score: { en: 'Lead Capture Score', es: 'Puntaje de captura' },
  ofCats: { en: 'of 6 categories scored', es: 'de 6 categorías evaluadas' },
  costTitle: { en: 'Cost of the leak (optional)', es: 'Costo de la fuga (opcional)' },
  costNote: {
    en: 'Estimate from the owner’s own numbers — not a claimed statistic. Leave blank if unknown.',
    es: 'Estimación con los números del dueño — no una estadística. Déjalo en blanco si no se sabe.',
  },
  callsWk: { en: 'Inbound calls / week', es: 'Llamadas entrantes / semana' },
  closeRate: { en: 'Close rate (%)', es: 'Tasa de cierre (%)' },
  avgVal: { en: 'Avg. job / customer value ($)', es: 'Valor promedio por trabajo / cliente ($)' },
  notCaptured: { en: '% not captured (suggested, editable)', es: '% no capturado (sugerido, editable)' },
  missed: { en: 'Est. missed leads / month', es: 'Leads perdidos estimados / mes' },
  lostRev: { en: 'Est. lost revenue / month', es: 'Ingresos perdidos estimados / mes' },
  reset: { en: 'Reset', es: 'Reiniciar' },
  biggestLeak: { en: 'Biggest leak', es: 'Mayor fuga' },
  saveToContacts: { en: 'Save to Contacts', es: 'Guardar en Contactos' },
  saving: { en: 'Saving…', es: 'Guardando…' },
  saved: { en: 'Saved to Contacts', es: 'Guardado en Contactos' },
  createInvite: { en: 'Create report link', es: 'Crear enlace del reporte' },
  inviteHint: { en: 'Share with the lead — they see their full report (no login); its "Get started" CTA leads to a prefilled signup.', es: 'Comparte con el lead — ve su reporte completo (sin iniciar sesión); su botón "Empezar" lleva a un registro prellenado.' },
  copy: { en: 'Copy', es: 'Copiar' },
  copied: { en: 'Copied', es: 'Copiado' },
}

export function InboundEvaluation() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const tr = (o: { en: string; es: string }) => o[L]

  const [biz, setBiz] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [personalPhone, setPersonalPhone] = useState('')
  const [address, setAddress] = useState('')
  const [niche, setNiche] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [callsWk, setCallsWk] = useState('')
  const [closeRate, setCloseRate] = useState('')
  const [avgVal, setAvgVal] = useState('')
  const [notCapturedOverride, setNotCapturedOverride] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const answered = Object.keys(scores).length
  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores])
  const grade: Grade = GRADES.find((g) => total >= g.min) ?? GRADES[GRADES.length - 1]!

  // Biggest leak = scored category with the largest points lost vs its max.
  const biggestLeak = useMemo(() => {
    let worst: { cat: Cat; lost: number } | null = null
    for (const c of CATEGORIES) {
      if (!(c.key in scores)) continue
      const lost = c.max - (scores[c.key] ?? 0)
      if (lost > 0 && (!worst || lost > worst.lost)) worst = { cat: c, lost }
    }
    return worst?.cat ?? null
  }, [scores])

  // Suggested "% not captured" from the grade (owner can override).
  const suggestedNotCaptured = total >= 90 ? 5 : total >= 75 ? 15 : total >= 60 ? 30 : total >= 40 ? 45 : 60
  const notCaptured = notCapturedOverride !== '' ? Number(notCapturedOverride) : suggestedNotCaptured

  const n = (s: string) => (s.trim() === '' ? null : Number(s))
  const cw = n(callsWk), cr = n(closeRate), av = n(avgVal)
  const missedPerMonth = cw != null ? cw * 4.33 * (notCaptured / 100) : null
  const lostRevenue = missedPerMonth != null && cr != null && av != null ? missedPerMonth * (cr / 100) * av : null
  const money = (v: number) => `$${Math.round(v).toLocaleString(L === 'es' ? 'es-MX' : 'en-US')}`

  function reset() {
    setBiz(''); setContactName(''); setEmail(''); setBizPhone(''); setPersonalPhone(''); setAddress(''); setNiche('')
    setScores({}); setCallsWk(''); setCloseRate(''); setAvgVal(''); setNotCapturedOverride('')
    setSavedId(null); setInviteUrl(null); setSaveErr(''); setCopied(false)
  }

  async function save() {
    setSaving(true); setSaveErr('')
    try {
      const r = await apiSaveEvalContact(
        {
          businessName: biz, contactName, email, businessPhone: bizPhone, personalPhone, address, niche,
          score: total, grade: grade.letter, scores,
          costPerWeek: callsWk ? Number(callsWk) : undefined,
          closeRate:   closeRate ? Number(closeRate) : undefined,
          avgValue:    avgVal ? Number(avgVal) : undefined,
          notCaptured: callsWk ? notCaptured : undefined,
        },
        getAccessToken() ?? '',
      )
      setSavedId(r.id)
    } catch (e) { setSaveErr(e instanceof Error ? e.message : 'Error') } finally { setSaving(false) }
  }
  async function makeInvite() {
    if (!savedId) return
    try {
      const r = await apiContactSignupInvite(savedId, getAccessToken() ?? '')
      setInviteUrl(r.url)
    } catch (e) { setSaveErr(e instanceof Error ? e.message : 'Error') }
  }
  function copyInvite() {
    if (!inviteUrl) return
    navigator.clipboard?.writeText(inviteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{tr(T.heading)}</h2>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>{tr(T.intro)}</p>
        </div>
        <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg shrink-0" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {tr(T.reset)}
        </button>
      </div>

      {/* Business name + live score */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto] items-stretch">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{tr(T.leadDetails)}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={tr(T.business)} value={biz} onChange={setBiz} placeholder={tr(T.businessPh)} />
            <TextField label={tr(T.contactName)} value={contactName} onChange={setContactName} />
            <TextField label={tr(T.email)} value={email} onChange={setEmail} type="email" />
            <TextField label={tr(T.bizPhone)} value={bizPhone} onChange={setBizPhone} type="tel" />
            <TextField label={tr(T.personalPhone)} value={personalPhone} onChange={setPersonalPhone} type="tel" />
            <TextField label={tr(T.niche)} value={niche} onChange={setNiche} placeholder={tr(T.nichePh)} />
            <div className="sm:col-span-2">
              <TextField label={tr(T.address)} value={address} onChange={setAddress} />
            </div>
          </div>
          {biggestLeak && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{tr(T.biggestLeak)}: </span>
              <span className="font-medium" style={{ color: grade.color }}>{tr(biggestLeak)}</span>
            </p>
          )}
        </div>
        <div className="rounded-xl p-4 flex flex-col items-center justify-center min-w-[150px]" style={{ background: 'var(--surface-raised)', border: `1px solid ${grade.color}` }}>
          <div className="text-4xl font-bold tabular-nums" style={{ color: grade.color }}>{total}</div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>/ 100</div>
          <div className="mt-1 text-sm font-semibold" style={{ color: grade.color }}>{grade.letter} · {tr(grade)}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{answered} {tr(T.ofCats)}</div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tr(c)}</h3>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {(c.key in scores ? scores[c.key] : '—')} / {c.max}
              </span>
            </div>
            <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? c.noteEs : c.noteEn}</p>
            <div className="space-y-1.5">
              {c.levels.map((lv, i) => {
                const active = scores[c.key] === lv.pts
                return (
                  <button
                    key={i} type="button"
                    onClick={() => setScores((s) => ({ ...s, [c.key]: lv.pts }))}
                    className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                    style={{
                      border: `1px solid ${active ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--border-subtle)'}`,
                      background: active ? 'color-mix(in oklab, var(--brand-500, oklch(55% 0.11 193)) 12%, transparent)' : 'transparent',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span className="tabular-nums font-semibold shrink-0 w-7 text-center" style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{lv.pts}</span>
                    <span>{L === 'es' ? lv.es : lv.en}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cost of the leak */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tr(T.costTitle)}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{tr(T.costNote)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <NumField label={tr(T.callsWk)} value={callsWk} onChange={setCallsWk} />
          <NumField label={tr(T.closeRate)} value={closeRate} onChange={setCloseRate} />
          <NumField label={tr(T.avgVal)} value={avgVal} onChange={setAvgVal} />
          <NumField label={tr(T.notCaptured)} value={notCapturedOverride} onChange={setNotCapturedOverride} placeholder={`${suggestedNotCaptured}`} />
        </div>
        {(missedPerMonth != null || lostRevenue != null) && (
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {missedPerMonth != null && (
              <Result label={tr(T.missed)} value={`${Math.round(missedPerMonth)}`} color="var(--text-primary)" />
            )}
            {lostRevenue != null && (
              <Result label={tr(T.lostRev)} value={money(lostRevenue)} color={grade.color} />
            )}
          </div>
        )}
      </div>

      {/* Save to Contacts → prefilled signup invite */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        {!savedId ? (
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? tr(T.saving) : tr(T.saveToContacts)}</button>
        ) : !inviteUrl ? (
          <>
            <span className="text-sm font-medium" style={{ color: 'oklch(72% 0.17 145)' }}>✓ {tr(T.saved)}</span>
            <button onClick={makeInvite} className="text-sm px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>{tr(T.createInvite)}</button>
          </>
        ) : (
          <div className="w-full space-y-1.5">
            <span className="text-sm font-medium" style={{ color: 'oklch(72% 0.17 145)' }}>✓ {tr(T.saved)}</span>
            <div className="flex items-center gap-2">
              <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 text-xs bg-transparent outline-none rounded-lg px-3 py-2" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }} />
              <button onClick={copyInvite} className="text-xs px-3 py-2 rounded-lg shrink-0" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>{copied ? tr(T.copied) : tr(T.copy)}</button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tr(T.inviteHint)}</p>
          </div>
        )}
        {saveErr && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{saveErr}</span>}
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium block" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm outline-none"
        style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '5px 0' }}
      />
    </div>
  )
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium block" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        type="number" inputMode="decimal" min={0} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm outline-none"
        style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '5px 0' }}
      />
    </div>
  )
}

function Result({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-overlay)' }}>
      <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color }}>{value}</div>
    </div>
  )
}
