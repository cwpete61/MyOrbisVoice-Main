'use client'

/**
 * Admin Webinar Marketing — list detail. Pipeline status, per-stage counts,
 * action buttons (Start discovery / Archive / Export CSV), review-queue link.
 */

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { WEBINAR_THEME_VARS } from '@/components/webinar-marketing/theme'

interface LeadListDetail {
  id: string
  name: string
  niche: string
  location: string
  optionalEmailDomainFilter: string | null
  status: 'DRAFT' | 'DISCOVERING' | 'EXTRACTING' | 'VERIFYING' | 'READY' | 'ARCHIVED'
  searchEngines: string[]
  maxResultsPerQuery: number
  maxPagesPerDomain: number
  verificationMode: 'SYNTAX_DNS_ONLY' | 'EXTERNAL_PROVIDER'
  allowedEmailTypes: string[]
  createdAt: string
  updatedAt: string
  _count: { searchQueries: number; discoveredUrls: number; extractedEmails: number; inviteContacts: number }
}

const STATUS_COLORS: Record<LeadListDetail['status'], string> = {
  DRAFT: '#6b7280',
  DISCOVERING: '#0ea5e9',
  EXTRACTING: '#8b5cf6',
  VERIFYING: '#f59e0b',
  READY: '#10b981',
  ARCHIVED: '#374151',
}

export default function AdminWebinarListDetailPage() {
  const params = useParams<{ id: string }>()
  const listId = params.id
  const { data: list, loading, error, reload } = useApi<LeadListDetail>(
    `/api/admin/webinar-marketing/lists/${listId}`,
  )
  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Loading…</div>
  if (error || !list) return <div style={{ padding: 32, color: '#ef4444' }}>Error: {String(error)}</div>

  async function action(method: 'POST' | 'DELETE', path: string, success: string) {
    setBusy(true)
    setActionMsg(null)
    try {
      await apiFetch(path, { method })
      setActionMsg(success)
      reload()
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const canStartDiscovery = list.status === 'DRAFT' || list.status === 'DISCOVERING'
  const canArchive = list.status !== 'ARCHIVED'
  const canExport = list._count.inviteContacts > 0

  return (
    <div style={{ ...WEBINAR_THEME_VARS, maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/admin/webinar-marketing" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
        ← Back to lists
      </Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{list.name}</h1>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {list.niche} · {list.location}
            {list.optionalEmailDomainFilter && <> · filter: <code>{list.optionalEmailDomainFilter}</code></>}
          </p>
        </div>
        <StatusPill status={list.status} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <Stat label="Queries enqueued" value={list._count.searchQueries} />
        <Stat label="URLs discovered" value={list._count.discoveredUrls} />
        <Stat label="Emails extracted" value={list._count.extractedEmails} />
        <Stat label="Invite contacts" value={list._count.inviteContacts} highlight />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button type="button" disabled={busy || !canStartDiscovery}
          onClick={() => action('POST', `/api/admin/webinar-marketing/lists/${list.id}/discover`, 'Discovery queued')}
          style={actionBtn(true, busy || !canStartDiscovery)}>
          {list.status === 'DRAFT' ? '▶ Start discovery' : '↻ Re-enqueue queries'}
        </button>
        <Link href={`/admin/webinar-marketing/${list.id}/queue`} style={actionLink(false)}>
          Review queue →
        </Link>
        <a href={canExport ? `/api/admin/webinar-marketing/lists/${list.id}/export` : '#'}
          onClick={(e) => { if (!canExport) e.preventDefault() }}
          style={{ ...actionLink(false), opacity: canExport ? 1 : 0.4, pointerEvents: canExport ? 'auto' : 'none' }}>
          ⬇ Export CSV
        </a>
        <button type="button" disabled={busy || !canArchive}
          onClick={() => action('DELETE', `/api/admin/webinar-marketing/lists/${list.id}`, 'List archived')}
          style={actionBtn(false, busy || !canArchive, true)}>
          Archive
        </button>
      </div>

      {actionMsg && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, marginBottom: 20, color: 'var(--text)', fontSize: '0.9rem' }}>
          {actionMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>Configuration</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0, fontSize: '0.88rem' }}>
          <dt style={{ color: 'var(--text-secondary)' }}>Search engines</dt>
          <dd style={{ margin: 0 }}>{list.searchEngines.join(', ')}</dd>
          <dt style={{ color: 'var(--text-secondary)' }}>Max results / query</dt>
          <dd style={{ margin: 0 }}>{list.maxResultsPerQuery}</dd>
          <dt style={{ color: 'var(--text-secondary)' }}>Max pages / domain</dt>
          <dd style={{ margin: 0 }}>{list.maxPagesPerDomain}</dd>
          <dt style={{ color: 'var(--text-secondary)' }}>Verification mode</dt>
          <dd style={{ margin: 0 }}>{list.verificationMode === 'EXTERNAL_PROVIDER' ? 'Hybrid: DNS + Reoon (50/day quota)' : 'In-house only (no Reoon)'}</dd>
          <dt style={{ color: 'var(--text-secondary)' }}>Allowed types</dt>
          <dd style={{ margin: 0 }}>{list.allowedEmailTypes.join(', ')}</dd>
          <dt style={{ color: 'var(--text-secondary)' }}>Created</dt>
          <dd style={{ margin: 0 }}>{new Date(list.createdAt).toLocaleString()}</dd>
        </dl>
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: LeadListDetail['status'] }) {
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 999, background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status],
      fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', height: 'fit-content',
    }}>
      {status}
    </span>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: highlight ? 'var(--accent-hi)' : 'var(--text)' }}>{value.toLocaleString()}</div>
    </div>
  )
}

function actionBtn(primary: boolean, disabled: boolean, danger = false): React.CSSProperties {
  return {
    padding: '9px 16px', borderRadius: 8,
    border: danger ? '1px solid #ef444477' : 'none',
    background: primary ? 'var(--accent)' : danger ? 'transparent' : 'var(--surface)',
    color: primary ? '#04151A' : danger ? '#ef4444' : 'var(--text)',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, fontSize: '0.9rem',
  }
}

function actionLink(primary: boolean): React.CSSProperties {
  return {
    padding: '9px 16px', borderRadius: 8, background: primary ? 'var(--accent)' : 'var(--surface)',
    color: primary ? '#04151A' : 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
    border: '1px solid var(--border-subtle)', display: 'inline-block',
  }
}
