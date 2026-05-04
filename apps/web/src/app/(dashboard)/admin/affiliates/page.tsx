'use client'

import { useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface AffiliateUser { id: string; email: string; firstName: string | null; lastName: string | null }
interface AffiliateAccount {
  id: string; status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'DISABLED'
  referralCode: string; createdAt: string; approvedAt: string | null
  totalEarnedCents: number; totalPaidCents: number; notes: string | null
  user: AffiliateUser
  _count: { clicks: number; conversions: number; commissions: number }
}
interface AffiliateList { items: AffiliateAccount[]; total: number }
interface Commission {
  id: string; amountMinor: number; currency: string; status: string
  approvedAt: string | null; paidAt: string | null; createdAt: string
  affiliateAccount: { id: string; referralCode: string; user: AffiliateUser }
  affiliateConversion: { conversionType: string; conversionValue: number | null; occurredAt: string }
}
interface CommissionList { items: Commission[]; total: number }
interface PayoutRequest {
  id: string; amountCents: number; status: string; requestedAt: string; processedAt: string | null; payoutRef: string | null; notes: string | null
  affiliateAccount: { id: string; referralCode: string; user: AffiliateUser }
}
interface PayoutList { items: PayoutRequest[]; total: number }
interface AffiliateSettings {
  cookieDurationDays: number; commissionRatePct: number; commissionType: string
  minPayoutCents: number; autoApproveAfterDays: number
  programName: string; programDescription: string; termsUrl: string | null
}

function cents(n: number) { return `$${(n / 100).toFixed(2)}` }
function userName(u: AffiliateUser) { return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email }

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: 'oklch(14% 0.04 75)',    text: 'oklch(70% 0.16 75)'  },
  ACTIVE:   { bg: 'oklch(19% 0.04 193)',   text: 'oklch(72% 0.12 193)' },
  PAUSED:   { bg: 'oklch(13% 0.04 25)',    text: 'oklch(68% 0.20 25)'  },
  DISABLED: { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
}
const COMM_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
  APPROVED: { bg: 'oklch(19% 0.04 193)',    text: 'oklch(72% 0.12 193)' },
  HOLD:     { bg: 'oklch(14% 0.04 75)',     text: 'oklch(70% 0.16 75)'  },
  PAID:     { bg: 'oklch(15% 0.05 145)',    text: 'oklch(65% 0.15 145)' },
  REVERSED: { bg: 'oklch(13% 0.04 25)',     text: 'oklch(68% 0.20 25)'  },
}

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<'affiliates' | 'commissions' | 'payouts' | 'settings'>('affiliates')

  // Affiliates tab state
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const { data: affiliateData, loading: affLoading, error: affError, reload: reloadAff } = useApi<AffiliateList>(
    `/api/admin/affiliates?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), ...(search && { search }) }).toString()}`,
    [statusFilter, search]
  )

  // Commissions tab state
  const [commStatus, setCommStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { data: commData, loading: commLoading, reload: reloadComm } = useApi<CommissionList>(
    `/api/admin/affiliate/commissions${commStatus ? `?status=${commStatus}` : ''}`,
    [commStatus]
  )

  // Payouts tab state
  const [payoutStatus, setPayoutStatus] = useState('')
  const { data: payoutData, loading: payoutLoading, reload: reloadPayout } = useApi<PayoutList>(
    `/api/admin/affiliate/payout-requests${payoutStatus ? `?status=${payoutStatus}` : ''}`,
    [payoutStatus]
  )

  // Settings tab state
  const { data: settings, reload: reloadSettings } = useApi<AffiliateSettings>('/api/admin/affiliate/settings')
  const [settingsForm, setSettingsForm] = useState<Partial<AffiliateSettings>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Modals
  const [working, setWorking] = useState<string | null>(null)
  const [payoutModal, setPayoutModal] = useState<{ id: string; amount: number } | null>(null)
  const [payoutRef, setPayoutRef] = useState('')
  const [payoutNotes, setPayoutNotes] = useState('')
  const [payModal, setPayModal] = useState<{ id: string } | null>(null)
  const [commPayRef, setCommPayRef] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function doAffAction(id: string, action: string) {
    setWorking(id + action)
    try {
      const res = await apiFetchRaw(`/api/admin/affiliates/${id}/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      showToast('success', `Partner ${action}d.`)
      reloadAff()
    } catch { showToast('error', `Failed to ${action} partner.`) }
    finally { setWorking(null) }
  }

  async function doCommAction(id: string, action: string, body?: Record<string, string>) {
    setWorking(id + action)
    try {
      const res = await apiFetchRaw(`/api/admin/affiliate/commissions/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
      })
      if (!res.ok) throw new Error('Failed')
      showToast('success', `Commission ${action}ed.`)
      reloadComm()
    } catch { showToast('error', `Failed to ${action} commission.`) }
    finally { setWorking(null) }
  }

  async function bulkApprove() {
    if (!selectedIds.size) return
    setWorking('bulk')
    try {
      const res = await apiFetchRaw('/api/admin/affiliate/commissions/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed')
      showToast('success', `${selectedIds.size} commissions approved.`)
      setSelectedIds(new Set())
      reloadComm()
    } catch { showToast('error', 'Bulk approve failed.') }
    finally { setWorking(null) }
  }

  async function processPayoutRequest() {
    if (!payoutModal) return
    setWorking('payout')
    try {
      const res = await apiFetchRaw(`/api/admin/affiliate/payout-requests/${payoutModal.id}/process`, {
        method: 'POST',
        body: JSON.stringify({ payoutRef, notes: payoutNotes }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed')
      showToast('success', 'Payout processed.')
      setPayoutModal(null); setPayoutRef(''); setPayoutNotes('')
      reloadPayout()
    } catch { showToast('error', 'Failed to process payout.') }
    finally { setWorking(null) }
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const res = await apiFetchRaw('/api/admin/affiliate/settings', {
        method: 'PATCH',
        body: JSON.stringify(settingsForm),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed')
      showToast('success', 'Settings saved.')
      setSettingsForm({})
      reloadSettings()
    } catch { showToast('error', 'Failed to save settings.') }
    finally { setSavingSettings(false) }
  }

  const TAB_STYLE = (active: boolean) => ({
    padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: active ? 600 : 400,
    cursor: 'pointer', background: active ? 'var(--nav-active-bg, oklch(19% 0.04 193 / 0.15))' : 'transparent',
    color: active ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)', border: 'none', transition: 'all 0.15s',
  })

  const FILTER_BTN = (active: boolean) => ({
    padding: '4px 12px', fontSize: '11px', borderRadius: '6px',
    background: active ? 'oklch(19% 0.04 193)' : 'var(--surface-overlay)',
    color: active ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)', cursor: 'pointer',
  })

  const settingsCurrent = { ...settings, ...settingsForm }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Partners</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage the partner program, commissions, and payouts</p>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-overlay)', width: 'fit-content' }}>
        {(['affiliates', 'commissions', 'payouts', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── AFFILIATES ── */}
      {tab === 'affiliates' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input className="input-field text-sm flex-1 max-w-xs" placeholder="Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-1.5">
              {['', 'PENDING', 'ACTIVE', 'PAUSED', 'DISABLED'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={FILTER_BTN(statusFilter === s)}>{s || 'All'}</button>
              ))}
            </div>
          </div>

          {affLoading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
          {affError   && <div className="alert-error">{affError}</div>}

          {!affLoading && affiliateData && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{affiliateData.total} partners</p>
          )}

          {affiliateData && affiliateData.items.length === 0 && (
            <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No partners{statusFilter ? ` with status ${statusFilter}` : ''} yet.</p>
            </div>
          )}

          {affiliateData && affiliateData.items.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Partner', 'Code', 'Status', 'Clicks', 'Conv.', 'Earned', 'Paid', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affiliateData.items.map((a, i) => {
                    const s = STATUS_STYLE[a.status]!
                    return (
                      <tr key={a.id} style={{ borderBottom: i < affiliateData.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{userName(a.user)}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.user.email}</p>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{a.referralCode}</td>
                        <td className="px-3 py-3"><span className="badge" style={{ background: s.bg, color: s.text }}>{a.status}</span></td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{a._count.clicks}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{a._count.conversions}</td>
                        <td className="px-3 py-3 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{cents(a.totalEarnedCents)}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{cents(a.totalPaidCents)}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {a.status === 'PENDING'  && <button onClick={() => doAffAction(a.id, 'approve')}    disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>Approve</button>}
                            {a.status === 'ACTIVE'   && <button onClick={() => doAffAction(a.id, 'pause')}      disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>Pause</button>}
                            {a.status === 'PAUSED'   && <button onClick={() => doAffAction(a.id, 'reactivate')} disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>Reactivate</button>}
                            {a.status !== 'DISABLED' && <button onClick={() => doAffAction(a.id, 'disable')}    disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }}>Disable</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── COMMISSIONS ── */}
      {tab === 'commissions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {['', 'PENDING', 'APPROVED', 'HOLD', 'PAID', 'REVERSED'].map(s => (
                <button key={s} onClick={() => setCommStatus(s)} style={FILTER_BTN(commStatus === s)}>{s || 'All'}</button>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <button onClick={bulkApprove} disabled={working === 'bulk'}
                className="text-xs px-3 py-1.5 rounded-lg ml-auto"
                style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
                Approve {selectedIds.size} selected
              </button>
            )}
          </div>

          {commLoading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}

          {commData && commData.items.length === 0 && (
            <div className="py-12 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No commissions{commStatus ? ` with status ${commStatus}` : ''}.</p>
            </div>
          )}

          {commData && commData.items.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox"
                        checked={selectedIds.size === commData.items.filter(c => c.status === 'PENDING').length && commData.items.some(c => c.status === 'PENDING')}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(commData.items.filter(c => c.status === 'PENDING').map(c => c.id)))
                          else setSelectedIds(new Set())
                        }} />
                    </th>
                    {['Partner', 'Type', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commData.items.map((c, i) => {
                    const s = COMM_STYLE[c.status] ?? COMM_STYLE.PENDING!
                    const isPending = c.status === 'PENDING'
                    return (
                      <tr key={c.id} style={{ borderBottom: i < commData.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                        <td className="px-3 py-3">
                          {isPending && (
                            <input type="checkbox" checked={selectedIds.has(c.id)}
                              onChange={e => {
                                const s2 = new Set(selectedIds)
                                e.target.checked ? s2.add(c.id) : s2.delete(c.id)
                                setSelectedIds(s2)
                              }} />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{userName(c.affiliateAccount.user)}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.affiliateAccount.referralCode}</p>
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.affiliateConversion.conversionType}</td>
                        <td className="px-3 py-3 font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{cents(c.amountMinor)}</td>
                        <td className="px-3 py-3"><span className="badge" style={{ background: s.bg, color: s.text }}>{c.status}</span></td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5">
                            {c.status === 'PENDING'  && <button onClick={() => doCommAction(c.id, 'approve')} disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>Approve</button>}
                            {c.status === 'PENDING'  && <button onClick={() => doCommAction(c.id, 'hold')}    disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(14% 0.04 75)', color: 'oklch(70% 0.16 75)' }}>Hold</button>}
                            {c.status === 'APPROVED' && <button onClick={() => { setPayModal({ id: c.id }); setCommPayRef('') }} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(15% 0.05 145)', color: 'oklch(65% 0.15 145)' }}>Mark paid</button>}
                            {(c.status === 'PENDING' || c.status === 'APPROVED') && <button onClick={() => doCommAction(c.id, 'reverse')} disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }}>Reverse</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUTS ── */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {['', 'PENDING', 'PROCESSED'].map(s => (
              <button key={s} onClick={() => setPayoutStatus(s)} style={FILTER_BTN(payoutStatus === s)}>{s || 'All'}</button>
            ))}
          </div>

          {payoutLoading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}

          {payoutData && payoutData.items.length === 0 && (
            <div className="py-12 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payout requests{payoutStatus ? ` with status ${payoutStatus}` : ''}.</p>
            </div>
          )}

          {payoutData && payoutData.items.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Affiliate', 'Amount', 'Status', 'Requested', 'Processed', 'Ref', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payoutData.items.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < payoutData.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                      <td className="px-3 py-3">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{userName(r.affiliateAccount.user)}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{r.affiliateAccount.referralCode}</p>
                      </td>
                      <td className="px-3 py-3 font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{cents(r.amountCents)}</td>
                      <td className="px-3 py-3">
                        <span className="badge" style={{
                          background: r.status === 'PROCESSED' ? 'oklch(15% 0.05 145)' : 'oklch(14% 0.04 75)',
                          color:      r.status === 'PROCESSED' ? 'oklch(65% 0.15 145)' : 'oklch(70% 0.16 75)',
                        }}>{r.status}</span>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.payoutRef ?? '—'}</td>
                      <td className="px-3 py-3">
                        {r.status === 'PENDING' && (
                          <button onClick={() => { setPayoutModal({ id: r.id, amount: r.amountCents }); setPayoutRef(''); setPayoutNotes('') }}
                            className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(15% 0.05 145)', color: 'oklch(65% 0.15 145)' }}>
                            Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === 'settings' && settings && (
        <div className="space-y-5 max-w-lg">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-5 py-4" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Program configuration</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Changes apply to new signups and tracking. Existing cookies retain their original duration.</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'programName',        label: 'Program name',              type: 'text',   placeholder: 'Affiliate Program' },
                { key: 'programDescription', label: 'Program description',       type: 'text',   placeholder: 'Earn commission…' },
                { key: 'commissionRatePct',  label: 'Commission rate (%)',        type: 'number', placeholder: '20' },
                { key: 'cookieDurationDays', label: 'Cookie duration (days)',     type: 'number', placeholder: '30' },
                { key: 'minPayoutCents',     label: 'Minimum payout (cents)',     type: 'number', placeholder: '5000' },
                { key: 'autoApproveAfterDays', label: 'Auto-approve after (days)', type: 'number', placeholder: '30' },
                { key: 'termsUrl',           label: 'Terms URL (optional)',       type: 'text',   placeholder: 'https://…' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input
                    className="input-field text-sm w-full"
                    type={type}
                    placeholder={placeholder}
                    value={String((settingsForm as Record<string, unknown>)[key] ?? (settingsCurrent as Record<string, unknown>)[key] ?? '')}
                    onChange={e => setSettingsForm(f => ({
                      ...f,
                      [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                    }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Commission type</label>
                <select className="input-field text-sm w-full"
                  value={String((settingsForm as Record<string, unknown>)['commissionType'] ?? settingsCurrent.commissionType ?? 'PERCENTAGE')}
                  onChange={e => setSettingsForm(f => ({ ...f, commissionType: e.target.value }))}>
                  <option value="PERCENTAGE">Percentage of sale</option>
                  <option value="FLAT">Flat amount (uses minimum payout as flat rate)</option>
                </select>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={saveSettings} disabled={savingSettings || !Object.keys(settingsForm).length}
                className="btn-primary text-sm">
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process payout modal */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 space-y-4 w-full max-w-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Process payout — {cents(payoutModal.amount)}</h3>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payout reference</label>
              <input className="input-field text-sm w-full" placeholder="Transaction ID, check #, etc."
                value={payoutRef} onChange={e => setPayoutRef(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
              <input className="input-field text-sm w-full" placeholder="Any notes for your records"
                value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={processPayoutRequest} disabled={!payoutRef || working === 'payout'} className="btn-primary flex-1 text-sm">
                {working === 'payout' ? 'Processing…' : 'Confirm payout'}
              </button>
              <button onClick={() => setPayoutModal(null)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark commission paid modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 space-y-4 w-full max-w-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mark commission as paid</h3>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payout reference</label>
              <input className="input-field text-sm w-full" placeholder="Transaction ID, batch ref, etc."
                value={commPayRef} onChange={e => setCommPayRef(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { doCommAction(payModal.id, 'pay', { payoutRef: commPayRef }); setPayModal(null) }}
                disabled={!commPayRef} className="btn-primary flex-1 text-sm">Confirm</button>
              <button onClick={() => setPayModal(null)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
