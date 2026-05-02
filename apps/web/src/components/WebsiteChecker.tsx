'use client'

import { useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type Finding = {
  ok: boolean | null
  label: string
  detail: string
}

type CheckResult = {
  url: string
  reachable: boolean
  finalUrl?: string
  fetchError?: string
  contentType?: string
  findings: Finding[]
  pagesChecked: string[]
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === true) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0"
        style={{ background: 'oklch(55% 0.15 145)', color: '#fff' }}>✓</span>
    )
  }
  if (ok === false) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0"
        style={{ background: 'oklch(60% 0.20 25)', color: '#fff' }}>✗</span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0"
      style={{ background: 'oklch(75% 0.15 80)', color: '#fff' }}>?</span>
  )
}

export function WebsiteChecker() {
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState('')

  async function run() {
    if (!url.trim()) { setError('Enter a URL to check'); return }
    setError('')
    setRunning(true)
    setResult(null)
    try {
      const data = await apiFetch<CheckResult>('/api/integrations/website-check', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    }
    setRunning(false)
  }

  const passCount = result?.findings.filter(f => f.ok === true).length ?? 0
  const failCount = result?.findings.filter(f => f.ok === false).length ?? 0
  const unknownCount = result?.findings.filter(f => f.ok === null).length ?? 0

  return (
    <div className="rounded-xl mt-3 mb-2 p-4" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
      <div className="flex items-center gap-2 mb-1">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(45% 0.11 193)' }}>
          <circle cx="8" cy="8" r="6" />
          <path d="M5 8l2 2 4-4" />
        </svg>
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Pre-flight: Check my website</span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Audits your live site for the elements Twilio reviewers look for during 10DLC and Voice Integrity approval. Best-effort —
        verify any ⚠ items manually if your site uses heavy JavaScript or blocks scrapers.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="https://yoursite.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !running && run()}
          disabled={running}
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={run}
          disabled={running || !url.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: running || !url.trim() ? 'var(--surface-app)' : 'oklch(55% 0.11 193)',
            color: running || !url.trim() ? 'var(--text-tertiary)' : '#fff',
            border: running || !url.trim() ? '1px solid var(--border-subtle)' : 'none',
            cursor: running || !url.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Checking…' : 'Check site'}
        </button>
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'oklch(95% 0.05 25 / 0.5)', color: 'oklch(45% 0.18 25)' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>RESULT</span>
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'oklch(55% 0.15 145 / 0.15)', color: 'oklch(45% 0.13 145)' }}>{passCount} passed</span>
            {failCount > 0 && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'oklch(60% 0.20 25 / 0.15)', color: 'oklch(45% 0.18 25)' }}>{failCount} failed</span>}
            {unknownCount > 0 && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'oklch(75% 0.15 80 / 0.18)', color: 'oklch(45% 0.16 80)' }}>{unknownCount} unverified</span>}
          </div>

          <div className="space-y-2.5">
            {result.findings.map((f, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <StatusIcon ok={f.ok} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {result.pagesChecked.length > 0 && (
            <p className="text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>
              Pages checked: {result.pagesChecked.map(u => <span key={u} className="font-mono">{u} </span>)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
