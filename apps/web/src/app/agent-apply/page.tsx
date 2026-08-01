'use client'
/* Public Agent Qualifier intake — an RE agent (Individual) or team/broker (Team)
 * self-reports their business. Bilingual EN/ES, light/dark theme. We never show a
 * score; on submit the applicant just gets a thank-you. Operator sees it in admin. */
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

type Lang = 'en' | 'es'
const C = {
  en: {
    eyebrow: 'MyOrbisAgents · Partner application',
    title: 'See if Orby is a fit for your business',
    sub: 'Tell us about your real estate business needs, challenges, and successes.\n\nWe review every application and respond within 1–2 business days of your submitted form.',
    who: 'I am applying as', indiv: 'An individual agent', team: 'A team / broker',
    name: 'Full name', email: 'Email', phone: 'Phone', market: 'Primary market (city/area)',
    years: 'Real Estate Experience (# of Years)', crm: 'CRM / tools you use', bottleneck: 'Describe your largest bottleneck',
    leads: 'How many new leads / prospects do you get per week?', budget: "What's your marketing and advertising budget?", timeline: 'Projected Start Date',
    deals: 'Productivity — Number of Sales Per Year?', avg: 'Average sale price (USD)',
    missing: 'Are you missing calls after hours / when busy?',
    missedPerWeek: 'Estimate the number of calls missed per week',
    heard: 'How did you hear about us?', heardAgent: 'Agent', heardWeb: 'Web', heardSocial: 'Social Media', heardReferral: 'Referral', heardOther: 'Other',
    seats: 'Number of agents / seats', teamDeals: 'Team deals closed (last 12 months)',
    dm: 'Are you the decision-maker?', office: 'Would you deploy Orby office-wide?',
    yes: 'Yes', no: 'No', submit: 'Submit application', sending: 'Sending…',
    thanksTitle: 'Application received 🎉', thanksBody: 'Thank you! We review every application and will follow up personally by email soon.',
    langBtn: 'Español', req: 'Please fill in your name and email.',
  },
  es: {
    eyebrow: 'MyOrbisAgents · Solicitud de socio',
    title: 'Descubre si Orby encaja con tu negocio',
    sub: 'Cuéntanos sobre las necesidades, retos y éxitos de tu negocio inmobiliario.\n\nRevisamos cada solicitud y respondemos dentro de 1 a 2 días hábiles de tu formulario enviado.',
    who: 'Aplico como', indiv: 'Un agente individual', team: 'Un equipo / bróker',
    name: 'Nombre completo', email: 'Correo', phone: 'Teléfono', market: 'Mercado principal (ciudad/zona)',
    years: 'Experiencia en bienes raíces (# de años)', crm: 'CRM / herramientas que usas', bottleneck: 'Describe tu mayor obstáculo',
    leads: '¿Cuántos leads / prospectos nuevos recibes por semana?', budget: '¿Cuál es tu presupuesto de marketing y publicidad?', timeline: 'Fecha de inicio proyectada',
    deals: 'Productividad — ¿número de ventas por año?', avg: 'Precio de venta promedio (USD)',
    missing: '¿Pierdes llamadas fuera de horario / cuando estás ocupado?',
    missedPerWeek: 'Estima el número de llamadas perdidas por semana',
    heard: '¿Cómo te enteraste de nosotros?', heardAgent: 'Agente', heardWeb: 'Web', heardSocial: 'Redes sociales', heardReferral: 'Referido', heardOther: 'Otro',
    seats: 'Número de agentes / puestos', teamDeals: 'Operaciones del equipo (últimos 12 meses)',
    dm: '¿Eres quien toma la decisión?', office: '¿Desplegarías a Orby en toda la oficina?',
    yes: 'Sí', no: 'No', submit: 'Enviar solicitud', sending: 'Enviando…',
    thanksTitle: 'Solicitud recibida 🎉', thanksBody: '¡Gracias! Revisamos cada solicitud y te contactaremos personalmente por correo pronto.',
    langBtn: 'English', req: 'Completa tu nombre y correo.',
  },
} as const

// Theme palettes as CSS-variable maps, applied on the <main> wrapper.
const THEME = {
  dark: {
    '--bg': 'radial-gradient(1200px 800px at 50% -10%,#16233a,#070d18 60%)',
    '--panel': 'rgba(15,28,48,.7)', '--ink': '#e8eef7', '--sub': '#9fb0c7', '--faint': '#7a8aa0',
    '--border': '#22344f', '--inp': '#0c1626', '--accent': '#1fc3c3',
    '--btnbg': 'linear-gradient(135deg,#5fe6e6,#0e8f8f)', '--btntext': '#03201f',
    '--chip': 'rgba(31,195,195,.15)', '--okbg': '#0f1c30', '--okborder': '#2f8f3a', '--err': '#ff8a80',
  },
  light: {
    '--bg': 'radial-gradient(1200px 800px at 50% -10%,#e9f2fb,#f6f9fd 60%)',
    '--panel': '#ffffff', '--ink': '#10202f', '--sub': '#4a5b72', '--faint': '#7a8aa0',
    '--border': '#d6e0ec', '--inp': '#f4f7fb', '--accent': '#0e8f8f',
    '--btnbg': 'linear-gradient(135deg,#15a8a8,#0b6e6e)', '--btntext': '#ffffff',
    '--chip': 'rgba(14,143,143,.12)', '--okbg': '#eefaf0', '--okborder': '#2f8f3a', '--err': '#c0392b',
  },
} as const

export default function AgentApplyPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [dark, setDark] = useState(false) // default light
  const [type, setType] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL')
  const [f, setF] = useState<Record<string, string | boolean>>({})
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const t = C[lang]
  const set = (k: string, v: string | boolean) => setF(p => ({ ...p, [k]: v }))

  // Default is light; only a previously saved choice overrides it.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('mm_apply_theme') : null
    if (saved) setDark(saved === 'dark')
  }, [])
  function toggleTheme() { setDark(d => { const n = !d; try { window.localStorage.setItem('mm_apply_theme', n ? 'dark' : 'light') } catch {} return n }) }

  async function submit() {
    setErr('')
    if (!f.fullName || !f.email) { setErr(t.req); return }
    setBusy(true)
    const metricKeys = type === 'TEAM'
      ? ['years', 'crm', 'bottleneck', 'monthlyLeads', 'budgetMo', 'timelineDays', 'seats', 'teamDeals', 'decisionMaker', 'deployOfficeWide', 'heardAbout']
      : ['years', 'crm', 'bottleneck', 'monthlyLeads', 'budgetMo', 'timelineDays', 'dealsLast12', 'avgPriceUsd', 'missingAfterHours', 'missedPerWeek', 'heardAbout']
    const metrics: Record<string, string | number | boolean> = {}
    for (const k of metricKeys) {
      const v = f[k]
      if (v === undefined) continue
      // Projected Start Date arrives as a YYYY-MM-DD string — convert to days-from-now for scoring.
      if (k === 'timelineDays' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        metrics[k] = Math.max(0, Math.round((new Date(v).getTime() - Date.now()) / 86400000)); continue
      }
      if (typeof v === 'boolean') metrics[k] = v
      else if (['monthlyLeads', 'budgetMo', 'timelineDays', 'seats', 'teamDeals', 'dealsLast12', 'avgPriceUsd', 'years', 'missedPerWeek'].includes(k)) metrics[k] = Number(v) || 0
      else metrics[k] = v
    }
    try {
      const res = await fetch(`${API}/api/public/agent-application`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, fullName: f.fullName, email: f.email, phone: f.phone, market: f.market, metrics, lang }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch { setErr(lang === 'es' ? 'Algo salió mal. Intenta de nuevo.' : 'Something went wrong. Please try again.') }
    finally { setBusy(false) }
  }

  const inp = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--inp)', color: 'var(--ink)', fontSize: 15, outline: 'none' } as const
  const label = { display: 'block', fontSize: 13, color: 'var(--sub)', margin: '14px 0 6px', fontWeight: 600 } as const
  const Field = ({ dk, lk, type: it = 'text' }: { dk: string; lk: keyof typeof t; type?: string }) => (
    <label><span style={label}>{t[lk]}</span><input style={inp} type={it} value={String(f[dk] ?? '')} onChange={e => set(dk, e.target.value)} /></label>
  )
  const YesNo = ({ dk, lk }: { dk: string; lk: keyof typeof t }) => (
    <div><span style={label}>{t[lk]}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {([['true', t.yes], ['false', t.no]] as const).map(([v, lbl]) => (
          <button key={v} type="button" onClick={() => set(dk, v === 'true')}
            style={{ flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              border: '1px solid ' + (String(f[dk]) === v ? 'var(--accent)' : 'var(--border)'),
              background: String(f[dk]) === v ? 'var(--chip)' : 'var(--inp)', color: 'var(--ink)' }}>{lbl}</button>
        ))}
      </div>
    </div>
  )
  const Radio = ({ dk, lk, opts }: { dk: string; lk: keyof typeof t; opts: { v: string; lk: keyof typeof t }[] }) => (
    <div><span style={label}>{t[lk]}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opts.map(o => (
          <button key={o.v} type="button" onClick={() => set(dk, o.v)}
            style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              border: '1px solid ' + (f[dk] === o.v ? 'var(--accent)' : 'var(--border)'),
              background: f[dk] === o.v ? 'var(--chip)' : 'var(--inp)', color: 'var(--ink)' }}>{t[o.lk]}</button>
        ))}
      </div>
    </div>
  )
  const iconBtn = { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--sub)', borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 } as const

  return (
    <main style={{ ...(THEME[dark ? 'dark' : 'light'] as React.CSSProperties), minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', padding: '32px 16px', transition: 'background .2s' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
          <button onClick={toggleTheme} aria-label="Toggle light/dark" title="Light / Dark" style={iconBtn}>{dark ? '☀️ Light' : '🌙 Dark'}</button>
          <button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} style={iconBtn}>{t.langBtn}</button>
        </div>
        {sent ? (
          <div style={{ background: 'var(--okbg)', border: '1px solid var(--okborder)', borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <h1 style={{ fontSize: 26, margin: '0 0 10px', color: 'var(--ink)' }}>{t.thanksTitle}</h1>
            <p style={{ color: 'var(--sub)', margin: 0 }}>{t.thanksBody}</p>
          </div>
        ) : (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, backdropFilter: 'blur(12px)', boxShadow: dark ? 'none' : '0 20px 50px rgba(20,40,70,.10)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10, textAlign: 'center' }}>{t.eyebrow}</div>
            <h1 style={{ fontSize: 26, margin: '0 0 6px', letterSpacing: -0.5, color: 'var(--ink)', textTransform: 'uppercase' }}>{t.title}</h1>
            <p style={{ color: 'var(--sub)', marginTop: 0, fontSize: 14.5, whiteSpace: 'pre-line' }}>{t.sub}</p>

            <span style={label}>{t.who}</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {([['INDIVIDUAL', t.indiv], ['TEAM', t.team]] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setType(v)}
                  style={{ flex: 1, padding: '13px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14.5,
                    border: '1px solid ' + (type === v ? 'var(--accent)' : 'var(--border)'),
                    background: type === v ? 'var(--chip)' : 'var(--inp)', color: 'var(--ink)' }}>{lbl}</button>
              ))}
            </div>

            <Field dk="fullName" lk="name" /><Field dk="email" lk="email" type="email" /><Field dk="phone" lk="phone" /><Field dk="market" lk="market" />
            <Field dk="years" lk="years" type="number" /><Field dk="crm" lk="crm" /><Field dk="bottleneck" lk="bottleneck" />
            <Field dk="monthlyLeads" lk="leads" type="number" /><Field dk="budgetMo" lk="budget" type="number" /><Field dk="timelineDays" lk="timeline" type="date" />

            {type === 'INDIVIDUAL' ? (
              <><Field dk="dealsLast12" lk="deals" type="number" /><Field dk="avgPriceUsd" lk="avg" type="number" /><YesNo dk="missingAfterHours" lk="missing" /><Field dk="missedPerWeek" lk="missedPerWeek" type="number" /></>
            ) : (
              <><Field dk="seats" lk="seats" type="number" /><Field dk="teamDeals" lk="teamDeals" type="number" /><YesNo dk="decisionMaker" lk="dm" /><YesNo dk="deployOfficeWide" lk="office" /></>
            )}

            <div style={{ marginTop: 4 }}>
              <Radio dk="heardAbout" lk="heard" opts={[{ v: 'Agent', lk: 'heardAgent' }, { v: 'Web', lk: 'heardWeb' }, { v: 'Social Media', lk: 'heardSocial' }, { v: 'Referral', lk: 'heardReferral' }, { v: 'Other', lk: 'heardOther' }]} />
            </div>

            {err && <p style={{ color: 'var(--err)', fontSize: 13, marginTop: 14 }}>{err}</p>}
            <button onClick={submit} disabled={busy}
              style={{ width: '100%', marginTop: 22, padding: '15px', borderRadius: 12, border: 0, cursor: 'pointer', fontWeight: 800, fontSize: 16,
                background: 'var(--btnbg)', color: 'var(--btntext)', opacity: busy ? 0.6 : 1 }}>
              {busy ? t.sending : t.submit}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
