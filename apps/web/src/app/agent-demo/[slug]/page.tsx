'use client'

/**
 * Public MyOrbisAgents CUSTOM agent-demo microsite: /agent-demo/<slug>.
 *
 * Richer than the §17b prospect demo (/demo/<slug>): this is backed by a real
 * per-agent demo tenant, so it embeds THAT tenant's own Orby widget (loaded with
 * the agent's DNA + their 3 listings) and shows the enriched listings + the
 * shared call line + PIN. The agent opens it from their email. Public, bilingual.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch, API_BASE } from '@/hooks/useApi'
import { useT, useLocale, type Locale } from '@/lib/i18n/I18nProvider'

const GATEWAY = process.env['NEXT_PUBLIC_WIDGET_GATEWAY'] || 'https://gateway.myorbisvoice.com'
const BRAND = 'var(--brand-500, #0f8a8a)'

interface Listing {
  id: string; address: string; headline: string | null; priceUsd: number | null
  beds: number | null; baths: number | null; sqft: number | null; propertyType: string | null
  description: string | null; highlights: string[]
}
interface DemoData {
  agentName: string; brokerage: string | null; market: string
  widgetPublicKey: string; demoPhone: string; pin: string; recommendedTier: string
  status: string; listings: Listing[]
}
interface Activity {
  calls: { id: string; at: string; durationSec: number | null; summary: string | null; who: string | null }[]
  bookings: { id: string; at: string; type: string | null; status: string; who: string | null }[]
}

const PLAN_NAME: Record<string, string> = { '297': 'Solo Capture', '497': 'Solo Power' }
const money = (n: number | null) => (n == null ? null : `$${n.toLocaleString('en-US')}`)
const telDisplay = (e164: string) => {
  const d = e164.replace(/\D/g, '')
  return d.length === 11 ? `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}` : e164
}
const fmtAt = (iso: string, es: boolean) => {
  try { return new Date(iso).toLocaleString(es ? 'es' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}

export default function AgentDemoMicrosite() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const t = useT()
  const { locale, setLocale } = useLocale()
  const [data, setData] = useState<DemoData | null>(null)
  const [act, setAct] = useState<Activity | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<DemoData>(`/api/public/agent-demo/${encodeURIComponent(slug)}`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [slug])

  // Poll the no-login activity feed — the agent calls Orby and watches their
  // own calls + bookings appear here live. Every 8s while the page is open.
  useEffect(() => {
    let cancelled = false
    const load = () => apiFetch<Activity>(`/api/public/agent-demo/${encodeURIComponent(slug)}/activity`)
      .then((a) => { if (!cancelled) setAct(a) }).catch(() => {})
    load()
    const timer = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [slug])

  // Inject the agent's OWN Orby widget once we have their publicKey.
  useEffect(() => {
    if (!data?.widgetPublicKey) return
    if (document.getElementById('orbisvoice-widget-script')) return
    const s = document.createElement('script')
    s.id = 'orbisvoice-widget-script'
    s.src = `${GATEWAY}/widget/orbisvoice-widget.js`
    s.async = true
    s.onload = () => {
      const w = window as unknown as { OrbisVoice?: { init: (o: object) => void } }
      try { w.OrbisVoice?.init({ publicKey: data.widgetPublicKey, agentName: 'Orby', businessName: data.agentName }) } catch { /* self-reports */ }
    }
    document.body.appendChild(s)
  }, [data?.widgetPublicKey, data?.agentName])

  if (err)   return <Shell setLocale={setLocale}><Center>{t('agentDemoSite.notFound')}</Center></Shell>
  if (!data) return <Shell setLocale={setLocale}><Center>{t('agentDemoSite.loading')}</Center></Shell>

  const subtitle = [data.brokerage, data.market].filter(Boolean).join(' · ')

  return (
    <Shell setLocale={setLocale}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BRAND }}>{t('agentDemoSite.badge')}</p>
      <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.agentName}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('agentDemoSite.meetOrby', { agent: data.agentName })}{subtitle ? ` · ${subtitle}` : ''}</p>
      <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)', maxWidth: '56ch' }}>{t('agentDemoSite.tagline')}</p>

      {/* Talk + call */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>💬 {t('agentDemoSite.talkHeading')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('agentDemoSite.talkBody')}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>📞 {t('agentDemoSite.callHeading')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('agentDemoSite.callBody')}</p>
          <a href={`tel:${data.demoPhone}`} className="mt-2 inline-block text-xl font-extrabold" style={{ color: BRAND }}>{telDisplay(data.demoPhone)}</a>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>PIN <strong style={{ letterSpacing: '0.12em' }}>{data.pin}</strong></div>
        </div>
      </div>

      {/* What Orby did — live, no login. Polls the activity feed. */}
      <h2 className="mt-10 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{locale === 'es' ? 'Lo que Orby hizo por ti' : 'What Orby did for you'}</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>{locale === 'es' ? 'Llama a Orby y míralo aparecer aquí — en vivo.' : 'Call Orby and watch it appear here — live.'}</p>
      {(!act || (act.calls.length === 0 && act.bookings.length === 0)) ? (
        <div className="mt-4 rounded-2xl p-5 text-sm text-center" style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)' }}>
          {locale === 'es' ? 'Aún nada. Llama al número de arriba y pregunta por una propiedad.' : 'Nothing yet. Call the number above and ask about a listing.'}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {act.bookings.map((b) => (
            <div key={b.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between gap-3 flex-wrap">
                <strong style={{ color: 'var(--text-primary)' }}>📅 {locale === 'es' ? 'Cita agendada' : 'Showing booked'}{b.who ? ` · ${b.who}` : ''}</strong>
                <span className="text-sm font-semibold" style={{ color: BRAND }}>{fmtAt(b.at, locale === 'es')}</span>
              </div>
              {b.type && <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{b.type}</div>}
            </div>
          ))}
          {act.calls.map((c) => (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between gap-3 flex-wrap">
                <strong style={{ color: 'var(--text-primary)' }}>📞 {c.who || (locale === 'es' ? 'Llamada' : 'Call')}</strong>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{c.durationSec ? `${Math.max(1, Math.round(c.durationSec / 60))} min · ` : ''}{fmtAt(c.at, locale === 'es')}</span>
              </div>
              {c.summary && <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{c.summary}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      <h2 className="mt-10 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('agentDemoSite.listingsHeading')}</h2>
      <div className="mt-4 grid gap-3">
        {data.listings.map(l => (
          <div key={l.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between gap-3 flex-wrap">
              <strong className="text-base" style={{ color: 'var(--text-primary)' }}>{l.headline || l.address}</strong>
              {money(l.priceUsd) && <span className="text-lg font-extrabold" style={{ color: BRAND }}>{money(l.priceUsd)}</span>}
            </div>
            {l.headline && <div className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{l.address}</div>}
            <div className="text-sm mt-1.5 flex gap-3 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
              {l.beds != null && <span>{l.beds} {t('agentDemoSite.beds')}</span>}
              {l.baths != null && <span>{l.baths} {t('agentDemoSite.baths')}</span>}
              {l.sqft != null && <span>{l.sqft.toLocaleString('en-US')} sqft</span>}
              {l.propertyType && <span>{l.propertyType}</span>}
            </div>
            {l.highlights.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {l.highlights.slice(0, 6).map((h, i) => (
                  <span key={i} className="text-xs rounded-full px-2.5 py-0.5" style={{ background: 'oklch(70% 0.08 190 / 0.16)', color: BRAND }}>{h}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Claim CTA (Lane B wires the real /claim checkout) */}
      <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          {t('agentDemoSite.planLabel')}: {PLAN_NAME[data.recommendedTier] ?? data.recommendedTier}
        </div>
        <a href={`${API_BASE}/api/public/agent-demo/${encodeURIComponent(slug)}/claim`}
          className="mt-3 inline-block rounded-xl px-6 py-3 font-bold text-white" style={{ background: BRAND }}>
          {t('agentDemoSite.claimCta')}
        </a>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('agentDemoSite.claimNote')}</p>
      </div>
    </Shell>
  )
}

function Shell({ children, setLocale }: { children: React.ReactNode; setLocale: (l: Locale) => void }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-app)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://myorbisagents.com" className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>MyOrbisAgents</a>
          <div className="flex gap-1">
            <button onClick={() => setLocale('en')} className="px-2 py-1 text-xs rounded" style={{ color: 'var(--text-secondary)' }}>EN</button>
            <button onClick={() => setLocale('es')} className="px-2 py-1 text-xs rounded" style={{ color: 'var(--text-secondary)' }}>ES</button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">{children}</main>
    </div>
  )
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-20 text-sm" style={{ color: 'var(--text-tertiary)' }}>{children}</div>
}
