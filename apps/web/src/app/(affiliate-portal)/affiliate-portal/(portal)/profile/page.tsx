'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type Account = {
  id: string
  status: string
  referralCode: string
  commissionRatePct: number
  payoutMethod: string | null
  payoutDetails: Record<string, string> | null
  notes: string | null
  createdAt: string
}

const PAYOUT_METHODS = ['PayPal', 'Bank Transfer', 'Wise', 'Other']

export default function AffiliateProfilePage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [method, setMethod] = useState('')
  const [details, setDetails] = useState('')

  useEffect(() => {
    apiFetch<Account>('/api/affiliate/account')
      .then(acc => {
        setAccount(acc)
        if (acc) {
          setMethod(acc.payoutMethod ?? '')
          setDetails(acc.payoutDetails ? JSON.stringify(acc.payoutDetails, null, 2) : '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      let parsedDetails: Record<string, string> | null = null
      if (details.trim()) {
        try { parsedDetails = JSON.parse(details) } catch { parsedDetails = { info: details.trim() } }
      }
      await apiFetch('/api/affiliate/payout-method', {
        method: 'PATCH',
        body: JSON.stringify({ payoutMethod: method || null, payoutDetails: parsedDetails }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Save failed')
    }
    setSaving(false)
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>

  if (!account) {
    return (
      <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>
        No affiliate account found. Apply from the Dashboard.
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Profile</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Your partner account details and payout preferences.</p>

      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>ACCOUNT INFO</p>
        <div className="space-y-2">
          <Row label="Account ID" value={account.id.slice(0, 8) + '…'} mono />
          <Row label="Status" value={account.status} />
          <Row label="Referral Code" value={account.referralCode} mono />
          <Row label="Commission Rate" value={account.commissionRatePct + '%'} />
          <Row label="Member Since" value={new Date(account.createdAt).toLocaleDateString()} />
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>PAYOUT PREFERENCES</p>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Payout Method</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <option value="">Select a method…</option>
          {PAYOUT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Payment Details</label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Email address, account number, or routing information for your chosen method.</p>
        <textarea
          rows={3}
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder='e.g. paypal@email.com or {"email":"paypal@email.com"}'
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 resize-none"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />

        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: saved ? 'oklch(55% 0.18 145)' : 'var(--brand-primary)', color: '#fff' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}
