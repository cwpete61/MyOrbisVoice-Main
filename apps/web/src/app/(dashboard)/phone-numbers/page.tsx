'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface PhoneNumber {
  id: string
  e164Number: string
  displayLabel: string | null
  isInboundEnabled: boolean
  isOutboundEnabled: boolean
  isSmsEnabled: boolean
  forwardingTarget: string | null
  twilioNumberSid: string | null
  monthlyPriceCents: number | null
}

interface AvailableNumber {
  phoneNumber: string
  friendlyName: string
  locality: string | null
  region: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
  monthlyPriceCents: number
}

function formatPhone(e164: string): string {
  // +1xxxxxxxxxx → (xxx) xxx-xxxx
  if (e164.startsWith('+1') && e164.length === 12) {
    const a = e164.slice(2, 5)
    const b = e164.slice(5, 8)
    const c = e164.slice(8, 12)
    return `(${a}) ${b}-${c}`
  }
  return e164
}

function CapabilityBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: enabled ? 'oklch(55% 0.11 193 / 0.15)' : 'var(--surface-app)',
        color: enabled ? 'oklch(40% 0.13 193)' : 'var(--text-tertiary)',
        opacity: enabled ? 1 : 0.5,
      }}
    >
      {label}
    </span>
  )
}

export default function PhoneNumbersPage() {
  const { data: numbers, loading, reload } = useApi<PhoneNumber[]>('/api/phone-numbers')
  const [maxAllowed, setMaxAllowed] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  // Number-search modal state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAreaCode, setSearchAreaCode] = useState('')
  const [searchPattern, setSearchPattern] = useState('')
  const [searchResults, setSearchResults] = useState<AvailableNumber[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    apiFetch<Record<string, boolean | number>>('/api/entitlements')
      .then(e => {
        const v = e?.['max_phone_numbers']
        setMaxAllowed(typeof v === 'number' ? v : 0)
      })
      .catch(() => setMaxAllowed(0))
  }, [])

  const used    = numbers?.length ?? 0
  const atCap   = maxAllowed !== null && used >= maxAllowed
  const noPlan  = maxAllowed === 0

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 5000) }

  async function runSearch() {
    setSearchError('')
    setSearching(true)
    setSearchResults(null)
    try {
      const params = new URLSearchParams()
      if (searchAreaCode.trim()) params.set('areaCode', searchAreaCode.trim())
      if (searchPattern.trim())  params.set('pattern',  searchPattern.trim())
      params.set('capabilities', 'voice,sms')
      params.set('limit', '20')
      const data = await apiFetch<AvailableNumber[]>(`/api/twilio/numbers/search?${params.toString()}`)
      setSearchResults(data || [])
      if (!data || data.length === 0) setSearchError('No matching numbers available. Try a different area code or remove the pattern.')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function purchase(num: AvailableNumber) {
    if (!confirm(`Get ${formatPhone(num.phoneNumber)}?\n\nMonthly cost: $${(num.monthlyPriceCents / 100).toFixed(2)} (included in your plan).`)) return
    setPurchasing(num.phoneNumber)
    try {
      await apiFetch('/api/twilio/numbers/purchase', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: num.phoneNumber }),
      })
      showToast(`Number ${formatPhone(num.phoneNumber)} is yours.`)
      setSearchOpen(false)
      setSearchResults(null)
      setSearchAreaCode('')
      setSearchPattern('')
      reload()
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setPurchasing(null)
    }
  }

  async function releaseNumber(n: PhoneNumber) {
    if (!confirm(`Release ${formatPhone(n.e164Number)}?\n\nThe number will be returned to Twilio's pool. This cannot be undone.`)) return
    try {
      await apiFetch(`/api/phone-numbers/${n.id}`, { method: 'DELETE' })
      showToast(`Number ${formatPhone(n.e164Number)} released.`)
      reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Release failed')
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Phone Numbers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Search and assign Twilio numbers to your tenant. We handle the Twilio account and billing.
          </p>
          {maxAllowed !== null && (
            <p className="text-xs mt-1.5" style={{ color: atCap ? 'oklch(55% 0.18 25)' : 'var(--text-tertiary)' }}>
              <strong>{used} of {maxAllowed}</strong> phone numbers used
              {atCap && ' — plan limit reached'}
            </p>
          )}
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          disabled={atCap}
          title={atCap
            ? noPlan
              ? 'Your plan does not include phone numbers. Upgrade to request a number.'
              : `Plan limit reached: ${used} of ${maxAllowed} used.`
            : 'Search and request a phone number'}
          className="btn-primary text-sm px-4 py-2"
          style={atCap ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          + Get a Number
        </button>
      </div>

      {toast && <div className="alert-success mt-4">{toast}</div>}

      {/* Twilio compliance banner — kept; still useful pointer to help center */}
      <a
        href="/help#integrations-twilio-approval"
        className="block mt-4 px-4 py-3 rounded-xl text-xs"
        style={{
          background: 'oklch(55% 0.20 25 / 0.08)',
          border: '1px solid oklch(60% 0.22 25 / 0.5)',
          color: 'oklch(50% 0.18 25)',
          textDecoration: 'none',
        }}
      >
        ℹ️ <strong>About SMS approvals (10DLC):</strong> SMS sending requires a one-time
        carrier registration we manage on your behalf. Voice + inbound calls work
        immediately on any number you request. Read the Twilio approval guide →
      </a>

      {/* Numbers list / empty state */}
      <div className="mt-6">
        {loading ? (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !numbers || numbers.length === 0 ? (
          <div className="text-sm py-12 text-center rounded-xl border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
            <p>No phone numbers yet.</p>
            <p className="mt-1 text-xs">{noPlan
              ? 'Your current plan does not include phone numbers. Upgrade to request one.'
              : 'Click "Get a Number" above to search Twilio\'s inventory and add one to your tenant.'}</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            {numbers.map((n, i) => (
              <div
                key={n.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: 'var(--surface-raised)',
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatPhone(n.e164Number)}
                    </span>
                    {n.displayLabel && (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{n.displayLabel}</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    <CapabilityBadge enabled={n.isInboundEnabled}  label="Inbound" />
                    <CapabilityBadge enabled={n.isOutboundEnabled} label="Outbound" />
                    <CapabilityBadge enabled={n.isSmsEnabled}      label="SMS" />
                    {n.monthlyPriceCents !== null && (
                      <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>
                        ${(n.monthlyPriceCents / 100).toFixed(2)}/mo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => releaseNumber(n)}
                    className="text-xs px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: 'oklch(55% 0.14 25 / 0.3)', color: 'oklch(60% 0.18 25)' }}
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search modal ──────────────────────────────────────────────── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => !searching && !purchasing && setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl p-6"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Get a Phone Number</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Search Twilio's inventory. Cost is included in your plan ($1.15/month per number).
                </p>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                disabled={!!purchasing}
                className="text-sm"
                style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Area code (optional)</label>
                <input
                  value={searchAreaCode}
                  onChange={(e) => setSearchAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="610"
                  maxLength={3}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Contains digits (optional)</label>
                <input
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="8888"
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <button
                onClick={runSearch}
                disabled={searching}
                className="btn-primary text-sm px-4 py-2"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>

            {searchError && (
              <div className="rounded-lg px-3 py-2 mb-3 text-xs"
                style={{ background: 'oklch(95% 0.05 25 / 0.5)', color: 'oklch(45% 0.18 25)' }}>
                {searchError}
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="rounded-lg overflow-hidden border max-h-[400px] overflow-y-auto"
                style={{ borderColor: 'var(--border-subtle)' }}>
                {searchResults.map((n, i) => (
                  <div key={n.phoneNumber}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                    style={{
                      background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)',
                      borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                    }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatPhone(n.phoneNumber)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {n.locality ?? n.region ?? 'United States'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>·</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          ${(n.monthlyPriceCents / 100).toFixed(2)}/mo
                        </span>
                        <div className="flex gap-1 ml-2">
                          {n.capabilities.voice && <span className="text-xs px-1.5 rounded" style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(40% 0.13 193)' }}>Voice</span>}
                          {n.capabilities.sms   && <span className="text-xs px-1.5 rounded" style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(40% 0.13 193)' }}>SMS</span>}
                          {n.capabilities.mms   && <span className="text-xs px-1.5 rounded" style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(40% 0.13 193)' }}>MMS</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => purchase(n)}
                      disabled={!!purchasing}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {purchasing === n.phoneNumber ? 'Buying…' : 'Get'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
