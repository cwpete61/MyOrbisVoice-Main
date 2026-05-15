'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

// Admin queue for partner phone-number purchase requests (Phase G.1.B-1).
// Each row is a PhoneNumber.purchaseStatus = PENDING. Admin reviews + clicks
// Approve to actually buy the number on Twilio + attach to the partner's
// subaccount. Reject kills the request with a reason the partner sees.
//
// Billing in this phase is manual — admin invoices the partner outside the
// platform until G.1.B-2 ships the Stripe Subscription wiring.

type Tier = 'VOICE' | 'VOICE_SMS' | 'TOLLFREE'
type Status = 'PENDING' | 'APPROVED' | 'PURCHASED' | 'REJECTED' | 'RELEASED'

type Request = {
  id:                string
  phoneNumber:       string
  label:             string | null
  tier:              Tier | null
  monthlyPriceCents: number | null
  purchaseStatus:    Status
  a2pStatus:         string
  requestedAt:       string | null
  approvedAt:        string | null
  rejectionReason:   string | null
  partner: { id: string; slug: string | null; displayName: string | null; email: string; name: string } | null
}

const TIER_LABEL: Record<Tier, string> = { VOICE: 'Voice', VOICE_SMS: 'Voice + SMS', TOLLFREE: 'Toll-free' }

export default function AdminNumberRequestsPage() {
  const [status, setStatus] = useState<Status>('PENDING')
  const [items, setItems] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectFor, setRejectFor] = useState<Request | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [disableFor, setDisableFor] = useState<Request | null>(null)
  const [disableReason, setDisableReason] = useState('')

  async function reload(s: Status = status) {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ items: Request[]; total: number }>(`/api/admin/phone-number-requests?status=${s}`)
      setItems(data?.items ?? [])
    } catch (e) {
      setError((e as Error).message ?? 'Load failed')
    } finally { setLoading(false) }
  }

  useEffect(() => { void reload(status) }, [status])

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  async function approve(id: string) {
    setActingId(id)
    try {
      await apiFetch(`/api/admin/phone-number-requests/${id}/approve`, { method: 'POST' })
      showToast('success', 'Number purchased and assigned to partner.')
      void reload()
    } catch (e) {
      showToast('error', (e as Error).message ?? 'Approval failed')
    } finally { setActingId(null) }
  }

  async function submitReject() {
    if (!rejectFor) return
    setActingId(rejectFor.id)
    try {
      await apiFetch(`/api/admin/phone-number-requests/${rejectFor.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      })
      showToast('success', 'Request rejected.')
      setRejectFor(null)
      setRejectReason('')
      void reload()
    } catch (e) {
      showToast('error', (e as Error).message ?? 'Reject failed')
    } finally { setActingId(null) }
  }

  async function submitDisable() {
    if (!disableFor) return
    setActingId(disableFor.id)
    try {
      await apiFetch(`/api/admin/phone-number-requests/${disableFor.id}/disable`, {
        method: 'POST',
        body: JSON.stringify({ reason: disableReason.trim() || undefined }),
      })
      showToast('success', 'Number disabled. Stripe subscription canceled; release on period end.')
      setDisableFor(null)
      setDisableReason('')
      void reload()
    } catch (e) {
      showToast('error', (e as Error).message ?? 'Disable failed')
    } finally { setActingId(null) }
  }

  function dollars(cents: number | null): string {
    if (cents == null) return '—'
    return `$${(cents / 100).toFixed(2)}/mo`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Phone Number Requests</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Partners auto-purchase numbers on request — Twilio buy + Stripe charge runs inline. Approval here is only for legacy PENDING rows whose first auto-attempt failed. Use Disable on PURCHASED rows to cancel a partner's subscription + release the number.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* Status tabs */}
      <div className="flex gap-2">
        {(['PENDING', 'PURCHASED', 'REJECTED', 'APPROVED', 'RELEASED'] as Status[]).map(s => (
          <button
            key={s}
            data-testid={`status-tab-${s}`}
            onClick={() => setStatus(s)}
            className="text-xs font-medium px-3 py-1.5 rounded-md"
            style={{
              background: status === s ? 'oklch(55% 0.11 193)' : 'var(--surface-overlay)',
              color: status === s ? '#0a0e18' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm pt-4" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No requests in this state.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Partner', 'Number', 'Tier', 'Price', 'Requested', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--surface-raised)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {r.partner ? (
                      <>
                        <div className="font-medium">{r.partner.displayName ?? r.partner.name ?? r.partner.email}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{r.partner.email}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{r.phoneNumber}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.tier ? TIER_LABEL[r.tier] : '—'}</td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{dollars(r.monthlyPriceCents)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {r.requestedAt ? new Date(r.requestedAt).toLocaleDateString() : '—'}
                    {r.rejectionReason && status === 'REJECTED' && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'oklch(50% 0.18 25)' }}>{r.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(r.id)}
                          disabled={actingId !== null}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md"
                          style={{ background: 'oklch(55% 0.18 155)', color: '#fff', opacity: actingId === r.id ? 0.6 : 1 }}
                        >
                          {actingId === r.id ? 'Working…' : 'Retry purchase'}
                        </button>
                        <button
                          onClick={() => { setRejectFor(r); setRejectReason('') }}
                          disabled={actingId !== null}
                          className="text-xs font-medium px-3 py-1.5 rounded-md"
                          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : status === 'PURCHASED' ? (
                      <button
                        onClick={() => { setDisableFor(r); setDisableReason('') }}
                        disabled={actingId !== null}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md"
                        style={{ background: 'oklch(55% 0.20 25)', color: '#fff', opacity: actingId === r.id ? 0.6 : 1 }}
                      >
                        {actingId === r.id ? 'Disabling…' : 'Disable'}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disable modal */}
      {disableFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDisableFor(null)}>
          <div onClick={e => e.stopPropagation()} className="rounded-xl w-full max-w-md" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Disable partner number</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {disableFor.phoneNumber} for {disableFor.partner?.email}. This cancels the Stripe subscription and releases the number on the period end. The partner is not charged again.
              </p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Reason (for audit log)</label>
              <textarea
                value={disableReason}
                onChange={e => setDisableReason(e.target.value)}
                rows={3}
                placeholder="e.g. Policy violation: reported spam complaints."
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}>
              <button onClick={() => setDisableFor(null)} className="text-xs px-4 py-2 rounded-md" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={submitDisable} disabled={actingId !== null} className="text-xs font-semibold px-4 py-2 rounded-md" style={{ background: 'oklch(55% 0.20 25)', color: '#fff', opacity: actingId === disableFor.id ? 0.6 : 1 }}>
                {actingId === disableFor.id ? 'Disabling…' : 'Disable number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setRejectFor(null)}>
          <div onClick={e => e.stopPropagation()} className="rounded-xl w-full max-w-md" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Reject request</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{rejectFor.phoneNumber} for {rejectFor.partner?.email}</p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Reason (shown to partner)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Not approved for toll-free in your region."
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}>
              <button onClick={() => setRejectFor(null)} className="text-xs px-4 py-2 rounded-md" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={submitReject} disabled={actingId !== null} className="text-xs font-semibold px-4 py-2 rounded-md" style={{ background: 'oklch(55% 0.20 25)', color: '#fff', opacity: actingId === rejectFor.id ? 0.6 : 1 }}>
                {actingId === rejectFor.id ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
