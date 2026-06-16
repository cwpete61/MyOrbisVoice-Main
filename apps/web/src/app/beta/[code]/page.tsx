'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

/**
 * Public Inbound Evaluation opt-in page. Partner-attributed via the [code] route
 * param (the partner's referralCode / slug). Social posts point here ("comment
 * KEYWORD, then tap my link"); submissions land in that partner's CRM tagged
 * with the campaign track + keyword via POST /api/public/lead-optin.
 * Standalone (no app chrome), light mode, bilingual EN/ES (?lang=es + toggle).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

type L = 'en' | 'es'

const TRACK_COPY: Record<string, { en: { h: string; sub: string }; es: { h: string; sub: string } }> = {
  beta: {
    en: { h: 'Be one of 25 businesses we beta-test — free.', sub: 'We place a few real test calls to your business, then send you a one-page scorecard: does your call become a sale, or quietly slip away? Yours to keep, no pitch.' },
    es: { h: 'Sé uno de los 25 negocios que probamos — gratis.', sub: 'Hacemos unas llamadas de prueba reales a tu negocio y te mandamos un reporte de una página: ¿tu llamada se vuelve venta, o se escapa en silencio? Es tuyo, sin venta.' },
  },
  phantom: {
    en: { h: 'Meet the customers you never knew you lost.', sub: 'A free 15-minute Lead Capture Evaluation: we call your line like a customer would and show you exactly where paying customers slip out. Keep the report either way.' },
    es: { h: 'Conoce a los clientes que nunca supiste que perdiste.', sub: 'Una Evaluación gratis de 15 minutos: llamamos a tu línea como un cliente y te mostramos por dónde se escapan los clientes que pagan. Quédate el reporte de todas formas.' },
  },
  competitor: {
    en: { h: 'When the work is close, the job goes to whoever picks up first.', sub: 'Find out what happens when a customer calls YOUR line. Free test call + a one-page scorecard with your biggest leak and the fixes that matter.' },
    es: { h: 'Cuando el trabajo es parecido, el cliente se va con quien contesta primero.', sub: 'Descubre qué pasa cuando un cliente llama a TU línea. Llamada de prueba gratis + un reporte con tu fuga más grande y las mejoras que importan.' },
  },
  math: {
    en: { h: 'No fake stats. Your own numbers. The real leak.', sub: 'We won’t scream a made-up dollar figure. The free eval ends with an optional estimate built from YOUR numbers — calls/week, close rate, average job value.' },
    es: { h: 'Sin datos falsos. Tus propios números. La fuga real.', sub: 'No vamos a gritar una cifra inventada. La evaluación gratis termina con un estimado opcional con TUS números — llamadas/semana, tasa de cierre, valor promedio.' },
  },
  afterhours: {
    en: { h: 'A customer calls after close. What do they hear?', sub: 'After hours is where most local businesses bleed the most. We test it for free and map exactly what a customer with money and a need experiences.' },
    es: { h: 'Un cliente llama después de cerrar. ¿Qué escucha?', sub: 'Fuera de horario es donde más sangran los negocios locales. Lo probamos gratis y mapeamos lo que vive un cliente con dinero y una necesidad.' },
  },
}

const T = {
  en: {
    business: 'Business name', name: 'Your name', email: 'Email', phone: 'Best phone',
    niche: 'What kind of business?', nichePh: 'e.g. HVAC, dental, law, salon…',
    consent: 'I’d like a free evaluation and agree to be contacted about it.',
    submit: 'Get my free evaluation', sending: 'Sending…',
    okH: 'You’re on the list.', okSub: 'We’ll reach out to set up your free evaluation. Keep an eye on your messages — the report is yours to keep.',
    err: 'Something went wrong. Please try again.', req: 'Add a business, name, email, or phone.',
    footer: 'A free evaluation from MyOrbisVoice. We never share your info. The report is yours to keep.',
  },
  es: {
    business: 'Nombre del negocio', name: 'Tu nombre', email: 'Correo', phone: 'Mejor teléfono',
    niche: '¿Qué tipo de negocio?', nichePh: 'ej. HVAC, dental, legal, salón…',
    consent: 'Quiero una evaluación gratis y acepto que me contacten sobre ella.',
    submit: 'Quiero mi evaluación gratis', sending: 'Enviando…',
    okH: 'Ya estás en la lista.', okSub: 'Te contactaremos para coordinar tu evaluación gratis. Pendiente de tus mensajes — el reporte es tuyo.',
    err: 'Algo salió mal. Intenta de nuevo.', req: 'Agrega negocio, nombre, correo o teléfono.',
    footer: 'Una evaluación gratis de MyOrbisVoice. Nunca compartimos tu información. El reporte es tuyo.',
  },
}

export default function BetaOptInPage() {
  const params = useParams()
  const sp = useSearchParams()
  const code = (params.code as string) || ''
  const track = (sp.get('t') || 'beta').toLowerCase()
  const [lang, setLang] = useState<L>(sp.get('lang') === 'es' ? 'es' : 'en')
  const t = T[lang]
  const copy = (TRACK_COPY[track] ?? TRACK_COPY.beta!)[lang]

  const [f, setF] = useState({ businessName: '', contactName: '', email: '', phone: '', niche: '' })
  const [consent, setConsent] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [err, setErr] = useState('')
  const [founding, setFounding] = useState<{ remaining: number; cap: number; full: boolean } | null>(null)

  useEffect(() => {
    if (!code) return
    fetch(`${API}/api/public/founding-status/${encodeURIComponent(code)}`)
      .then((r) => r.json()).then((d) => setFounding(d.data)).catch(() => {})
  }, [code])

  function set(k: keyof typeof f, v: string) { setF((s) => ({ ...s, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.businessName && !f.contactName && !f.email && !f.phone) { setErr(t.req); setState('err'); return }
    setState('sending'); setErr('')
    try {
      const r = await fetch(`${API}/api/public/lead-optin`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, track, ...f, locale: lang, consent }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setState('ok')
    } catch { setErr(t.err); setState('err') }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f7', color: '#0a201f', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <strong style={{ fontSize: 18, color: '#0e8f8f' }}>MyOrbisVoice</strong>
        <button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} style={{ fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #cde0df', background: '#fff', cursor: 'pointer', color: '#0a201f' }}>
          {lang === 'en' ? 'Español' : 'English'}
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 540, background: '#fff', border: '1px solid #d8e6e5', borderRadius: 18, padding: 28, boxShadow: '0 20px 50px -35px rgba(0,0,0,.3)' }}>
        {state === 'ok' ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{t.okH}</h1>
            <p style={{ fontSize: 15, color: '#3f615f', lineHeight: 1.5 }}>{t.okSub}</p>
          </div>
        ) : (
          <>
            {founding && (
              <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 12, background: founding.full ? '#fdecea' : '#e8f6f5', color: founding.full ? '#c0392b' : '#0c6f6e' }}>
                {founding.full
                  ? (lang === 'es' ? 'Cupo de fundadores lleno este mes — lista de espera' : 'Founding cohort full this month — waitlist')
                  : (lang === 'es' ? `🔥 ${founding.remaining} de ${founding.cap} cupos de fundadores este mes` : `🔥 ${founding.remaining} of ${founding.cap} founding spots left this month`)}
              </div>
            )}
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: '0 0 10px' }}>{copy.h}</h1>
            <p style={{ fontSize: 15, color: '#3f615f', lineHeight: 1.55, margin: '0 0 20px' }}>{copy.sub}</p>
            <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
              <Input label={t.business} value={f.businessName} onChange={(v) => set('businessName', v)} />
              <Input label={t.name} value={f.contactName} onChange={(v) => set('contactName', v)} />
              <Input label={t.email} type="email" value={f.email} onChange={(v) => set('email', v)} />
              <Input label={t.phone} type="tel" value={f.phone} onChange={(v) => set('phone', v)} />
              <Input label={t.niche} value={f.niche} onChange={(v) => set('niche', v)} placeholder={t.nichePh} />
              <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#3f615f', marginTop: 2 }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                <span>{t.consent}</span>
              </label>
              {state === 'err' && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{err}</p>}
              <button type="submit" disabled={state === 'sending'} style={{ marginTop: 4, padding: '12px 16px', borderRadius: 11, border: 'none', background: 'linear-gradient(100deg, #0e8f8f, #0c6f6e)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: state === 'sending' ? 0.7 : 1 }}>
                {state === 'sending' ? t.sending : t.submit}
              </button>
            </form>
          </>
        )}
      </div>
      <p style={{ maxWidth: 540, fontSize: 12, color: '#6b8a88', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>{t.footer}</p>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#3f615f' }}>
      {label}
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cde0df', fontSize: 15, background: '#fff', color: '#0a201f' }}
      />
    </label>
  )
}
