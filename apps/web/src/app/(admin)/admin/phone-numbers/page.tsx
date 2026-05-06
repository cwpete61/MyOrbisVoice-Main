'use client'

/**
 * Admin phone-numbers dashboard.
 *
 * Live-proxies the Twilio master account inventory and combines it with
 * tenant-assigned numbers from our DB to give a single platform-wide view.
 *
 * Two sources:
 *   1. Twilio master `incomingPhoneNumbers.list()` — numbers still on master
 *      (platform-owned: ops, support, A2P testing). Source of truth for
 *      these is Twilio itself; we don't mirror to DB.
 *   2. Our DB `PhoneNumber` table — numbers that have been transferred to a
 *      tenant subaccount. Each row carries its tenant assignment.
 *
 * Combined view shows: which numbers we own, which are platform-only, which
 * belong to which tenant. Admin can search Twilio inventory + buy new
 * platform numbers from this page.
 */

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface PlatformNumber {
  sid:          string
  phoneNumber:  string
  friendlyName: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
  dateCreated:  string | null
  accountSid:   string
  voiceUrl:     string | null
  smsUrl:       string | null
}

interface TenantNumber {
  id:                  string
  phoneNumber:         string
  twilioNumberSid:     string | null
  twilioSubaccountSid: string | null
  tenantId:            string
  tenantName:          string | null
  displayLabel:        string | null
  monthlyPriceCents:   number | null
  isInboundEnabled:    boolean
  isOutboundEnabled:   boolean
  isSmsEnabled:        boolean
  forwardingTarget:    string | null
}

interface InventoryResponse {
  platform: PlatformNumber[]
  tenants:  TenantNumber[]
}

interface SearchResult {
  phoneNumber:       string
  friendlyName:      string
  locality:          string | null
  region:            string | null
  capabilities:      { voice: boolean; sms: boolean; mms: boolean }
  monthlyPriceCents: number
}

function CapBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
      background: on ? 'oklch(95% 0.05 145)' : 'var(--surface-overlay)',
      color:      on ? 'oklch(35% 0.16 145)' : 'var(--text-tertiary)',
    }}>{label}</span>
  )
}

function fmtMoney(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}/mo`
}

export default function AdminPhoneNumbersPage() {
  const { data, loading, error, reload } = useApi<InventoryResponse>('/api/admin/phone-numbers')
  const [searchOpen, setSearchOpen]       = useState(false)
  const [areaCode, setAreaCode]           = useState('')
  const [pattern, setPattern]             = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching]         = useState(false)
  const [purchasing, setPurchasing]       = useState<string | null>(null)
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null)
  const [message, setMessage]             = useState('')

  async function search() {
    setSearching(true)
    setMessage('')
    try {
      const result = await apiFetch<SearchResult[]>('/api/admin/phone-numbers/search', {
        method: 'POST',
        body: JSON.stringify({ areaCode: areaCode || undefined, pattern: pattern || undefined }),
      })
      setSearchResults(result)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  async function purchase(num: SearchResult) {
    if (!confirm(`Purchase ${num.phoneNumber} for $${(num.monthlyPriceCents / 100).toFixed(2)}/mo? This is a recurring charge on the platform's master Twilio account.`)) return
    setPurchasing(num.phoneNumber)
    setMessage('')
    try {
      await apiFetch('/api/admin/phone-numbers/purchase', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: num.phoneNumber }),
      })
      setMessage(`✓ Purchased ${num.phoneNumber}. Check Twilio Console for any extra config (webhooks, A2P linking).`)
      setSearchResults(searchResults.filter(r => r.phoneNumber !== num.phoneNumber))
      reload()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setPurchasing(null)
    }
  }

  async function release(sid: string, phoneNumber: string) {
    if (confirmRelease !== sid) {
      setConfirmRelease(sid)
      setTimeout(() => setConfirmRelease(prev => prev === sid ? null : prev), 5000)
      return
    }
    setMessage('')
    try {
      await apiFetch(`/api/admin/phone-numbers/${sid}`, { method: 'DELETE' })
      setMessage(`✓ Released ${phoneNumber}. Number returned to Twilio inventory.`)
      setConfirmRelease(null)
      reload()
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
  if (error)   return <div className="p-8 text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</div>
  if (!data)   return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Phone numbers</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Every number across the platform — master-account (platform-owned) and subaccount (tenant-assigned). Live-proxied from Twilio + cross-referenced with the local DB.
        </p>
      </div>

      {message && (
        <div className="rounded-lg p-3 text-sm" style={{
          background: message.startsWith('✓') ? 'oklch(96% 0.05 145)' : 'oklch(95% 0.05 25)',
          color:      message.startsWith('✓') ? 'oklch(35% 0.16 145)' : 'oklch(35% 0.18 25)',
        }}>{message}</div>
      )}

      {/* Platform-owned numbers */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Platform-owned ({data.platform.length})
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              On the master Twilio account. Used for ops, A2P testing, support lines.
            </p>
          </div>
          <button
            onClick={() => setSearchOpen(s => !s)}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}
          >
            {searchOpen ? 'Close search' : '+ Get a new number'}
          </button>
        </div>

        {searchOpen && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Area code</label>
                <input value={areaCode} onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="610" className="px-3 py-1.5 rounded-lg text-sm w-24"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Pattern (optional)</label>
                <input value={pattern} onChange={e => setPattern(e.target.value)}
                  placeholder="6105" className="px-3 py-1.5 rounded-lg text-sm w-40"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <button onClick={search} disabled={searching}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}>
                {searching ? 'Searching…' : 'Search Twilio inventory'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map(num => (
                  <div key={num.phoneNumber} className="flex items-center justify-between rounded-lg p-3"
                    style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{num.phoneNumber}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {num.locality || num.region || 'US'} · {fmtMoney(num.monthlyPriceCents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CapBadge on={num.capabilities.voice} label="Voice" />
                      <CapBadge on={num.capabilities.sms}   label="SMS" />
                      <CapBadge on={num.capabilities.mms}   label="MMS" />
                      <button
                        onClick={() => purchase(num)}
                        disabled={purchasing === num.phoneNumber}
                        className="ml-3 text-xs px-3 py-1 rounded-lg font-semibold"
                        style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}
                      >
                        {purchasing === num.phoneNumber ? 'Buying…' : 'Buy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data.platform.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            No platform-owned numbers yet. Click "Get a new number" above to search Twilio inventory and purchase one.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-raised)' }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Number</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Label</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Capabilities</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Created</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {data.platform.map((n, i) => (
                  <tr key={n.sid} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{n.phoneNumber}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{n.friendlyName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <CapBadge on={n.capabilities.voice} label="V" />
                        <CapBadge on={n.capabilities.sms}   label="S" />
                        <CapBadge on={n.capabilities.mms}   label="M" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{n.dateCreated ? new Date(n.dateCreated).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => release(n.sid, n.phoneNumber)}
                        className="text-xs px-2.5 py-1 rounded font-medium"
                        style={{
                          background: confirmRelease === n.sid ? 'oklch(55% 0.18 25)' : 'transparent',
                          color:      confirmRelease === n.sid ? 'white' : 'oklch(55% 0.18 25)',
                          border:     '1px solid oklch(55% 0.18 25)',
                        }}>
                        {confirmRelease === n.sid ? 'Click again to confirm' : 'Release'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tenant-assigned numbers */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Tenant-assigned ({data.tenants.length})
        </h2>
        {data.tenants.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            No numbers have been transferred to tenant subaccounts yet.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-raised)' }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Number</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Tenant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Subaccount</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Capabilities</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Forwarding</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((n, i) => (
                  <tr key={n.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {n.phoneNumber}
                      {n.displayLabel && <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>· {n.displayLabel}</span>}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                      {n.tenantName ?? '—'}
                      <span className="block text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{n.tenantId.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{n.twilioSubaccountSid?.slice(0, 14) ?? '—'}…</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <CapBadge on={n.isInboundEnabled}  label="Inbound" />
                        <CapBadge on={n.isOutboundEnabled} label="Outbound" />
                        <CapBadge on={n.isSmsEnabled}      label="SMS" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{n.forwardingTarget ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
