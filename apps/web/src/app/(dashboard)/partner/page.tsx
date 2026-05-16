'use client'

import { useState, useEffect } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface AffiliateAccount {
  id: string; status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'DISABLED'
  referralCode: string; createdAt: string; approvedAt: string | null
  totalEarnedCents: number; totalPaidCents: number; payoutRequestedAt: string | null
  payoutMethodJson: Record<string, string> | null
}
interface AffiliateStats {
  clicks: number; conversions: number
  pendingCents: number; approvedCents: number; holdCents: number; paidCents: number; totalEarnedCents: number
}
interface Commission {
  id: string; amountMinor: number; currency: string; status: string
  approvedAt: string | null; paidAt: string | null; createdAt: string
  affiliateConversion: { conversionType: string; conversionValue: number | null; occurredAt: string }
}
interface CommissionList { items: Commission[]; total: number }
interface ReferralLink { url: string; code: string }
interface DailyPoint { day: string; clicks?: number; conversions?: number }
interface DailyStats { clicks: DailyPoint[]; conversions: DailyPoint[] }
interface PayoutRequest { id: string; amountCents: number; status: string; requestedAt: string; processedAt: string | null; payoutRef: string | null }
interface AffiliateSettings { cookieDurationDays: number; commissionRatePct: number; programName: string; programDescription: string; termsUrl: string | null }

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:  { bg: 'oklch(14% 0.04 75)',    text: 'oklch(70% 0.16 75)',  label: 'Pending approval' },
  ACTIVE:   { bg: 'oklch(19% 0.04 193)',   text: 'oklch(72% 0.12 193)', label: 'Active' },
  PAUSED:   { bg: 'oklch(13% 0.04 25)',    text: 'oklch(68% 0.20 25)',  label: 'Paused' },
  DISABLED: { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)', label: 'Disabled' },
}

const COMM_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
  APPROVED: { bg: 'oklch(19% 0.04 193)',    text: 'oklch(72% 0.12 193)' },
  HOLD:     { bg: 'oklch(14% 0.04 75)',     text: 'oklch(70% 0.16 75)'  },
  PAID:     { bg: 'oklch(15% 0.05 145)',    text: 'oklch(65% 0.15 145)' },
  REVERSED: { bg: 'oklch(13% 0.04 25)',     text: 'oklch(68% 0.20 25)'  },
}

function cents(n: number) { return `$${(n / 100).toFixed(2)}` }

function copyText(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

// Simple SVG bar chart
function BarChart({ data, valueKey, color }: { data: DailyPoint[]; valueKey: 'clicks' | 'conversions'; color: string }) {
  if (!data.length) return <div className="h-20 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}><span className="text-xs">No data yet</span></div>
  const max = Math.max(...data.map(d => (d[valueKey] as number) ?? 0), 1)
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {data.map((d) => {
        const val = (d[valueKey] as number) ?? 0
        const h = Math.max((val / max) * 100, val > 0 ? 8 : 2)
        return (
          <div key={d.day} className="flex-1 group relative" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${h}%`, background: color, borderRadius: '2px 2px 0 0', opacity: val > 0 ? 0.9 : 0.2 }} />
            {val > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '10px' }}>
                {d.day.slice(5)}: {val}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AffiliatePage() {
  const { data: account, loading: acctLoading, reload: reloadAccount } = useApi<AffiliateAccount | null>('/api/affiliate/account')
  const { data: stats, reload: reloadStats } = useApi<AffiliateStats>(account ? '/api/affiliate/stats' : '', [account?.id])
  const { data: link }  = useApi<ReferralLink>(account?.status === 'ACTIVE' ? '/api/affiliate/link' : '', [account?.id])
  const { data: commissions, reload: reloadComm } = useApi<CommissionList>(account ? '/api/affiliate/commissions' : '', [account?.id])
  const { data: daily } = useApi<DailyStats>(account ? '/api/affiliate/stats/daily' : '', [account?.id])
  const { data: payoutReqs, reload: reloadPayout } = useApi<PayoutRequest[]>(account ? '/api/affiliate/payout/requests' : '', [account?.id])
  const { data: settings } = useApi<AffiliateSettings>('/api/public/affiliate/settings')

  const [applying, setApplying]     = useState(false)
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [tab, setTab]               = useState<'overview' | 'commissions' | 'payouts' | 'settings'>('overview')
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [showPayoutForm, setShowPayoutForm] = useState(false)
  const [payoutMethod, setPayoutMethod]     = useState({ type: 'paypal', email: '' })

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function apply() {
    setApplying(true)
    try {
      await apiFetchRaw('/api/affiliate/apply', { method: 'POST' })
      await reloadAccount()
      showToast('success', 'Application submitted! We\'ll review it within 1–2 business days.')
    } catch { showToast('error', 'Failed to submit application.') }
    finally { setApplying(false) }
  }

  async function requestPayout() {
    setRequestingPayout(true)
    try {
      const res = await apiFetchRaw('/api/affiliate/payout/request', { method: 'POST' })
      const json = await res.json() as { errors?: { message: string }[] }
      if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'Failed')
      await Promise.all([reloadAccount(), reloadStats(), reloadComm(), reloadPayout()])
      showToast('success', 'Payout request submitted!')
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Failed to request payout.') }
    finally { setRequestingPayout(false) }
  }

  async function savePayoutMethod() {
    try {
      await apiFetchRaw('/api/affiliate/payout-method', { method: 'PATCH', body: JSON.stringify(payoutMethod), headers: { 'Content-Type': 'application/json' } })
      await reloadAccount()
      setShowPayoutForm(false)
      showToast('success', 'Payout method saved.')
    } catch { showToast('error', 'Failed to save payout method.') }
  }

  // Pre-fill payout form from saved method
  useEffect(() => {
    if (account?.payoutMethodJson) {
      const m = account.payoutMethodJson as { type?: string; email?: string }
      setPayoutMethod({ type: m.type ?? 'paypal', email: m.email ?? '' })
    }
  }, [account?.id])

  if (acctLoading) return <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />

  const TAB_STYLE = (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    background: active ? 'var(--nav-active-bg, oklch(19% 0.04 193 / 0.15))' : 'transparent',
    color: active ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)',
    border: 'none',
    transition: 'all 0.15s',
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {settings?.programName ?? 'Partner Program'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {settings?.programDescription ?? 'Earn commission by referring new customers.'}
          </p>
        </div>
        {account?.status === 'ACTIVE' && (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Active partner
          </div>
        )}
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* No account */}
      {!account && (
        <div className="rounded-xl p-8 text-center space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: 'oklch(19% 0.04 193)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(72% 0.12 193)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 0-2 2-2-2m2 2V9" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Join the Affiliate Program</h2>
            <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Share your unique referral link and earn commission for every customer who signs up and subscribes.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm max-w-sm mx-auto">
            {[
              [`${settings?.commissionRatePct ?? 20}%`, 'Commission rate'],
              [`${settings?.cookieDurationDays ?? 30} days`, 'Cookie window'],
              ['Monthly', 'Payouts'],
            ].map(([val, lbl]) => (
              <div key={lbl} className="p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{val}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lbl}</p>
              </div>
            ))}
          </div>
          {settings?.termsUrl && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              By applying you agree to the <a href={settings.termsUrl} target="_blank" rel="noopener" style={{ color: 'oklch(72% 0.12 193)' }}>Partner Terms</a>.
            </p>
          )}
          <button onClick={apply} disabled={applying} className="btn-primary">
            {applying ? 'Submitting…' : 'Apply now'}
          </button>
        </div>
      )}

      {account && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-overlay)', width: 'fit-content' }}>
            {(['overview', 'commissions', 'payouts', 'settings'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Status card */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Your affiliate account</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      Member since {new Date(account.createdAt).toLocaleDateString()}
                      {account.approvedAt ? ` · Approved ${new Date(account.approvedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className="badge" style={{ background: STATUS_STYLE[account.status]!.bg, color: STATUS_STYLE[account.status]!.text }}>
                    {STATUS_STYLE[account.status]!.label}
                  </span>
                </div>

                {account.status === 'PENDING' && (
                  <div className="px-6 py-4">
                    <div className="p-3 rounded-lg text-sm" style={{ background: 'oklch(14% 0.04 75)', color: 'oklch(70% 0.16 75)' }}>
                      Your application is under review. We typically respond within 1–2 business days.
                    </div>
                  </div>
                )}

                {account.status === 'ACTIVE' && link && (
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Your referral link</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs px-3 py-2 rounded-lg font-mono truncate"
                          style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                          {link.url}
                        </code>
                        <button onClick={() => copyText(link.url, setCopiedLink)} className="btn-ghost text-xs flex-shrink-0">
                          {copiedLink ? 'Copied!' : 'Copy link'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Referral code</p>
                        <div className="flex items-center gap-2">
                          <code className="px-3 py-1.5 rounded-lg font-mono tracking-widest text-sm"
                            style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                            {link.code}
                          </code>
                          <button onClick={() => copyText(link.code, setCopiedCode)} className="btn-ghost text-xs">
                            {copiedCode ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {settings?.cookieDurationDays ?? 30}-day cookie window
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats grid */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Total clicks',    value: stats.clicks.toLocaleString(),       sub: 'All time' },
                    { label: 'Conversions',     value: stats.conversions.toLocaleString(),  sub: 'Paid signups' },
                    { label: 'Total earned',    value: cents(stats.totalEarnedCents),        sub: 'All commissions' },
                    { label: 'Approved',        value: cents(stats.approvedCents),           sub: 'Ready to request' },
                    { label: 'On hold',         value: cents(stats.holdCents),               sub: 'Payout pending' },
                    { label: 'Paid out',        value: cents(stats.paidCents),               sub: 'Lifetime' },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Payout CTA */}
              {stats && stats.approvedCents > 0 && !account.payoutRequestedAt && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'oklch(12% 0.04 145)', border: '1px solid oklch(25% 0.08 145)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'oklch(65% 0.15 145)' }}>You have {cents(stats.approvedCents)} ready to pay out</p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(50% 0.10 145)' }}>Submit a payout request to receive your earnings</p>
                  </div>
                  <button onClick={requestPayout} disabled={requestingPayout}
                    className="text-xs px-4 py-2 rounded-lg font-medium"
                    style={{ background: 'oklch(25% 0.08 145)', color: 'oklch(65% 0.15 145)', border: '1px solid oklch(35% 0.10 145)' }}>
                    {requestingPayout ? 'Requesting…' : 'Request payout'}
                  </button>
                </div>
              )}

              {/* Charts */}
              {daily && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Clicks (30 days)', data: daily.clicks, key: 'clicks' as const, color: 'oklch(55% 0.11 193)' },
                    { title: 'Conversions (30 days)', data: daily.conversions, key: 'conversions' as const, color: 'oklch(55% 0.15 145)' },
                  ].map(({ title, data, key, color }) => (
                    <div key={title} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{title}</p>
                      <BarChart data={data} valueKey={key} color={color} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── COMMISSIONS ── */}
          {tab === 'commissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {commissions ? `${commissions.total} total commissions` : ''}
                </p>
              </div>
              {commissions && commissions.items.length === 0 && (
                <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No commissions yet. Share your referral link to get started.</p>
                </div>
              )}
              {commissions && commissions.items.length > 0 && (
                <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Type', 'Amount', 'Status', 'Date'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.items.map((c, i) => {
                        const s = COMM_STYLE[c.status] ?? COMM_STYLE.PENDING!
                        return (
                          <tr key={c.id} style={{ borderBottom: i < commissions.items.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.affiliateConversion.conversionType}</td>
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{cents(c.amountMinor)}</td>
                            <td className="px-4 py-3"><span className="badge" style={{ background: s.bg, color: s.text }}>{c.status}</span></td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
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
            <div className="space-y-5">
              <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Payout method</p>
                  <button onClick={() => setShowPayoutForm(!showPayoutForm)} className="btn-ghost text-xs">
                    {showPayoutForm ? 'Cancel' : account.payoutMethodJson ? 'Edit' : 'Add method'}
                  </button>
                </div>
                {!showPayoutForm && account.payoutMethodJson && (
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'oklch(19% 0.04 193)' }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="oklch(72% 0.12 193)" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{(account.payoutMethodJson as { type?: string }).type?.toUpperCase() ?? 'PayPal'}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(account.payoutMethodJson as { email?: string }).email ?? '—'}</p>
                    </div>
                  </div>
                )}
                {!showPayoutForm && !account.payoutMethodJson && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No payout method on file. Add one before requesting a payout.</p>
                )}
                {showPayoutForm && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Method</label>
                      <select className="input-field text-sm w-full" value={payoutMethod.type}
                        onChange={e => setPayoutMethod(p => ({ ...p, type: e.target.value }))}>
                        <option value="paypal">PayPal</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="check">Check</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        {payoutMethod.type === 'paypal' ? 'PayPal email' : payoutMethod.type === 'bank_transfer' ? 'Account details' : 'Mailing address'}
                      </label>
                      <input className="input-field text-sm w-full" value={payoutMethod.email}
                        onChange={e => setPayoutMethod(p => ({ ...p, email: e.target.value }))}
                        placeholder={payoutMethod.type === 'paypal' ? 'you@example.com' : 'Enter details…'} />
                    </div>
                    <button onClick={savePayoutMethod} className="btn-primary text-xs">Save payout method</button>
                  </div>
                )}
              </div>

              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Available', value: cents(stats.approvedCents), note: 'Ready to request' },
                    { label: 'On hold',   value: cents(stats.holdCents),     note: 'Payout processing' },
                    { label: 'Paid out',  value: cents(stats.paidCents),     note: 'Lifetime' },
                  ].map(({ label, value, note }) => (
                    <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{note}</p>
                    </div>
                  ))}
                </div>
              )}

              {stats && stats.approvedCents > 0 && (
                <button onClick={requestPayout} disabled={requestingPayout || !!account.payoutRequestedAt}
                  className="btn-primary w-full">
                  {requestingPayout ? 'Requesting…' : account.payoutRequestedAt ? 'Payout request submitted' : `Request payout of ${cents(stats.approvedCents)}`}
                </button>
              )}

              {payoutReqs && payoutReqs.length > 0 && (
                <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="px-4 py-3" style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Payout history</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Amount', 'Status', 'Requested', 'Processed', 'Ref'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payoutReqs.map((r, i) => (
                        <tr key={r.id} style={{ borderBottom: i < payoutReqs.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{cents(r.amountCents)}</td>
                          <td className="px-4 py-3">
                            <span className="badge" style={{
                              background: r.status === 'PROCESSED' ? 'oklch(15% 0.05 145)' : 'var(--surface-overlay)',
                              color:      r.status === 'PROCESSED' ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)',
                            }}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.payoutRef ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PROGRAM DETAILS ── */}
          {tab === 'settings' && settings && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="px-5 py-4" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Program details</p>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {[
                    { label: 'Commission rate', value: `${settings.commissionRatePct}%` },
                    { label: 'Cookie window',   value: `${settings.cookieDurationDays} days` },
                    { label: 'Payout schedule', value: 'Monthly (on request)' },
                    { label: 'Your code',       value: account.referralCode },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <p className="text-xs font-medium font-mono" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {settings.termsUrl && (
                <a href={settings.termsUrl} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: 'oklch(72% 0.12 193)' }}>
                  View partner terms →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
