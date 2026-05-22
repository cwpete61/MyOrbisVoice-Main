'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

type TabKey = 'coldCalling' | 'coldEmail' | 'socialMedia' | 'ads'
interface Video { id: string; title: string; author: string; start?: number }

const TABS: TabKey[] = ['coldCalling', 'coldEmail', 'socialMedia', 'ads']

// Curated playbook videos per tab. Thumbnails come from YouTube directly
// (img.youtube.com) — no API key/cost.
const VIDEOS: Record<TabKey, Video[]> = {
  coldCalling: [
    { id: 'ThE3yXiNX4o', title: 'How to Get Past The Gatekeeper (Cold Calling)', author: '30 Minutes to President’s Club', start: 265 },
    { id: 'M2OOM_rexzM', title: 'Ninja Tactics For Getting Past The Gatekeeper Every Time', author: 'Sabri Suby' },
  ],
  coldEmail: [],
  socialMedia: [],
  ads: [],
}

export default function MarketVaultPage() {
  const t = useT()
  const [tab, setTab] = useState<TabKey>('coldCalling')
  const [playing, setPlaying] = useState<string | null>(null)

  const videos = VIDEOS[tab]

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketVault.title')}</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketVault.subtitle')}</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map((k) => {
          const active = tab === k
          return (
            <button key={k} onClick={() => { setTab(k); setPlaying(null) }}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap relative"
              style={{ color: active ? TEAL : 'var(--text-tertiary)' }}>
              {t(`partnerMarketVault.tab_${k}`)}
              {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded" style={{ background: TEAL }} />}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {videos.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <span className="inline-block text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider mb-3" style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: TEAL, letterSpacing: '0.08em' }}>{t('partnerMarketVault.soonBadge')}</span>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketVault.tabEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {videos.map((v) => (
            <div key={v.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
              <div className="relative aspect-video bg-black">
                {playing === v.id ? (
                  <iframe className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1${v.start ? `&start=${v.start}` : ''}`}
                    title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                ) : (
                  <button onClick={() => setPlaying(v.id)} className="absolute inset-0 w-full h-full group" aria-label={v.title}>
                    <img src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <span className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.7)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </button>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{v.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
