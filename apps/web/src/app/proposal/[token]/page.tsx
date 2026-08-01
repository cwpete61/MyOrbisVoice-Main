'use client'
/* Client-facing formal proposal (/proposal/<token>). Read-only, branded, bilingual
 * EN/ES, print-to-PDF, with custom SVG charts, a payment button, and terms. */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''
const money = (n: number) => '$' + Math.round(n).toLocaleString()
const TEAL = '#0e8f8f', TEAL_BRIGHT = '#15a8a8', GREEN = '#2f8f3a', MUTED = '#93a6bd', INK = '#16202b', SUB = '#5a6b7b', LINE = '#e2e9f0', BG = '#eef3f8'

type EsContent = { heading?: string; intro?: string; whatOrby?: string[]; nextSteps?: string[]; summary?: string }
type Proposal = {
  tier: string; status: string; heading?: string; intro?: string; summary?: string; paymentLink?: string | null; paymentLinkMonthly?: string | null
  pricingJson: { plan: string; monthly: number; annual?: number | null; setup?: number; seats?: number; perSeat?: number }
  roiJson: { avgPrice: number; gciPct: number; commissionPerDeal: number; missedCallsMo: number; annualCost: number }
  whatOrbyJson?: string[]; nextStepsJson?: string[]
  linksJson?: { basicDemoUrl?: string; demoNumber?: string }
  contentEsJson?: EsContent
  application: { fullName: string; type: string; market?: string }
}

const L = {
  en: { preparedFor: 'Prepared for', tagline: 'Orby catches the calls you miss — so you keep the commission.', gap: 'The cost of missed calls', gapBody: (n: number) => `Roughly ${n} buyer call${n === 1 ? '' : 's'} a month come in on your listings after hours and reach voicemail. Most don't leave a message or call back. They dial the next agent on the listing.`,
    whatOrby: 'How Orby can help', notReplace: "She doesn't replace you. She makes sure the buyer reaches someone the moment they call.",
    math: 'By the numbers', mathBody: (avg: string, comm: string) => `Your average sale is about ${avg}, roughly ${comm} in commission per deal. Orby doesn't need to save many of those calls to pay for herself.`,
    chartRoiTitle: 'One saved deal vs. a year of Orby', chartCallsTitle: 'When your buyers call (typical)',
    orbyYear: 'Orby, per year', oneDeal: 'One recovered deal', afterHours: 'After hours / when busy', bizHours: 'Business hours',
    tryDemo: 'Try the basic Orby demo now', basicDemo: 'Basic demo, instant', listingsLoaded: 'Your listings loaded in: call', answersAs: '. Orby answers as your listing agent.',
    yourPlan: 'Your plan', foundingAnnual: 'Founding annual', forLife: "That's 50% off, locked in for life (annual billing).", preferMonthly: 'Prefer monthly?', monthlyStd: 'at the standard rate. The lifetime discount is annual only.', setupLine: (s: string) => `${s} one-time setup.`,
    terms: 'All sales are final. Annual plans are prepaid and non-refundable.',
    afterYes: 'Upon acceptance — your next steps', ready: 'Ready to launch your app?', readyBody: (num: string) => `Pick how you'd like to pay below, or reply to the email that sent you here.`, payAnnual: 'Enroll — Annual', payMonthly: 'Enroll — Monthly', bestValue: 'Best value · 50% off for life', plusSetup: 'Both include the one-time $250 setup.', langBtn: 'Español', pdf: 'Save as PDF', gone: 'This proposal link is no longer available.', loading: 'Loading…' },
  es: { preparedFor: 'Preparado para', tagline: 'Orby contesta las llamadas que pierdes — y tú te quedas con la comisión.', gap: 'El costo de las llamadas perdidas', gapBody: (n: number) => `Cerca de ${n} llamada${n === 1 ? '' : 's'} de compradores al mes llegan a tus propiedades fuera de horario y caen en el buzón. La mayoría no deja mensaje ni vuelve a llamar. Llaman al siguiente agente del listado.`,
    whatOrby: 'Cómo te ayuda Orby', notReplace: 'No te reemplaza. Se asegura de que el comprador hable con alguien en el momento en que llama.',
    math: 'En números', mathBody: (avg: string, comm: string) => `Tu venta promedio ronda ${avg}, unos ${comm} de comisión por operación. Orby no necesita salvar muchas de esas llamadas para pagarse sola.`,
    chartRoiTitle: 'Una operación salvada vs. un año de Orby', chartCallsTitle: 'Cuándo llaman tus compradores (típico)',
    orbyYear: 'Orby, por año', oneDeal: 'Una operación recuperada', afterHours: 'Fuera de horario / ocupado', bizHours: 'Horario laboral',
    tryDemo: 'Prueba la demo básica de Orby ahora', basicDemo: 'Demo básica, al instante', listingsLoaded: 'Tus propiedades cargadas: llama al', answersAs: '. Orby contesta como tu agente del listado.',
    yourPlan: 'Tu plan', foundingAnnual: 'Anual fundador', forLife: 'Eso es 50% de descuento, de por vida (pago anual).', preferMonthly: '¿Prefieres mensual?', monthlyStd: 'a la tarifa estándar. El descuento de por vida es solo anual.', setupLine: (s: string) => `${s} de configuración única.`,
    terms: 'Todas las ventas son finales. Los planes anuales se pagan por adelantado y no son reembolsables.',
    afterYes: 'Al aceptar — tus próximos pasos', ready: '¿Listo para lanzar tu app?', readyBody: () => `Elige cómo prefieres pagar abajo, o responde al correo que te trajo aquí.`, payAnnual: 'Inscribirme — Anual', payMonthly: 'Inscribirme — Mensual', bestValue: 'Mejor valor · 50% de por vida', plusSetup: 'Ambos incluyen la configuración única de $250.', langBtn: 'English', pdf: 'Guardar PDF', gone: 'Este enlace de propuesta ya no está disponible.', loading: 'Cargando…' },
} as const

export default function ProposalPage() {
  const { token } = useParams<{ token: string }>()
  const [p, setP] = useState<Proposal | null>(null)
  const [err, setErr] = useState(false)
  const [lang, setLang] = useState<'en' | 'es'>('en')

  useEffect(() => {
    fetch(`${API}/api/public/proposal/${token}`).then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setP(d.data)).catch(() => setErr(true))
  }, [token])

  if (err) return <Center>{L.en.gone}</Center>
  if (!p) return <Center>{L.en.loading}</Center>

  const t = L[lang]
  const es = p.contentEsJson
  const heading = lang === 'es' ? (es?.heading || p.heading) : p.heading
  const intro = lang === 'es' ? (es?.intro || p.intro) : p.intro
  const whatOrby = lang === 'es' ? (es?.whatOrby?.length ? es.whatOrby : p.whatOrbyJson) : p.whatOrbyJson
  const nextSteps = lang === 'es' ? (es?.nextSteps?.length ? es.nextSteps : p.nextStepsJson) : p.nextStepsJson
  const roi = p.roiJson, pr = p.pricingJson, links = p.linksJson ?? {}
  const annual = typeof pr.annual === 'number' ? pr.annual : null

  const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 14.5, textTransform: 'uppercase', letterSpacing: 1.2, color: TEAL, margin: '32px 0 10px', fontWeight: 700, fontFamily: 'system-ui,sans-serif' }}>{children}</h2>

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: 'Georgia,"Times New Roman",serif', padding: '24px 14px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
      <style>{`@media print{.noprint{display:none!important}main{background:#fff!important;padding:0!important}.sheet{box-shadow:none!important;border:0!important;max-width:100%!important}}`}</style>

      <div className="noprint" style={{ maxWidth: 760, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end', gap: 8, fontFamily: 'system-ui,sans-serif' }}>
        <button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} style={{ background: '#fff', color: SUB, border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>{t.langBtn}</button>
        <button onClick={() => window.print()} style={{ background: TEAL, color: '#fff', border: 0, borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{t.pdf}</button>
      </div>

      <div className="sheet" style={{ maxWidth: 760, margin: '0 auto', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 24px 60px rgba(20,40,70,.10)', padding: '40px 44px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${TEAL}`, paddingBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontFamily: 'system-ui,sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 18 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${TEAL_BRIGHT}, ${TEAL})`, display: 'inline-block' }} /> MyOrbisAgents
            </div>
            <div style={{ fontSize: 12.5, color: SUB, marginTop: 4 }}>{t.tagline} · <a href="https://myorbisagents.com" style={{ color: TEAL }}>myorbisagents.com</a></div>
          </div>
          <div style={{ fontSize: 13, color: SUB, fontFamily: 'system-ui,sans-serif', textAlign: 'right' }}>{t.preparedFor} <b style={{ color: INK }}>{p.application.fullName}</b>{p.application.market ? ` · ${p.application.market}` : ''}</div>
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: '26px 0 16px', letterSpacing: -0.3 }}>{heading}</h1>
        {intro && <p style={{ fontSize: 17, lineHeight: 1.6, color: '#33404d', margin: 0 }}>{intro}</p>}

        <H>{t.gap}</H>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{t.gapBody(roi.missedCallsMo)}</p>

        <H>{t.whatOrby}</H>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7, listStyleType: 'disc' }}>{(whatOrby ?? []).map((s, i) => { const x = s.trim(); return <li key={i} style={{ margin: '3px 0', display: 'list-item' }}>{/[.!?]$/.test(x) ? x : x + '.'}</li> })}</ul>
        <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 10, color: '#33404d' }}>{t.notReplace}</p>

        <H>{t.math}</H>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 18px' }}>{t.mathBody(money(roi.avgPrice), money(roi.commissionPerDeal))}</p>

        {/* Chart 1 — cost vs one recovered deal */}
        <ChartCompare title={t.chartRoiTitle}
          rows={[{ label: t.orbyYear, value: roi.annualCost, color: MUTED, display: money(roi.annualCost) + '/yr' },
                 { label: t.oneDeal, value: roi.commissionPerDeal, color: GREEN, display: money(roi.commissionPerDeal) }]} />

        {/* Chart 2 — after-hours coverage (typical) */}
        <ChartSplit title={t.chartCallsTitle} left={{ label: t.afterHours, pct: 62, color: TEAL }} right={{ label: t.bizHours, pct: 38, color: MUTED }} />

        {(links.basicDemoUrl || links.demoNumber) && (
          <>
            <H>{t.tryDemo}</H>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
              {links.basicDemoUrl && <li>{t.basicDemo}: <a href={links.basicDemoUrl} style={{ color: TEAL, fontWeight: 700 }}>{links.basicDemoUrl.replace(/^https?:\/\//, '')}</a></li>}
              {links.demoNumber && <li>{t.listingsLoaded} <b>{links.demoNumber}</b>{t.answersAs}</li>}
            </ul>
          </>
        )}

        <H>{t.yourPlan}: {pr.plan}</H>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
          {pr.seats ? <li><b>{money(pr.monthly)}/mo</b> — {pr.seats} × {money(pr.perSeat ?? 0)}</li>
            : annual ? <>
              <li><b>{t.foundingAnnual}: {money(annual)}/{lang === 'es' ? 'año' : 'year'}.</b> {t.forLife}</li>
              <li>{t.preferMonthly} <b>{money(pr.monthly)}/mo</b> {t.monthlyStd}</li>
            </> : <li><b>{money(pr.monthly)}/mo</b></li>}
          {pr.setup ? <li>{t.setupLine(money(pr.setup))}</li> : null}
        </ul>
        <p style={{ fontSize: 13.5, color: SUB, margin: '10px 0 0', fontStyle: 'italic' }}>{t.terms}</p>

        <H>{t.afterYes}</H>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>{(nextSteps ?? []).map((s, i) => <li key={i} style={{ margin: '4px 0' }}>{s}</li>)}</ol>

        <div style={{ marginTop: 32, padding: '22px 24px', background: '#f2faf9', border: `1px solid ${TEAL}33`, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 19 }}>{t.ready}</div>
          <p style={{ margin: '6px 0 14px', fontSize: 16, color: '#33404d' }}>{t.readyBody(links.demoNumber || '')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {p.paymentLink && (
              <a href={p.paymentLink} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', gap: 3, background: TEAL, color: '#fff', padding: '13px 24px', borderRadius: 9, textDecoration: 'none', fontFamily: 'system-ui,sans-serif' }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{t.payAnnual} · {annual ? money(annual) : ''}/{lang === 'es' ? 'año' : 'yr'} →</span>
                <span style={{ fontSize: 12.5, opacity: .9 }}>{t.bestValue}</span>
              </a>
            )}
            {p.paymentLinkMonthly && (
              <a href={p.paymentLinkMonthly} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', gap: 3, background: '#fff', color: TEAL, border: `2px solid ${TEAL}`, padding: '12px 22px', borderRadius: 9, textDecoration: 'none', fontFamily: 'system-ui,sans-serif' }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{t.payMonthly} · {money(pr.monthly)}/mo →</span>
                <span style={{ fontSize: 12.5, opacity: .8 }}>{t.plusSetup}</span>
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 13, color: SUB, fontFamily: 'system-ui,sans-serif' }}>Crawford · MyOrbisAgents · <a href="https://myorbisagents.com/" style={{ color: TEAL }}>myorbisagents.com</a></div>
      </div>
    </main>
  )
}

// Horizontal magnitude bars (two rows), direct-labeled, print-safe.
function ChartCompare({ title, rows }: { title: string; rows: { label: string; value: number; color: string; display: string }[] }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <figure style={{ margin: '4px 0 8px', border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px', background: '#fafcfe' }}>
      <figcaption style={{ fontSize: 13, fontWeight: 700, color: SUB, fontFamily: 'system-ui,sans-serif', marginBottom: 12, textTransform: 'uppercase', letterSpacing: .6 }}>{title}</figcaption>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: i < rows.length - 1 ? 14 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontFamily: 'system-ui,sans-serif', marginBottom: 5 }}>
            <span style={{ color: INK }}>{r.label}</span><b style={{ color: r.color }}>{r.display}</b>
          </div>
          <div style={{ height: 16, background: '#eaf0f6', borderRadius: 8 }}>
            <div style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, height: '100%', background: r.color, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </figure>
  )
}

// 100% split bar (two segments), labeled — for the after-hours coverage share.
function ChartSplit({ title, left, right }: { title: string; left: { label: string; pct: number; color: string }; right: { label: string; pct: number; color: string } }) {
  return (
    <figure style={{ margin: '16px 0 8px', border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px', background: '#fafcfe' }}>
      <figcaption style={{ fontSize: 13, fontWeight: 700, color: SUB, fontFamily: 'system-ui,sans-serif', marginBottom: 12, textTransform: 'uppercase', letterSpacing: .6 }}>{title}</figcaption>
      <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', border: `1px solid ${LINE}` }}>
        <div style={{ width: `${left.pct}%`, background: left.color, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui,sans-serif' }}>{left.pct}%</div>
        <div style={{ width: `${right.pct}%`, background: right.color, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui,sans-serif' }}>{right.pct}%</div>
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 13, fontFamily: 'system-ui,sans-serif', color: SUB }}>
        <span><Dot c={left.color} /> {left.label}</span><span><Dot c={right.color} /> {right.label}</span>
      </div>
    </figure>
  )
}
const Dot = ({ c }: { c: string }) => <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c, marginRight: 5, verticalAlign: 'middle' }} />

function Center({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG, color: SUB, fontFamily: 'system-ui,sans-serif' }}>{children}</main>
}
