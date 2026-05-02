'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type ReferralLink = {
  url: string
  code: string
}

type Click = {
  id: string
  clickedAt: string
  landingPath: string | null
  referrer: string | null
  convertedAt: string | null
}

export default function ReferralsPage() {
  const [link, setLink] = useState<ReferralLink | null>(null)
  const [clicks, setClicks] = useState<Click[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch<ReferralLink>('/api/affiliate/link').catch(() => null),
      apiFetch<Click[]>('/api/affiliate/clicks').catch(() => []),
    ]).then(([l, c]) => {
      setLink(l)
      setClicks(c ?? [])
      setLoading(false)
    })
  }, [])

  function copy() {
    if (!link) return
    navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Referral Links</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Share your link to earn commissions on every conversion.</p>

      {link ? (
        <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>YOUR REFERRAL LINK</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link.url}
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={copy}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: copied ? 'oklch(55% 0.18 145)' : 'var(--brand-primary)', color: '#fff', minWidth: 80 }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>Referral code: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{link.code}</span></p>
        </div>
      ) : (
        <div className="rounded-xl p-5 mb-8 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Your affiliate account must be approved before you can access your referral link.
        </div>
      )}

      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Clicks</h2>
      {clicks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No clicks yet. Share your link to start tracking.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Landing Page</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Referrer</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Converted</th>
              </tr>
            </thead>
            <tbody>
              {clicks.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{new Date(c.clickedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.landingPath ?? '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{c.referrer ? new URL(c.referrer).hostname : '—'}</td>
                  <td className="px-4 py-2.5">
                    {c.convertedAt
                      ? <span style={{ color: 'oklch(55% 0.18 145)' }}>✓ {new Date(c.convertedAt).toLocaleDateString()}</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
