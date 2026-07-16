'use client'

/**
 * Admin Webinar Marketing — list index. Admin-only lead-discovery tool (was
 * formerly partner-scoped). Shows the platform operator account's lead lists
 * with status + counts, plus an inline "New list" form.
 */

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { WEBINAR_THEME_VARS } from '@/components/webinar-marketing/theme'

interface LeadListRow {
  id: string
  name: string
  niche: string
  location: string
  status: 'DRAFT' | 'DISCOVERING' | 'EXTRACTING' | 'VERIFYING' | 'READY' | 'ARCHIVED'
  searchEngines: string[]
  maxResultsPerQuery: number
  maxPagesPerDomain: number
  verificationMode: 'SYNTAX_DNS_ONLY' | 'EXTERNAL_PROVIDER'
  allowedEmailTypes: string[]
  createdAt: string
  _count?: { extractedEmails: number; inviteContacts: number }
}

const STATUS_COLORS: Record<LeadListRow['status'], string> = {
  DRAFT: '#6b7280',
  DISCOVERING: '#0ea5e9',
  EXTRACTING: '#8b5cf6',
  VERIFYING: '#f59e0b',
  READY: '#10b981',
  ARCHIVED: '#374151',
}

export default function AdminWebinarMarketingIndexPage() {
  const { data: lists, loading, error, reload } = useApi<LeadListRow[]>(
    '/api/admin/webinar-marketing/lists',
  )
  const [showForm, setShowForm] = useState(false)

  return (
    <div style={{ ...WEBINAR_THEME_VARS, maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Webinar Marketing</h1>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 720, lineHeight: 1.55 }}>
            Discover qualified business contacts by niche + location. Free-mail
            addresses are quarantined for manual review — never auto-added.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: showForm ? 'var(--surface)' : 'var(--accent)',
            color: showForm ? 'var(--text)' : '#04151A',
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {showForm ? 'Cancel' : '+ New list'}
        </button>
      </header>

      {showForm && <NewListForm onCreated={() => { setShowForm(false); reload() }} />}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: '#ef4444' }}>Error: {String(error)}</p>}

      {lists && lists.length === 0 && !showForm && (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-secondary)', marginTop: 16 }}>
          <p style={{ margin: 0 }}>No lists yet. Click <strong>+ New list</strong> to start.</p>
        </div>
      )}

      {lists && lists.length > 0 && (
        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/admin/webinar-marketing/${l.id}`}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12,
                padding: '18px 20px', textDecoration: 'none', color: 'inherit', display: 'grid',
                gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{l.name}</span>
                  <StatusPill status={l.status} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <span>{l.niche}</span> · <span>{l.location}</span>
                  {l._count && (
                    <>
                      {' '}· <span>{l._count.extractedEmails} extracted</span>
                      {' '}· <span style={{ color: 'var(--accent-hi)' }}>{l._count.inviteContacts} in invite list</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'right' }}>
                {new Date(l.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )

  function StatusPill({ status }: { status: LeadListRow['status'] }) {
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
        background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status],
        fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {status}
      </span>
    )
  }
}

// ─── New list form (inline) ──────────────────────────────────────────────────

const SEARCH_ENGINES = [
  { slug: 'duckduckgo', label: 'DuckDuckGo', badge: '' },
  { slug: 'bing_web_search', label: 'Bing API', badge: 'paid' },
  { slug: 'google_scrape', label: 'Google (advanced)', badge: '⚠ ToS risk' },
]

function NewListForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [engines, setEngines] = useState<string[]>(['duckduckgo'])
  const [maxResults, setMaxResults] = useState(100)
  const [maxPages, setMaxPages] = useState(5)
  const [verificationMode, setVerificationMode] = useState<'SYNTAX_DNS_ONLY' | 'EXTERNAL_PROVIDER'>('EXTERNAL_PROVIDER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleEngine(slug: string) {
    setEngines((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/admin/webinar-marketing/lists', {
        method: 'POST',
        body: JSON.stringify({
          name, niche, location,
          optionalEmailDomainFilter: domainFilter.trim() || null,
          searchEngines: engines,
          maxResultsPerQuery: maxResults,
          maxPagesPerDomain: maxPages,
          verificationMode,
          allowedEmailTypes: ['business_domain_only', 'role_based_business'],
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16, display: 'grid', gap: 14 }}>
      <Row label="Name" hint="e.g. Dentists — Atlanta — Webinar Invite May 2026">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} style={inputStyle} />
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Row label="Niche" hint="dentist · chiropractor · hvac contractor">
          <input value={niche} onChange={(e) => setNiche(e.target.value)} required maxLength={120} style={inputStyle} />
        </Row>
        <Row label="Location" hint="atlanta · charlotte · tampa">
          <input value={location} onChange={(e) => setLocation(e.target.value)} required maxLength={120} style={inputStyle} />
        </Row>
      </div>
      <Row label="Optional email domain filter" hint="Free-mail-targeted scrape (results go to quarantine). Example: @gmail.com">
        <input value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} maxLength={253} placeholder="(leave empty for business-domain mode)" style={inputStyle} />
      </Row>
      <Row label="Search engines" hint="DuckDuckGo by default. Google is ToS-restricted — use sparingly.">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {SEARCH_ENGINES.map((eng) => (
            <label key={eng.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="checkbox" checked={engines.includes(eng.slug)} onChange={() => toggleEngine(eng.slug)} />
              {eng.label} {eng.badge && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>· {eng.badge}</span>}
            </label>
          ))}
        </div>
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Row label="Max results / query" hint="">
          <input type="number" min={1} max={500} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} style={inputStyle} />
        </Row>
        <Row label="Max pages / domain" hint="">
          <input type="number" min={1} max={50} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} style={inputStyle} />
        </Row>
        <Row label="Verification mode" hint="Hybrid runs free DNS+MX first, then Reoon only on survivors — saves ~30-50% Reoon quota.">
          <select value={verificationMode} onChange={(e) => setVerificationMode(e.target.value as never)} style={inputStyle}>
            <option value="EXTERNAL_PROVIDER">Hybrid: DNS + Reoon (recommended)</option>
            <option value="SYNTAX_DNS_ONLY">In-house only (no Reoon)</option>
          </select>
        </Row>
      </div>
      {error && <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>}
      <button type="submit" disabled={submitting || engines.length === 0} style={{
        padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#04151A',
        fontWeight: 600, cursor: 'pointer', opacity: submitting || engines.length === 0 ? 0.5 : 1, justifySelf: 'start',
      }}>
        {submitting ? 'Creating…' : 'Create list'}
      </button>
    </form>
  )
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8, fontSize: '0.78rem' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)',
  background: 'var(--background)', color: 'var(--text)', fontSize: '0.9rem',
}
