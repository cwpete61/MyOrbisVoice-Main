'use client'

/**
 * Webinar Marketing — manual review queue. Shows QUARANTINED rows with
 * verification details + source context. Operator approves with consent
 * status + lawful-basis notes, or rejects with optional reason.
 */

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'

interface QueueRow {
  id: string
  email: string
  normalizedEmail: string
  domain: string
  emailType: string | null
  sourceUrl: string
  sourcePageTitle: string | null
  rawContextSnippet: string | null
  reviewerNotes: string | null
  createdAt: string
  verifications: Array<{
    providerStatus: string
    providerReason: string | null
    provider: string
    mxValid: boolean
    disposable: boolean
    verifiedAt: string
  }>
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  BUSINESS_DOMAIN: '#10b981',
  ROLE_BASED_BUSINESS: '#0ea5e9',
  PERSONAL_FREE_MAIL: '#f59e0b',
  NO_REPLY_OR_SUPPRESSED: '#6b7280',
  DISPOSABLE_DOMAIN: '#ef4444',
  INVALID_FORMAT: '#ef4444',
  MANUAL_REVIEW_REQUIRED: '#8b5cf6',
}

export default function ReviewQueuePage() {
  const params = useParams<{ id: string }>()
  const listId = params.id
  const { data: rows, loading, error, reload } = useApi<QueueRow[]>(
    `/api/partner/webinar-marketing/lists/${listId}/queue`,
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link
        href={`/partner-portal/webinar-marketing/${listId}`}
        style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}
      >
        ← Back to list
      </Link>
      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Manual review queue</h1>
      <p style={{ marginTop: 0, marginBottom: 24, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Approve with consent status + lawful-basis notes, or reject. Approved rows
        move to the invite database.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: '#ef4444' }}>Error: {String(error)}</p>}
      {rows && rows.length === 0 && (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Queue is empty. New quarantined emails appear here after verification.
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {rows?.map((row) => (
          <QueueCard key={row.id} row={row} onChanged={reload} />
        ))}
      </div>
    </div>
  )
}

function QueueCard({ row, onChanged }: { row: QueueRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [consent, setConsent] = useState<'OPTED_IN' | 'EXISTING_CUSTOMER' | 'MANUAL_LAWFUL_BASIS_REVIEWED'>('MANUAL_LAWFUL_BASIS_REVIEWED')
  const [notes, setNotes] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const verification = row.verifications[0]

  async function approve() {
    setBusy(true)
    setErrMsg(null)
    try {
      await apiFetch(`/api/partner/webinar-marketing/queue/${row.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          consentStatus: consent,
          lawfulBasisNotes: notes.trim() || undefined,
          businessName: businessName.trim() || undefined,
        }),
      })
      onChanged()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    setErrMsg(null)
    try {
      await apiFetch(`/api/partner/webinar-marketing/queue/${row.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      })
      onChanged()
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  const typeColor = row.emailType ? (TYPE_BADGE_COLORS[row.emailType] ?? '#6b7280') : '#6b7280'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1rem', wordBreak: 'break-all' }}>{row.email}</strong>
            {row.emailType && (
              <span style={{ padding: '2px 8px', borderRadius: 999, background: `${typeColor}22`, color: typeColor, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {row.emailType.replaceAll('_', ' ')}
              </span>
            )}
            {verification && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {verification.provider}: <strong style={{ color: 'var(--text)' }}>{verification.providerStatus}</strong>
                {verification.disposable && ' · disposable'}
                {verification.mxValid && ' · MX ✓'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Source:{' '}
            <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-hi)' }}>
              {row.sourceUrl}
            </a>
          </div>
          {row.rawContextSnippet && (
            <blockquote style={{ marginTop: 8, marginBottom: 0, padding: '8px 12px', background: 'var(--background)', borderLeft: '3px solid var(--border-strong)', fontSize: '0.82rem', color: 'var(--text-secondary)', borderRadius: 4 }}>
              …{row.rawContextSnippet}…
            </blockquote>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}
        >
          {open ? 'Cancel' : 'Decide'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', color: 'var(--text)' }}>
            Business name (optional)
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={200} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', color: 'var(--text)' }}>
            Consent status
            <select value={consent} onChange={(e) => setConsent(e.target.value as never)} style={inputStyle}>
              <option value="OPTED_IN">Opted in (form, signup, asked to receive)</option>
              <option value="EXISTING_CUSTOMER">Existing business relationship</option>
              <option value="MANUAL_LAWFUL_BASIS_REVIEWED">Manual review — lawful basis documented below</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', color: 'var(--text)' }}>
            Lawful-basis notes {consent === 'MANUAL_LAWFUL_BASIS_REVIEWED' && <span style={{ color: '#ef4444' }}>· required</span>}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Why is contacting this address lawful? (GDPR Art. 6, CAN-SPAM, prior business relationship, public business listing, …)"
              style={{ ...inputStyle, fontFamily: 'inherit' }}
            />
          </label>
          {errMsg && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{errMsg}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={approve}
              disabled={busy || (consent === 'MANUAL_LAWFUL_BASIS_REVIEWED' && notes.trim().length === 0)}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#04151A', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', opacity: busy ? 0.5 : 1 }}
            >
              {busy ? '…' : 'Approve & promote'}
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={busy}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #ef444477', background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--background)',
  color: 'var(--text)',
  fontSize: '0.88rem',
}
