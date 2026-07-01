'use client'

/**
 * MyOrbisAgents — public personalized demo page (§17b, Step 5). Auto-generated
 * per prospect from the operator console. One shared demo widget (default RE-ISA
 * DNA, publicKey from the API); the page copy is personalized by prospect.
 * Public (no auth), mobile-first, bilingual. Mirrors /book/[slug] shell pattern.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale, type Locale } from '@/lib/i18n/I18nProvider'

interface DemoInfo {
  name: string
  brokerage: string | null
  market: string | null
  pitchAngle: string | null
  recommendedTier: string | null
  demoPublicKey: string
}

const GATEWAY = process.env['NEXT_PUBLIC_WIDGET_GATEWAY'] || 'https://gateway.myorbisvoice.com'

export default function PublicDemoPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const t = useT()
  const { setLocale } = useLocale()
  const [info, setInfo] = useState<DemoInfo | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<DemoInfo>(`/api/public/demo/${encodeURIComponent(slug)}`)
      .then((d) => { if (!cancelled) setInfo(d) })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [slug])

  // Inject the shared demo widget once we have the publicKey. Guarded so React
  // strict-mode double-effects don't double-load the script.
  useEffect(() => {
    if (!info?.demoPublicKey) return
    if (document.getElementById('orbisvoice-widget-script')) return
    const s = document.createElement('script')
    s.id = 'orbisvoice-widget-script'
    s.src = `${GATEWAY}/widget/orbisvoice-widget.js`
    s.async = true
    s.onload = () => {
      const w = window as unknown as { OrbisVoice?: { init: (o: { publicKey: string }) => void } }
      try { w.OrbisVoice?.init({ publicKey: info.demoPublicKey }) } catch { /* widget self-reports */ }
    }
    document.body.appendChild(s)
  }, [info?.demoPublicKey])

  if (err) {
    return (
      <Shell setLocale={setLocale}>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('publicDemo.notFoundTitle')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('publicDemo.notFoundBody')}</p>
        </div>
      </Shell>
    )
  }
  if (!info) {
    return (
      <Shell setLocale={setLocale}>
        <div className="text-center py-20"><p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('publicDemo.loading')}</p></div>
      </Shell>
    )
  }

  const subtitle = [info.brokerage, info.market].filter(Boolean).join(' · ')

  return (
    <Shell setLocale={setLocale}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-500, #0f8a8a)' }}>{t('publicDemo.kicker')}</p>
      <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {t('publicDemo.headline', { name: info.name })}
      </h1>
      {subtitle && <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>}
      <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)', maxWidth: '56ch' }}>{t('publicDemo.sub')}</p>
      {info.pitchAngle && <p className="mt-3 text-base italic" style={{ color: 'var(--text-secondary)' }}>💬 {info.pitchAngle}</p>}

      <div className="mt-8 rounded-2xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('publicDemo.tryTitle')}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('publicDemo.tryHint')}</p>
        <ul className="mt-3 space-y-1.5 text-base" style={{ color: 'var(--text-primary)' }}>
          <li>{t('publicDemo.q1')}</li>
          <li>{t('publicDemo.q2')}</li>
          <li>{t('publicDemo.q3')}</li>
        </ul>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('publicDemo.tryNote')}</p>
      </div>

      <div className="mt-6 rounded-2xl p-5" style={{ background: 'oklch(70% 0.08 190 / 0.14)', border: '1px solid oklch(70% 0.08 190 / 0.35)' }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--brand-500, #0f8a8a)' }}>{t('publicDemo.offerTitle')}</div>
        <p className="text-base" style={{ color: 'var(--text-primary)' }}>{t('publicDemo.offer')}</p>
      </div>

      <p className="mt-10 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>{t('publicDemo.poweredBy')}</p>
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
