'use client'

import { useState, useEffect } from 'react'
import { getTokenPayload } from '@/lib/auth'

export function TenantIdBadge() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const payload = getTokenPayload() as { tenantId?: string } | null
    setTenantId(payload?.tenantId ?? null)
  }, [])

  if (!tenantId) return null

  function copy() {
    navigator.clipboard.writeText(tenantId!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const short = tenantId.slice(0, 8)

  return (
    <button
      onClick={copy}
      title={`Tenant ID: ${tenantId} — click to copy`}
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
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Tenant ID:</span>
      <span className="font-mono text-xs">{copied ? 'Copied!' : short}</span>
    </button>
  )
}
