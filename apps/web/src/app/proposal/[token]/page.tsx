'use client'
/* Client-facing formal proposal, opened from a shareable link (/proposal/<token>).
 * Read-only, branded (MyOrbisAgents teal/ink), print-to-PDF. No login. */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''
const money = (n: number) => '$' + Math.round(n).toLocaleString()

type Proposal = {
  tier: string; status: string; heading?: string; intro?: string; summary?: string
  pricingJson: { plan: string; monthly: number; annual?: number | null; setup?: number; seats?: number; perSeat?: number }
  roiJson: { avgPrice: number; gciPct: number; commissionPerDeal: number; missedCallsMo: number; annualCost: number }
  whatOrbyJson?: string[]; nextStepsJson?: string[]
  linksJson?: { basicDemoUrl?: string; demoNumber?: string; micrositeUrl?: string }
  application: { fullName: string; type: string; market?: string }
}

const TEAL = '#0e8f8f', TEAL_BRIGHT = '#15a8a8', INK = '#16202b', SUB = '#5a6b7b', LINE = '#e2e9f0', BG = '#eef3f8'

export default function ProposalPage() {
  const { token } = useParams<{ token: string }>()
  const [p, setP] = useState<Proposal | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/public/proposal/${token}`).then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setP(d.data)).catch(() => setErr(true))
  }, [token])

  if (err) return <Center>This proposal link is no longer available.</Center>
  if (!p) return <Center>Loading…</Center>

  const roi = p.roiJson, pr = p.pricingJson, links = p.linksJson ?? {}
  const annual = typeof pr.annual === 'number' ? pr.annual : null
  const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 1.2, color: TEAL, margin: '30px 0 10px', fontWeight: 700 }}>{children}</h2>

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: 'Georgia, "Times New Roman", serif', padding: '28px 14px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
      <style>{`@media print { .noprint{display:none!important} main{background:#fff!important;padding:0!important} .sheet{box-shadow:none!important;border:0!important;max-width:100%!important} }`}</style>

      <div className="noprint" style={{ maxWidth: 760, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => window.print()} style={{ background: TEAL, color: '#fff', border: 0, borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui,sans-serif', fontSize: 14 }}>Save as PDF</button>
      </div>

      <div className="sheet" style={{ maxWidth: 760, margin: '0 auto', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 24px 60px rgba(20,40,70,.10)', padding: '40px 44px 48px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${TEAL}`, paddingBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 18, fontFamily: 'system-ui,sans-serif' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${TEAL_BRIGHT}, ${TEAL})`, display: 'inline-block' }} /> MyOrbisAgents
          </div>
          <div style={{ fontSize: 13, color: SUB, fontFamily: 'system-ui,sans-serif', textAlign: 'right' }}>
            Prepared for <b style={{ color: INK }}>{p.application.fullName}</b>{p.application.market ? ` · ${p.application.market}` : ''}
          </div>
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: '26px 0 16px', letterSpacing: -0.3 }}>{p.heading ?? 'Your MyOrbisAgents proposal'}</h1>
        {p.intro && <p style={{ fontSize: 17, lineHeight: 1.6, color: '#33404d', margin: 0 }}>{p.intro}</p>}

        <H>The gap, in your numbers</H>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          Roughly {roi.missedCallsMo} buyer call{roi.missedCallsMo === 1 ? '' : 's'} a month come in on your listings after hours and reach voicemail. Most don&apos;t leave a message or call back. They dial the next agent on the listing.
        </p>

        <H>What Orby does</H>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
          {(p.whatOrbyJson ?? []).map((s, i) => <li key={i} style={{ margin: '3px 0' }}>{s}</li>)}
        </ul>
        <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 10, color: '#33404d' }}>She doesn&apos;t replace you. She makes sure the buyer reaches someone the moment they call.</p>

        <H>The math, kept conservative</H>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 12px' }}>
          Your average sale is about {money(roi.avgPrice)}, roughly <b>{money(roi.commissionPerDeal)}</b> in commission per deal. Orby doesn&apos;t need to save many of those calls to pay for herself.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, fontFamily: 'system-ui,sans-serif' }}>
          <thead><tr style={{ color: SUB, textAlign: 'left' }}><th style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}` }}>If Orby recovers</th><th style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}` }}>Added commission / yr</th><th style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}` }}>Orby cost / yr</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '8px 10px' }}>1 deal a year</td><td style={{ padding: '8px 10px', color: TEAL, fontWeight: 700 }}>~{money(roi.commissionPerDeal)}</td><td style={{ padding: '8px 10px' }}>{money(roi.annualCost)}</td></tr>
            <tr style={{ borderTop: `1px solid ${LINE}` }}><td style={{ padding: '8px 10px' }}>1 deal a quarter</td><td style={{ padding: '8px 10px', color: TEAL, fontWeight: 700 }}>~{money(roi.commissionPerDeal * 4)}</td><td style={{ padding: '8px 10px' }}>{money(roi.annualCost)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 15, color: SUB, marginTop: 8 }}>One saved deal covers her for years. Everything after that is upside.</p>

        {(links.basicDemoUrl || links.demoNumber) && (
          <>
            <H>Try the basic demo now</H>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
              {links.basicDemoUrl && <li>Basic demo, instant: <a href={links.basicDemoUrl} style={{ color: TEAL, fontWeight: 700 }}>{links.basicDemoUrl.replace(/^https?:\/\//, '')}</a></li>}
              {links.demoNumber && <li>Your listings loaded in: call <b>{links.demoNumber}</b>. Orby answers as your listing agent.</li>}
            </ul>
          </>
        )}

        <H>Your plan: {pr.plan}</H>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
          {pr.seats ? (
            <li><b>{money(pr.monthly)}/mo</b> — {pr.seats} seats × {money(pr.perSeat ?? 0)}</li>
          ) : annual ? (
            <>
              <li><b>Founding annual: {money(annual)}/year.</b> That&apos;s 50% off, locked in for life (annual billing).</li>
              <li>Prefer monthly? <b>{money(pr.monthly)}/mo</b> at the standard rate. The lifetime discount is annual only.</li>
            </>
          ) : (
            <li><b>{money(pr.monthly)}/mo</b></li>
          )}
          {pr.setup ? <li>{money(pr.setup)} one-time setup. No contract. Cancel anytime.</li> : <li>No contract. Cancel anytime.</li>}
        </ul>

        <H>What happens after you say yes</H>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.7 }}>
          {(p.nextStepsJson ?? []).map((s, i) => <li key={i} style={{ margin: '4px 0' }}>{s}</li>)}
        </ol>

        <div style={{ marginTop: 32, padding: '20px 22px', background: '#f2faf9', border: `1px solid ${TEAL}33`, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Ready to start?</div>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: '#33404d' }}>Reply to the email that sent you here, or call {links.demoNumber || 'us'}. We&apos;ll have you live within a day.</p>
        </div>

        <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 13, color: SUB, fontFamily: 'system-ui,sans-serif' }}>
          Crawford · MyOrbisAgents · <a href="https://myorbisagents.com/" style={{ color: TEAL }}>myorbisagents.com</a>
        </div>
      </div>
    </main>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG, color: SUB, fontFamily: 'system-ui,sans-serif' }}>{children}</main>
}
