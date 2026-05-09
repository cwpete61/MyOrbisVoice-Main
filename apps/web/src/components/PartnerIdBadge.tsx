'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

// Mirrors TenantIdBadge in shape + behavior — anchored top-right of the
// partner portal layout, click-to-copy. Shows the partner's referralCode
// (the public ID they share with prospects), which is the most useful
// identifier for support conversations and link debugging. Falls back to
// the JWT sub (user ID) if /api/affiliate/link isn't reachable.
export function PartnerIdBadge() {
  const t = useT()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiFetch<{ code: string; url: string }>('/api/affiliate/link')
      .then(d => setCode(d?.code ?? null))
      .catch(() => setCode(null))
  }, [])

  if (!code) return null

  function copy() {
    navigator.clipboard.writeText(code!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title={`Partner ID: ${code} — click to copy`}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors"
      style={{
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border-subtle)',
        color: copied ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="9" height="9" rx="1" />
        <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
      </svg>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerIdBadge.label')}</span>
      <span className="font-mono text-xs">{copied ? t('partnerIdBadge.copied') : code}</span>
    </button>
  )
}
