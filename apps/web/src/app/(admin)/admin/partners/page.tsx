'use client'

import { useState, useEffect, Fragment } from 'react'
import { apiFetch, apiFetchRaw, useApi } from '@/hooks/useApi'

interface AffiliateUser { id: string; email: string; firstName: string | null; lastName: string | null }
interface AffiliateAccount {
  id: string; status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'DISABLED'
  referralCode: string; createdAt: string; approvedAt: string | null
  totalEarnedCents: number; totalPaidCents: number; notes: string | null
  leadSearchCredits: number
  // Phase F.4 — bulk-email policy fields (admin-controlled, partner read-only)
  emailBulkEnabled: boolean
  emailBulkSuspendedAt: string | null
  emailBulkSuspendedReason: string | null
  emailDailyCap: number | null
  emailSendWindowStartHour: number | null
  emailSendWindowEndHour: number | null
  emailDripIntervalSecs: number | null
  user: AffiliateUser
  _count: { clicks: number; conversions: number; commissions: number }
}
interface PlatformEmailPolicy {
  dailyCap: number
  sendWindowStartHour: number
  sendWindowEndHour: number
  dripIntervalSecs: number
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
interface CommissionTier {
  id: string; level: number; name: string; recurringPct: number
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
  // F.4 — per-partner email policy editor (inline expansion under each row)
  const [emailPolicyOpen, setEmailPolicyOpen] = useState<string | null>(null)
  // Edit-partner modal — null = closed, AffiliateAccount = open editing that row.
  const [editModal, setEditModal] = useState<AffiliateAccount | null>(null)
  const { data: emailDefaults } = useApi<PlatformEmailPolicy>('/api/admin/email-policy', [])

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

  // Commission tiers (admin-editable; new partners lock to Tier 1 at signup)
  const { data: tiersData, reload: reloadTiers } = useApi<CommissionTier[]>('/api/admin/commission-tiers')
  const [tierEdits, setTierEdits] = useState<Record<string, { name?: string; recurringPct?: number }>>({})
  const [savingTierId, setSavingTierId] = useState<string | null>(null)
  async function saveTier(id: string) {
    const patch = tierEdits[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingTierId(id)
    try {
      const res = await apiFetchRaw(`/api/admin/commission-tiers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('save failed')
      showToast('success', 'Tier updated. Applies to new signups only — existing partners keep their locked rate.')
      setTierEdits(e => { const n = { ...e }; delete n[id]; return n })
      reloadTiers()
    } catch {
      showToast('error', 'Failed to update tier.')
    } finally {
      setSavingTierId(null)
    }
  }

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
      // 'regenerate-code' has its own success message because "regenerate-coded" reads weird.
      const msg = action === 'regenerate-code' ? 'Referral code rotated.' : `Partner ${action}d.`
      showToast('success', msg)
      reloadAff()
    } catch {
      const msg = action === 'regenerate-code' ? 'Failed to rotate referral code.' : `Failed to ${action} partner.`
      showToast('error', msg)
    }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Partners</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage the partner program, commissions, and payouts</p>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* ── Platform-wide KPI dashboard + trend chart + top performers ── */}
      <PlatformDashboard />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-overlay)', width: 'fit-content' }}>
        {(['affiliates', 'commissions', 'payouts', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
            {t === 'affiliates' ? 'Partners' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── AFFILIATES ── */}
      {tab === 'affiliates' && (
        <div className="space-y-4">
          {/* F.4 — bulk email toggle for ALL active partners at once.
              Disabling auto-pauses any RUNNING campaigns on next worker
              tick. Suspension state is independent (not touched). */}
          <BulkEmailToggle reload={reloadAff} showToast={showToast} />

          <LeadCreditsCard showToast={showToast} />

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
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Partner', 'Code', 'Status', 'Clicks', 'Conv.', 'Earned', 'Paid', 'Joined', 'Lead credits', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affiliateData.items.map((a, i) => {
                    const s = STATUS_STYLE[a.status]!
                    const isPolicyOpen = emailPolicyOpen === a.id
                    return (
                      <Fragment key={a.id}>
                      <tr style={{ borderBottom: !isPolicyOpen && i < affiliateData.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
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
                          <PartnerCreditsCell
                            partner={a}
                            onSaved={() => { reloadAff(); showToast('success', `Lead credits updated for ${userName(a.user)}.`) }}
                            onError={(m) => showToast('error', m)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {a.status === 'PENDING'  && <button onClick={() => doAffAction(a.id, 'approve')}    disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>Approve</button>}
                            {a.status === 'ACTIVE'   && <button onClick={() => doAffAction(a.id, 'pause')}      disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>Pause</button>}
                            {a.status === 'PAUSED'   && <button onClick={() => doAffAction(a.id, 'reactivate')} disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>Reactivate</button>}
                            {a.status !== 'DISABLED' && <button onClick={() => doAffAction(a.id, 'disable')}    disabled={!!working} className="text-xs px-2 py-1 rounded" style={{ background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }}>Disable</button>}
                            <button
                              onClick={() => setEditModal(a)}
                              disabled={!!working}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                              title="Edit partner record (name, email, notes, aggression tier)"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (!confirm(`Regenerate referral code for ${userName(a.user)}?\n\nThe old code will stop working immediately. Existing tracked clicks/conversions on the old code stay attributed.`)) return
                                doAffAction(a.id, 'regenerate-code')
                              }}
                              disabled={!!working}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                              title="Rotate the referral code (old links stop working)"
                            >
                              Rotate code
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Permanently delete ${userName(a.user)}?\n\nThis cascades to ALL their clicks, conversions, commissions, and payout requests. Cannot be undone.`)) return
                                setWorking(a.id + 'delete')
                                try {
                                  const res = await apiFetchRaw(`/api/admin/affiliates/${a.id}`, { method: 'DELETE' })
                                  if (!res.ok) throw new Error('Failed')
                                  showToast('success', `Partner ${userName(a.user)} deleted.`)
                                  reloadAff()
                                } catch { showToast('error', `Failed to delete ${userName(a.user)}.`) }
                                finally { setWorking(null) }
                              }}
                              disabled={!!working}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }}
                              title="Permanently delete this partner and all their data"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setEmailPolicyOpen(isPolicyOpen ? null : a.id)}
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                background: a.emailBulkSuspendedAt
                                  ? 'oklch(13% 0.04 25)'
                                  : a.emailBulkEnabled
                                    ? 'oklch(19% 0.04 193)'
                                    : 'var(--surface-overlay)',
                                color: a.emailBulkSuspendedAt
                                  ? 'oklch(68% 0.20 25)'
                                  : a.emailBulkEnabled
                                    ? 'oklch(72% 0.12 193)'
                                    : 'var(--text-secondary)',
                                border: a.emailBulkEnabled || a.emailBulkSuspendedAt ? undefined : '1px solid var(--border-subtle)',
                              }}
                              title={a.emailBulkSuspendedAt
                                ? `Bulk SUSPENDED: ${a.emailBulkSuspendedReason ?? ''}`
                                : a.emailBulkEnabled
                                  ? 'Bulk email is enabled — click to edit policy'
                                  : 'Bulk email is disabled — click to enable + configure'}
                            >
                              Email {a.emailBulkSuspendedAt ? '(suspended)' : a.emailBulkEnabled ? '✓' : '·'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isPolicyOpen && emailDefaults && (
                        <tr style={{ background: 'var(--surface-overlay)', borderBottom: i < affiliateData.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                          <td colSpan={10} className="px-4 py-4">
                            <PartnerEmailPolicyEditor
                              partner={a}
                              defaults={emailDefaults}
                              onSaved={() => { reloadAff(); setEmailPolicyOpen(null); showToast('success', `Email policy saved for ${userName(a.user)}.`) }}
                              onError={(m) => showToast('error', m)}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
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
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
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
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
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

          {/* ── Commission tiers ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-5 py-4" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Commission tiers</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Recurring % a partner earns on every payment, for the life of the referred customer.
                New partners lock to <strong>Tier 1</strong> at signup. Editing a tier here applies to
                <strong> future signups only</strong> — partners already locked keep their rate unless you edit them individually.
              </p>
            </div>
            <div className="p-5 space-y-3">
              {(tiersData ?? []).map(t => {
                const edit = tierEdits[t.id] ?? {}
                const nameVal = edit.name ?? t.name
                const pctVal = edit.recurringPct ?? t.recurringPct
                const dirty = Object.keys(edit).length > 0
                return (
                  <div key={t.id} className="flex items-end gap-3 rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      Tier {t.level}
                    </span>
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Name</label>
                      <input className="input-field text-sm w-full" type="text" value={nameVal}
                        onChange={e => setTierEdits(s => ({ ...s, [t.id]: { ...s[t.id], name: e.target.value } }))} />
                    </div>
                    <div style={{ width: 120 }}>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Recurring %</label>
                      <input className="input-field text-sm w-full" type="number" min={0} max={100} step="0.5" value={pctVal}
                        onChange={e => setTierEdits(s => ({ ...s, [t.id]: { ...s[t.id], recurringPct: parseFloat(e.target.value) || 0 } }))} />
                    </div>
                    <button onClick={() => saveTier(t.id)} disabled={!dirty || savingTierId === t.id}
                      className="btn-primary text-sm" style={{ whiteSpace: 'nowrap' }}>
                      {savingTierId === t.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )
              })}
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

      {editModal && (
        <EditPartnerModal
          partner={editModal}
          onClose={() => setEditModal(null)}
          onSaved={(updated) => {
            setEditModal(null)
            showToast('success', `Partner ${userName(updated.user)} updated.`)
            reloadAff()
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}
    </div>
  )
}

// ─── Edit partner modal (full record: profile + booking + usage + policy) ──
//
// On open: GETs /api/admin/affiliates/:id/edit-shape to hydrate the full
// editable shape (some fields aren't on the list-table response). Submit
// PATCHes /api/admin/affiliates/:id with the diff. Single transactional
// save server-side.
interface EditShape {
  id: string
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
  // Profile
  displayName: string | null; businessName: string | null; bio: string | null
  partnerPhone: string | null
  partnerStreet: string | null; partnerUnit: string | null; partnerCity: string | null
  partnerState: string | null; partnerPostalCode: string | null
  emailSignature: string | null
  // Settings
  aggressionTier: string
  forwardPlatformEmails: boolean; notifyAppointmentsEnabled: boolean
  // Booking
  bookingSlotDurationMin: number; bookingMinNoticeMin: number; bookingMaxAdvanceDays: number
  bookingBufferBeforeMin: number; bookingBufferAfterMin: number
  bookingTimezone: string | null
  // Usage
  leadSearchCredits: number
  // Email policy
  emailBulkEnabled: boolean; emailDailyCap: number | null
  emailSendWindowStartHour: number | null; emailSendWindowEndHour: number | null
  emailDripIntervalSecs: number | null
  // Commission (frozen-at-signup)
  commissionTierId: string | null
  commissionRatePct: number | null
  commissionLockedAt: string | null
  commissionTier: { id: string; level: number; name: string; recurringPct: number } | null
  commissionTiers: CommissionTier[]
  // Admin
  notes: string | null
}

function EditPartnerModal({
  partner, onClose, onSaved, onError,
}: {
  partner: AffiliateAccount
  onClose: () => void
  onSaved: (updated: AffiliateAccount) => void
  onError: (msg: string) => void
}) {
  const [shape, setShape] = useState<EditShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'profile' | 'booking' | 'usage' | 'notes'>('profile')
  // Commission edit is a separate endpoint (re-snapshots / sets custom rate).
  const [commMode, setCommMode] = useState<'tier' | 'custom'>('tier')
  const [commTierId, setCommTierId] = useState<string>('')
  const [commCustomPct, setCommCustomPct] = useState<string>('')
  const [savingComm, setSavingComm] = useState(false)
  const [commMsg, setCommMsg] = useState<string | null>(null)

  async function saveCommission() {
    if (!shape) return
    setSavingComm(true)
    setCommMsg(null)
    try {
      const body = commMode === 'tier'
        ? { tierId: commTierId }
        : { customRecurringPct: parseFloat(commCustomPct) || 0 }
      const res = await apiFetchRaw(`/api/admin/affiliates/${partner.id}/commission`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('save failed')
      const json = await res.json() as { data: { commissionRatePct: number; commissionTierId: string | null } }
      setShape(s => s ? { ...s, commissionRatePct: json.data.commissionRatePct, commissionTierId: json.data.commissionTierId } : s)
      setCommMsg(`Locked to ${json.data.commissionRatePct}% recurring.`)
    } catch {
      setCommMsg('Failed to update commission.')
    } finally {
      setSavingComm(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<EditShape>(`/api/admin/affiliates/${partner.id}/edit-shape`)
        setShape(res)
        // Seed commission controls: default to current tier, or custom mode if overridden.
        if (res.commissionTierId) {
          setCommMode('tier'); setCommTierId(res.commissionTierId)
        } else {
          setCommMode(res.commissionRatePct != null ? 'custom' : 'tier')
          setCommCustomPct(res.commissionRatePct != null ? String(res.commissionRatePct) : '')
          setCommTierId(res.commissionTiers[0]?.id ?? '')
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load partner')
        onClose()
      } finally { setLoading(false) }
    })()
  }, [partner.id, onClose, onError])

  function patchField<K extends keyof EditShape>(k: K, v: EditShape[K]) {
    if (!shape) return
    setShape({ ...shape, [k]: v })
  }
  function patchUser(k: 'firstName' | 'lastName' | 'email', v: string | null) {
    if (!shape) return
    setShape({ ...shape, user: { ...shape.user, [k]: v ?? '' } })
  }

  async function save() {
    if (!shape) return
    setSaving(true)
    try {
      const res = await apiFetch<{ data: AffiliateAccount } | AffiliateAccount>(
        `/api/admin/affiliates/${partner.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: shape.user.firstName || null,
            lastName: shape.user.lastName || null,
            email: shape.user.email.trim().toLowerCase(),
            displayName: shape.displayName,
            businessName: shape.businessName,
            bio: shape.bio,
            partnerPhone: shape.partnerPhone,
            partnerStreet: shape.partnerStreet,
            partnerUnit: shape.partnerUnit,
            partnerCity: shape.partnerCity,
            partnerState: shape.partnerState,
            partnerPostalCode: shape.partnerPostalCode,
            emailSignature: shape.emailSignature,
            aggressionTier: shape.aggressionTier,
            forwardPlatformEmails: shape.forwardPlatformEmails,
            notifyAppointmentsEnabled: shape.notifyAppointmentsEnabled,
            bookingSlotDurationMin: shape.bookingSlotDurationMin,
            bookingMinNoticeMin: shape.bookingMinNoticeMin,
            bookingMaxAdvanceDays: shape.bookingMaxAdvanceDays,
            bookingBufferBeforeMin: shape.bookingBufferBeforeMin,
            bookingBufferAfterMin: shape.bookingBufferAfterMin,
            bookingTimezone: shape.bookingTimezone,
            leadSearchCredits: shape.leadSearchCredits,
            emailBulkEnabled: shape.emailBulkEnabled,
            emailDailyCap: shape.emailDailyCap,
            emailSendWindowStartHour: shape.emailSendWindowStartHour,
            emailSendWindowEndHour: shape.emailSendWindowEndHour,
            emailDripIntervalSecs: shape.emailDripIntervalSecs,
            notes: shape.notes,
          }),
        },
      )
      const updated = ('data' in res ? res.data : res) as AffiliateAccount
      onSaved(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save partner')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div className="rounded-xl w-full max-w-2xl"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Edit partner {shape && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>— {[shape.user.firstName, shape.user.lastName].filter(Boolean).join(' ') || shape.user.email}</span>}
          </h2>
          <div className="flex gap-1 mt-3 -mb-1">
            {(['profile', 'booking', 'usage', 'notes'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className="text-xs px-3 py-1.5 rounded-t font-medium"
                style={{
                  background: tab === k ? 'var(--background)' : 'transparent',
                  color: tab === k ? 'oklch(55% 0.11 193)' : 'var(--text-secondary)',
                  borderBottom: tab === k ? '2px solid oklch(55% 0.11 193)' : '2px solid transparent',
                }}>
                {k === 'profile' ? 'Profile' : k === 'booking' ? 'Booking' : k === 'usage' ? 'Usage & Email' : 'Notes'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto" style={{ flex: 1 }}>
          {loading || !shape ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          ) : (
            <>
              {tab === 'profile' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="First name">
                      <Input value={shape.user.firstName ?? ''} onChange={(v) => patchUser('firstName', v)} />
                    </Field>
                    <Field label="Last name">
                      <Input value={shape.user.lastName ?? ''} onChange={(v) => patchUser('lastName', v)} />
                    </Field>
                  </div>
                  <Field label="Email" hint="also their login — change with care" hintWarn>
                    <Input type="email" value={shape.user.email} onChange={(v) => patchUser('email', v)} />
                  </Field>
                  <Field label="Display name" hint="from-header label; defaults to first+last">
                    <Input value={shape.displayName ?? ''} onChange={(v) => patchField('displayName', v || null)} />
                  </Field>
                  <Field label="Business name">
                    <Input value={shape.businessName ?? ''} onChange={(v) => patchField('businessName', v || null)} />
                  </Field>
                  <Field label="Public partner phone">
                    <Input value={shape.partnerPhone ?? ''} onChange={(v) => patchField('partnerPhone', v || null)} />
                  </Field>
                  <Field label="Bio" hint="shown on partner pages">
                    <Textarea rows={2} value={shape.bio ?? ''} onChange={(v) => patchField('bio', v || null)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Street"><Input value={shape.partnerStreet ?? ''} onChange={(v) => patchField('partnerStreet', v || null)} /></Field>
                    <Field label="Unit / Suite"><Input value={shape.partnerUnit ?? ''} onChange={(v) => patchField('partnerUnit', v || null)} /></Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="City"><Input value={shape.partnerCity ?? ''} onChange={(v) => patchField('partnerCity', v || null)} /></Field>
                    <Field label="State"><Input value={shape.partnerState ?? ''} onChange={(v) => patchField('partnerState', v || null)} /></Field>
                    <Field label="Postal code"><Input value={shape.partnerPostalCode ?? ''} onChange={(v) => patchField('partnerPostalCode', v || null)} /></Field>
                  </div>
                  <Field label="Email signature" hint="appended to outbound emails">
                    <Textarea rows={2} value={shape.emailSignature ?? ''} onChange={(v) => patchField('emailSignature', v || null)} />
                  </Field>
                  <Field label="Aggression tier" hint="marketing voice intensity">
                    <select value={shape.aggressionTier}
                      onChange={(e) => patchField('aggressionTier', e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                      <option value="conservative">Conservative</option>
                      <option value="balanced">Balanced</option>
                      <option value="direct">Direct</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </Field>
                  <Toggle checked={shape.forwardPlatformEmails} onChange={(v) => patchField('forwardPlatformEmails', v)}
                    label="Forward platform emails to their Gmail" />
                  <Toggle checked={shape.notifyAppointmentsEnabled} onChange={(v) => patchField('notifyAppointmentsEnabled', v)}
                    label="Notify on new appointments" />
                </div>
              )}

              {tab === 'booking' && (
                <div className="space-y-3">
                  <Field label="Booking timezone" hint="IANA — e.g. America/New_York">
                    <Input value={shape.bookingTimezone ?? ''} onChange={(v) => patchField('bookingTimezone', v || null)} />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Slot length (min)">
                      <NumberInput value={shape.bookingSlotDurationMin} onChange={(v) => patchField('bookingSlotDurationMin', v)} />
                    </Field>
                    <Field label="Min notice (min)">
                      <NumberInput value={shape.bookingMinNoticeMin} onChange={(v) => patchField('bookingMinNoticeMin', v)} />
                    </Field>
                    <Field label="Max advance (days)">
                      <NumberInput value={shape.bookingMaxAdvanceDays} onChange={(v) => patchField('bookingMaxAdvanceDays', v)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Buffer before (min)">
                      <NumberInput value={shape.bookingBufferBeforeMin} onChange={(v) => patchField('bookingBufferBeforeMin', v)} />
                    </Field>
                    <Field label="Buffer after (min)">
                      <NumberInput value={shape.bookingBufferAfterMin} onChange={(v) => patchField('bookingBufferAfterMin', v)} />
                    </Field>
                  </div>
                </div>
              )}

              {tab === 'usage' && (
                <div className="space-y-3">
                  {/* ── Commission (separate endpoint — re-snapshots / custom) ── */}
                  <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Commission (recurring %, locked for life)</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Current: <strong>{shape.commissionRatePct != null ? `${shape.commissionRatePct}%` : 'inherits global rate'}</strong>
                      {shape.commissionTier ? ` — Tier ${shape.commissionTier.level} (${shape.commissionTier.name})` : shape.commissionRatePct != null ? ' — custom override' : ''}
                      {shape.commissionLockedAt ? ` · locked ${new Date(shape.commissionLockedAt).toLocaleDateString()}` : ''}
                    </p>
                    <div className="flex gap-3 mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={commMode === 'tier'} onChange={() => setCommMode('tier')} /> Assign tier
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={commMode === 'custom'} onChange={() => setCommMode('custom')} /> Custom rate
                      </label>
                    </div>
                    {commMode === 'tier' ? (
                      <select className="input-field text-sm w-full" value={commTierId} onChange={e => setCommTierId(e.target.value)}>
                        {shape.commissionTiers.map(t => (
                          <option key={t.id} value={t.id}>Tier {t.level} — {t.name} ({t.recurringPct}%)</option>
                        ))}
                      </select>
                    ) : (
                      <input className="input-field text-sm w-full" type="number" min={0} max={100} step="0.5"
                        placeholder="Custom recurring %" value={commCustomPct} onChange={e => setCommCustomPct(e.target.value)} />
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={saveCommission} disabled={savingComm || (commMode === 'tier' ? !commTierId : !commCustomPct)}
                        className="btn-primary text-sm">
                        {savingComm ? 'Saving…' : 'Update commission'}
                      </button>
                      {commMsg && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{commMsg}</span>}
                    </div>
                  </div>
                  <hr style={{ borderColor: 'var(--border-subtle)' }} />
                  <Field label="Lead search credits" hint="~1 credit per result returned">
                    <NumberInput value={shape.leadSearchCredits} onChange={(v) => patchField('leadSearchCredits', v)} />
                  </Field>
                  <hr style={{ borderColor: 'var(--border-subtle)' }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Bulk email policy</p>
                  <Toggle checked={shape.emailBulkEnabled} onChange={(v) => patchField('emailBulkEnabled', v)}
                    label="Bulk email enabled (master gate)" />
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Leave any number field empty to inherit the platform default.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Daily cap (emails)">
                      <NullableNumberInput value={shape.emailDailyCap} onChange={(v) => patchField('emailDailyCap', v)} />
                    </Field>
                    <Field label="Drip interval (sec)">
                      <NullableNumberInput value={shape.emailDripIntervalSecs} onChange={(v) => patchField('emailDripIntervalSecs', v)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Send window start hour (0–23)">
                      <NullableNumberInput value={shape.emailSendWindowStartHour} onChange={(v) => patchField('emailSendWindowStartHour', v)} />
                    </Field>
                    <Field label="Send window end hour (0–23)">
                      <NullableNumberInput value={shape.emailSendWindowEndHour} onChange={(v) => patchField('emailSendWindowEndHour', v)} />
                    </Field>
                  </div>
                </div>
              )}

              {tab === 'notes' && (
                <Field label="Admin notes" hint="internal — partner doesn't see this">
                  <Textarea rows={8} value={shape.notes ?? ''} onChange={(v) => patchField('notes', v || null)} maxLength={2000} />
                </Field>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <button onClick={save} disabled={saving || loading || !shape}
            className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-40"
            style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="text-sm px-4 py-2 rounded"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Small form primitives used by the edit modal ─────────────────────────
function Field({ label, hint, hintWarn, children }: { label: string; hint?: string; hintWarn?: boolean; children: React.ReactNode }) {
  return (
    <label className="text-xs block" style={{ color: 'var(--text-secondary)' }}>
      {label}
      {hint && (
        <span style={{ color: hintWarn ? 'oklch(70% 0.16 55)' : 'var(--text-tertiary)', marginLeft: 6 }}>
          ({hint})
        </span>
      )}
      <div className="mt-1">{children}</div>
    </label>
  )
}
function Input({ value, onChange, type = 'text' }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded text-sm"
      style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
  )
}
function Textarea({ value, onChange, rows = 3, maxLength = 1000 }: { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength}
      className="w-full px-2 py-1.5 rounded text-sm"
      style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
  )
}
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input type="number" min={0} value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="w-full px-2 py-1.5 rounded text-sm"
      style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
  )
}
function NullableNumberInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input type="number" min={0} value={value ?? ''}
      placeholder="(inherit)"
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') onChange(null)
        else onChange(Math.max(0, Number(raw) || 0))
      }}
      className="w-full px-2 py-1.5 rounded text-sm"
      style={{ background: 'var(--background)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
  )
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="text-sm flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

// ─── Platform dashboard (KPI grid + 30-day chart + top performers) ────────────
const TEAL = 'oklch(55% 0.11 193)'
const TEAL_TINT = 'oklch(55% 0.11 193 / 0.10)'

interface PlatformStats {
  periodDays: number
  partners: { total: number; active: number; pending: number; paused: number; disabled: number }
  clicks: { allTime: number; period: number; delta: number | null }
  conversions: { allTime: number; period: number; delta: number | null }
  conversionRate: { allTime: number; period: number }
  revenueAttributedCents: { allTime: number; period: number }
  commissions: {
    pendingCents: number; approvedCents: number; holdCents: number
    paidCents: number; reversedCents: number; paidPeriodCents: number
  }
  topPartners: Array<{
    id: string; name: string; email: string; referralCode: string
    totalEarnedCents: number; totalPaidCents: number
  }>
}

interface DailyStats {
  clicks: Array<{ day: string; value: number }>
  conversions: Array<{ day: string; value: number }>
}

function PlatformDashboard() {
  const { data: stats, loading: statsLoading } = useApi<PlatformStats>('/api/admin/affiliate/platform-stats?days=30')
  const { data: daily } = useApi<DailyStats>('/api/admin/affiliate/platform-daily?days=30')

  if (statsLoading || !stats) {
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', height: 96 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          label="Total Partners"
          value={stats.partners.total.toLocaleString()}
          sub={`${stats.partners.active} active${stats.partners.pending > 0 ? ` · ${stats.partners.pending} pending` : ''}${stats.partners.paused > 0 ? ` · ${stats.partners.paused} paused` : ''}`}
        />
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
          label="Total Clicks (30d)"
          value={stats.clicks.period.toLocaleString()}
          sub={`${stats.clicks.allTime.toLocaleString()} all-time`}
          delta={stats.clicks.delta}
        />
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>}
          label="Conversions (30d)"
          value={stats.conversions.period.toLocaleString()}
          sub={`${stats.conversionRate.period.toFixed(2)}% conversion rate`}
          delta={stats.conversions.delta}
        />
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>}
          label="Revenue Attributed (30d)"
          value={fmtMoney(stats.revenueAttributedCents.period)}
          sub={`${fmtMoney(stats.revenueAttributedCents.allTime)} all-time`}
        />
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
          label="Commissions Owed"
          value={fmtMoney(stats.commissions.pendingCents + stats.commissions.approvedCents + stats.commissions.holdCents)}
          sub={`${fmtMoney(stats.commissions.approvedCents)} approved · ${fmtMoney(stats.commissions.pendingCents)} in hold`}
        />
        <KPICard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12H2"/><path d="M5 12V5h14v7"/><path d="M5 12v7h14v-7"/></svg>}
          label="Paid Out (30d)"
          value={fmtMoney(stats.commissions.paidPeriodCents)}
          sub={`${fmtMoney(stats.commissions.paidCents)} all-time`}
          variant="feature"
        />
      </div>

      {/* Trend chart + Top performers */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <TrendChart daily={daily} />
        <TopPerformers partners={stats.topPartners} />
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, delta, variant = 'default' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; delta?: number | null; variant?: 'default' | 'feature'
}) {
  const isFeature = variant === 'feature'
  const deltaColor = delta == null ? null
    : delta >= 0 ? 'oklch(60% 0.16 145)' : 'oklch(60% 0.20 25)'
  const deltaArrow = delta == null ? '' : delta >= 0 ? '↑' : '↓'

  return (
    <div className="rounded-xl p-4" style={{
      background: isFeature ? TEAL : 'var(--surface-raised)',
      border: isFeature ? 'none' : '1px solid var(--border-subtle)',
      boxShadow: isFeature ? '0 8px 24px oklch(55% 0.11 193 / 0.20)' : 'none',
    }}>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isFeature ? 'oklch(100% 0 0 / 0.18)' : TEAL_TINT, color: isFeature ? 'white' : TEAL }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: isFeature ? 'oklch(100% 0 0 / 0.85)' : 'var(--text-tertiary)' }}>{label}</p>
          <p className="text-xl font-bold mt-0.5 tabular-nums truncate" style={{ color: isFeature ? 'white' : 'var(--text-primary)' }}>{value}</p>
          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
            {sub && <p className="text-xs" style={{ color: isFeature ? 'oklch(100% 0 0 / 0.7)' : 'var(--text-tertiary)' }}>{sub}</p>}
            {delta != null && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: deltaColor! }}>
                {deltaArrow} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendChart({ daily }: { daily: DailyStats | null }) {
  const days = daily?.clicks.length ?? 0
  // Pad to 30 days even if some have no data, so the x-axis is consistent
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000)
    const dayKey = d.toISOString().slice(0, 10)
    const click = daily?.clicks.find(c => c.day === dayKey)?.value ?? 0
    const conv  = daily?.conversions.find(c => c.day === dayKey)?.value ?? 0
    return { dayKey, click, conv }
  })
  const maxClick = Math.max(1, ...last30.map(d => d.click))
  const maxConv  = Math.max(1, ...last30.map(d => d.conv))

  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>30-day activity</p>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: TEAL }} />Clicks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: 'oklch(60% 0.16 145)' }} />Conversions
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1 flex-1" style={{ height: 120 }}>
        {last30.map(d => {
          const clickPct = (d.click / maxClick) * 100
          const convPct  = (d.conv  / maxConv)  * 100
          return (
            <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative" style={{ height: '100%' }}>
              {/* Tooltip */}
              {(d.click > 0 || d.conv > 0) && (
                <div className="absolute bottom-full mb-1 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {new Date(d.dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' · '}{d.click} clicks{' · '}{d.conv} conv.
                </div>
              )}
              <div className="w-full rounded-t-sm flex flex-col justify-end gap-0" style={{ height: '100%' }}>
                <div style={{ height: `${clickPct}%`, background: TEAL, opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                {d.conv > 0 && (
                  <div style={{ height: `${convPct * 0.3}%`, background: 'oklch(60% 0.16 145)', minHeight: 2 }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        <span>{new Date(last30[0]!.dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>Today</span>
      </div>
      {days === 0 && <p className="text-xs text-center mt-3" style={{ color: 'var(--text-tertiary)' }}>No activity in the last 30 days yet.</p>}
    </div>
  )
}

function TopPerformers({ partners }: { partners: PlatformStats['topPartners'] }) {
  const max = Math.max(1, ...partners.map(p => p.totalEarnedCents))
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Top performers</p>
      {partners.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No active partners with earnings yet.</p>
      ) : (
        <ul className="space-y-2">
          {partners.map((p, i) => {
            const pct = (p.totalEarnedCents / max) * 100
            const initials = p.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
            return (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: TEAL_TINT, color: TEAL }}>
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs font-bold tabular-nums" style={{ color: TEAL }}>{fmtMoney(p.totalEarnedCents)}</p>
                  </div>
                  <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--surface-overlay)' }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: TEAL }} />
                  </div>
                </div>
                <span className="text-xs tabular-nums w-5 text-right" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function fmtMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Lead engine — global default credits ───────────────────────────────────
// The allotment a partner is granted on approval. Per-partner balances are
// adjusted inline in the partners table (PartnerCreditsCell).
function LeadCreditsCard({ showToast }: { showToast: (type: 'success' | 'error', text: string) => void }) {
  const { data, reload } = useApi<{ defaultCredits: number }>('/api/admin/lead-engine/settings')
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setVal(String(data.defaultCredits)) }, [data])

  async function save() {
    const n = parseInt(val, 10)
    if (!Number.isFinite(n) || n < 0) { showToast('error', 'Enter a valid credit amount.'); return }
    setSaving(true)
    try {
      const res = await apiFetchRaw('/api/admin/lead-engine/settings', {
        method: 'PATCH',
        body:   JSON.stringify({ defaultCredits: n }),
      })
      if (!res.ok) throw new Error()
      showToast('success', 'Default lead credits saved.')
      reload()
    } catch { showToast('error', 'Failed to save default lead credits.') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl p-4 flex flex-wrap items-end gap-3" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Default lead-search credits</span>
        <input type="number" min={0} className="input-field text-sm w-32" value={val} onChange={e => setVal(e.target.value)} />
      </div>
      <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <p className="text-xs flex-1 min-w-[220px]" style={{ color: 'var(--text-tertiary)' }}>
        Granted to each partner when their account is approved. Existing partners keep their current balance — adjust those individually in the table below.
      </p>
    </div>
  )
}

// ── Lead engine — per-partner credit override ───────────────────────────────
function PartnerCreditsCell({ partner, onSaved, onError }: {
  partner: AffiliateAccount
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(partner.leadSearchCredits))
  const [saving, setSaving]   = useState(false)

  async function save() {
    const n = parseInt(val, 10)
    if (!Number.isFinite(n) || n < 0) { onError('Enter a valid credit amount.'); return }
    setSaving(true)
    try {
      const res = await apiFetchRaw(`/api/admin/affiliates/${partner.id}/lead-credits`, {
        method: 'PATCH',
        body:   JSON.stringify({ credits: n }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
      onSaved()
    } catch { onError('Failed to update lead credits.') }
    finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setVal(String(partner.leadSearchCredits)); setEditing(true) }}
        className="text-xs px-2 py-1 rounded"
        style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        title="Adjust this partner's lead-search credits"
      >
        {partner.leadSearchCredits.toLocaleString()} ✎
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" min={0} autoFocus className="input-field text-xs w-20" value={val} onChange={e => setVal(e.target.value)} />
      <button onClick={save} disabled={saving} className="text-xs px-1.5 py-1 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>✓</button>
      <button onClick={() => setEditing(false)} disabled={saving} className="text-xs px-1.5 py-1 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>✕</button>
    </span>
  )
}

// ── F.4 bulk action: flip emailBulkEnabled for every ACTIVE partner ────────
// Sits at the top of the partners tab. Two buttons with confirmation prompts.
// The backend `bulk-email-toggle` endpoint only updates rows actually changing
// (skips already-at-target) and returns the count.
function BulkEmailToggle({
  reload,
  showToast,
}: {
  reload: () => void
  showToast: (type: 'success' | 'error', text: string) => void
}) {
  const [working, setWorking] = useState<'enable' | 'disable' | null>(null)

  async function flip(enabled: boolean) {
    const verb = enabled ? 'ENABLE' : 'DISABLE'
    const consequence = enabled
      ? 'Every ACTIVE partner will gain access to create + start bulk email campaigns.'
      : 'Every ACTIVE partner will lose bulk email access. Any RUNNING campaigns auto-pause on the next worker tick (within 15s). Suspension state is not touched.'
    if (!confirm(`${verb} bulk email for ALL active partners?\n\n${consequence}\n\nClick OK to proceed.`)) return

    setWorking(enabled ? 'enable' : 'disable')
    try {
      const res = await apiFetchRaw('/api/admin/partners/bulk-email-toggle', {
        method: 'POST',
        body:   JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Bulk toggle failed')
      const body = await res.json() as { data: { updated: number } }
      showToast('success', `Bulk email ${enabled ? 'enabled' : 'disabled'} for ${body.data.updated} partner(s).`)
      reload()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Bulk toggle failed')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Bulk email — all active partners
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          Master gate across every ACTIVE partner at once. Per-partner overrides are unaffected.
        </p>
      </div>
      <button
        onClick={() => flip(true)}
        disabled={!!working}
        className="text-xs px-3 py-1.5 rounded"
        style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}
      >
        {working === 'enable' ? 'Enabling…' : 'Enable for all'}
      </button>
      <button
        onClick={() => flip(false)}
        disabled={!!working}
        className="text-xs px-3 py-1.5 rounded"
        style={{ background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }}
      >
        {working === 'disable' ? 'Disabling…' : 'Disable for all'}
      </button>
    </div>
  )
}

// ── F.4 inline editor: per-partner email policy ────────────────────────────
// Embedded under each partner row in the Affiliates tab. Wraps the existing
// PUT /api/admin/partners/:id/email-policy + POST /api/admin/partners/:id/
// email-suspend endpoints so admins don't need to flip flags via SQL.
function PartnerEmailPolicyEditor({
  partner,
  defaults,
  onSaved,
  onError,
}: {
  partner: AffiliateAccount
  defaults: PlatformEmailPolicy
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [bulkEnabled,         setBulkEnabled]         = useState(partner.emailBulkEnabled)
  const [dailyCap,            setDailyCap]            = useState<string>(partner.emailDailyCap?.toString() ?? '')
  const [sendWindowStartHour, setSendWindowStartHour] = useState<string>(partner.emailSendWindowStartHour?.toString() ?? '')
  const [sendWindowEndHour,   setSendWindowEndHour]   = useState<string>(partner.emailSendWindowEndHour?.toString() ?? '')
  const [dripIntervalSecs,    setDripIntervalSecs]    = useState<string>(partner.emailDripIntervalSecs?.toString() ?? '')
  const [suspended,           setSuspended]           = useState(!!partner.emailBulkSuspendedAt)
  const [suspendReason,       setSuspendReason]       = useState(partner.emailBulkSuspendedReason ?? '')
  const [saving, setSaving] = useState(false)

  function parseOverride(s: string): number | null {
    if (s.trim() === '') return null
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }

  async function save() {
    setSaving(true)
    try {
      // Two endpoints: overrides + (separately) suspension toggle. Suspension
      // call only fires when state actually changed — avoids spurious audit
      // entries on every save.
      const res1 = await apiFetchRaw(`/api/admin/partners/${partner.id}/email-policy`, {
        method: 'PUT',
        body: JSON.stringify({
          bulkEnabled,
          dailyCap:             parseOverride(dailyCap),
          sendWindowStartHour:  parseOverride(sendWindowStartHour),
          sendWindowEndHour:    parseOverride(sendWindowEndHour),
          dripIntervalSecs:     parseOverride(dripIntervalSecs),
        }),
      })
      if (!res1.ok) throw new Error('Save failed')

      const wasSuspended = !!partner.emailBulkSuspendedAt
      if (suspended !== wasSuspended || (suspended && suspendReason !== (partner.emailBulkSuspendedReason ?? ''))) {
        const res2 = await apiFetchRaw(`/api/admin/partners/${partner.id}/email-suspend`, {
          method: 'POST',
          body:   JSON.stringify({ suspended, reason: suspendReason || undefined }),
        })
        if (!res2.ok) throw new Error('Suspend save failed')
      }
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inp  = 'input-field text-xs'
  const lbl  = 'block text-xs font-medium mb-1'
  const hint = 'text-[10px] mt-0.5'

  return (
    <div className="space-y-3" style={{ color: 'var(--text-primary)' }}>
      <div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bulkEnabled} onChange={(e) => setBulkEnabled(e.target.checked)} />
          <span>Bulk email enabled</span>
        </label>
        <p className={hint} style={{ color: 'var(--text-tertiary)' }}>
          Master gate. Partners cannot send bulk campaigns until you turn this on.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Daily cap override</label>
          <input className={inp} type="number" min={1} max={100000} value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} placeholder={`(default ${defaults.dailyCap})`} />
          <p className={hint} style={{ color: 'var(--text-tertiary)' }}>Blank = inherit platform default.</p>
        </div>
        <div>
          <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Send window start (hour)</label>
          <input className={inp} type="number" min={0} max={23} value={sendWindowStartHour} onChange={(e) => setSendWindowStartHour(e.target.value)} placeholder={`(default ${defaults.sendWindowStartHour})`} />
          <p className={hint} style={{ color: 'var(--text-tertiary)' }}>0-23, partner&apos;s local time.</p>
        </div>
        <div>
          <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Send window end (hour)</label>
          <input className={inp} type="number" min={0} max={23} value={sendWindowEndHour} onChange={(e) => setSendWindowEndHour(e.target.value)} placeholder={`(default ${defaults.sendWindowEndHour})`} />
          <p className={hint} style={{ color: 'var(--text-tertiary)' }}>Inclusive end hour.</p>
        </div>
        <div>
          <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Drip interval (sec)</label>
          <input className={inp} type="number" min={1} max={86400} value={dripIntervalSecs} onChange={(e) => setDripIntervalSecs(e.target.value)} placeholder={`(default ${defaults.dripIntervalSecs})`} />
          <p className={hint} style={{ color: 'var(--text-tertiary)' }}>Seconds between sends.</p>
        </div>
      </div>

      <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} />
          <span style={{ color: suspended ? 'oklch(68% 0.20 25)' : 'var(--text-primary)' }}>Suspended (block all bulk sending)</span>
        </label>
        {suspended && (
          <div className="mt-2">
            <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Suspension reason (admin-visible only)</label>
            <input className="input-field text-xs" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} maxLength={500} placeholder="e.g. spam complaints from last campaign" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
