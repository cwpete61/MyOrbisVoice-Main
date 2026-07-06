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
import { NumberSearch, type SearchResult, type SearchFilters } from '@/components/numbers/NumberSearch'

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

type NumberSyncStatus = 'IN_SYNC' | 'GHOST' | 'MISPLACED' | 'WEBHOOK_DRIFT' | 'CAP_DRIFT'

interface NumberSync {
  status:           NumberSyncStatus
  issues:           string[]
  liveAccountSid:   string | null
  liveAccountLabel: string | null
  liveVoiceUrl:     string | null
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
  sync:                NumberSync | null
}

interface OrphanNumber {
  twilioNumberSid: string
  e164Number:      string
  accountSid:      string
  ownerLabel:      string | null
  friendlyName:    string | null
  voiceUrl:        string | null
  capabilities:    { voice: boolean; sms: boolean; mms: boolean }
}

interface SyncSummary {
  total:        number
  inSync:       number
  ghost:        number
  misplaced:    number
  webhookDrift: number
  capDrift:     number
  orphans:      number
}

interface InventoryResponse {
  platform:    PlatformNumber[]
  tenants:     TenantNumber[]
  orphans:     OrphanNumber[]
  syncSummary: SyncSummary
  syncError:   string | null
  checkedAt:   string
}

interface DestinationsResponse {
  master:      { accountSid: string; label: string }
  subaccounts: { accountSid: string; tenantId: string; label: string }[]
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

const SYNC_META: Record<NumberSyncStatus, { label: string; bg: string; fg: string }> = {
  IN_SYNC:       { label: 'In sync',       bg: 'oklch(95% 0.05 145)', fg: 'oklch(35% 0.16 145)' },
  GHOST:         { label: 'Ghost',         bg: 'oklch(95% 0.05 25)',  fg: 'oklch(40% 0.18 25)'  },
  MISPLACED:     { label: 'Misplaced',     bg: 'oklch(96% 0.05 55)',  fg: 'oklch(40% 0.16 55)'  },
  WEBHOOK_DRIFT: { label: 'Webhook drift', bg: 'oklch(96% 0.05 75)',  fg: 'oklch(38% 0.16 75)'  },
  CAP_DRIFT:     { label: 'Cap drift',     bg: 'oklch(96% 0.05 300)', fg: 'oklch(40% 0.16 300)' },
}

function SyncBadge({ sync }: { sync: NumberSync | null }) {
  if (!sync) {
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>Unchecked</span>
  }
  const m = SYNC_META[sync.status]
  const title = sync.issues.length ? sync.issues.join('\n') : 'Matches Twilio: exists, right account, webhook wired, capabilities agree.'
  return (
    <span title={title} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-help" style={{ background: m.bg, color: m.fg }}>
      {sync.status === 'IN_SYNC' ? '✓' : '⚠'} {m.label}
    </span>
  )
}

interface ReassignTarget {
  sid:         string
  phoneNumber: string
  currentAccountSid: string
}

function ReassignModal({
  target, destinations, onClose, onDone,
}: {
  target:       ReassignTarget
  destinations: DestinationsResponse
  onClose:      () => void
  onDone:       (msg: string) => void
}) {
  const [targetAccountSid, setTargetAccountSid] = useState('')
  const [confirmText, setConfirmText]           = useState('')
  const [busy, setBusy]                         = useState(false)
  const [error, setError]                       = useState('')

  const options = [
    { accountSid: destinations.master.accountSid, tenantId: undefined as string | undefined, label: destinations.master.label, isMaster: true },
    ...destinations.subaccounts.map(s => ({ accountSid: s.accountSid, tenantId: s.tenantId, label: s.label, isMaster: false })),
  ].filter(o => o.accountSid !== target.currentAccountSid)

  const targetTenantId = options.find(o => o.accountSid === targetAccountSid)?.tenantId

  async function submit() {
    setError('')
    if (!targetAccountSid) { setError('Pick a destination'); return }
    if (confirmText !== target.phoneNumber) { setError('Type the full phone number to confirm'); return }
    setBusy(true)
    try {
      await apiFetch(`/api/admin/phone-numbers/${target.sid}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ targetAccountSid, targetTenantId, confirmPhoneNumber: target.phoneNumber }),
      })
      const destLabel = options.find(o => o.accountSid === targetAccountSid)?.label ?? targetAccountSid
      onDone(`✓ Moved ${target.phoneNumber} → ${destLabel}. A2P throughput on the destination resets to default until that account has its own A2P registration.`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Reassign {target.phoneNumber}</h3>
        <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
          Currently on <span className="font-mono">{target.currentAccountSid.slice(0, 14)}…</span>
        </p>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Move to</label>
        <select value={targetAccountSid} onChange={e => setTargetAccountSid(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm mb-4"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
          <option value="">— Select destination —</option>
          {options.map(o => (
            <option key={o.accountSid} value={o.accountSid}>
              {o.isMaster ? '🌐 ' : '🏢 '}{o.label}
            </option>
          ))}
        </select>

        <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'oklch(96% 0.05 75)', color: 'oklch(35% 0.16 75)' }}>
          <strong>⚠ Footguns to know:</strong>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>A2P 10DLC throughput on the destination resets to default until that account has its own A2P registration</li>
            <li>Active calls / SMS aren't disrupted</li>
            <li>Pending scheduled SMS on the source account will fail</li>
            <li>Webhook URLs transfer with the number</li>
            <li>Messaging Service / SIP Trunk / Verify bindings are cleared</li>
          </ul>
        </div>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Type <code className="font-mono">{target.phoneNumber}</code> to confirm
        </label>
        <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
          placeholder={target.phoneNumber}
          className="w-full px-3 py-2 rounded-lg text-sm font-mono mb-4"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />

        {error && <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>{error}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !targetAccountSid || confirmText !== target.phoneNumber}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'oklch(55% 0.11 193)', color: 'white', opacity: busy || !targetAccountSid || confirmText !== target.phoneNumber ? 0.5 : 1 }}>
            {busy ? 'Moving…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPhoneNumbersPage() {
  const { data, loading, error, reload } = useApi<InventoryResponse>('/api/admin/phone-numbers')
  const { data: destinations }            = useApi<DestinationsResponse>('/api/admin/phone-numbers/destinations')
  const [searchOpen, setSearchOpen]       = useState(false)
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null)
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget | null>(null)
  const [message, setMessage]             = useState('')
  const [refreshing, setRefreshing]       = useState(false)
  const [confirmPurge, setConfirmPurge]   = useState<string | null>(null)

  // Backend wrappers passed into NumberSearch
  async function searchBackend(filters: SearchFilters): Promise<SearchResult[]> {
    return apiFetch<SearchResult[]>('/api/admin/phone-numbers/search', {
      method: 'POST',
      body: JSON.stringify({
        areaCode: filters.areaCode || undefined,
        pattern:  filters.pattern  || undefined,
        country:  filters.country,
        limit:    filters.limit,
      }),
    })
  }

  async function purchaseBackend(phoneNumber: string): Promise<{ phoneNumber: string }> {
    return apiFetch<{ phoneNumber: string }>('/api/admin/phone-numbers/purchase', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    })
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

  async function purgeGhost(id: string, phoneNumber: string) {
    if (confirmPurge !== id) {
      setConfirmPurge(id)
      setTimeout(() => setConfirmPurge(prev => prev === id ? null : prev), 5000)
      return
    }
    setMessage('')
    try {
      await apiFetch(`/api/admin/phone-numbers/tenant-row/${id}/purge`, { method: 'POST' })
      setMessage(`✓ Purged stale row ${phoneNumber}. Nothing was released at Twilio — the number wasn't there.`)
      setConfirmPurge(null)
      reload()
    } catch (e) {
      setMessage((e as Error).message)
      setConfirmPurge(null)
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
  if (error)   return <div className="p-8 text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</div>
  if (!data)   return null

  return (
    <div className="space-y-8">
      {reassignTarget && destinations && (
        <ReassignModal
          target={reassignTarget}
          destinations={destinations}
          onClose={() => setReassignTarget(null)}
          onDone={(msg) => { setMessage(msg); setReassignTarget(null); reload() }}
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Phone numbers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Every number across the platform — master-account (platform-owned) and subaccount (tenant-assigned). Reconciled live against Twilio (master + every subaccount) and cross-referenced with the local DB.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Last checked {new Date(data.checkedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={async () => { setRefreshing(true); try { await reload() } finally { setRefreshing(false) } }}
          disabled={refreshing}
          className="shrink-0 text-sm px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', opacity: refreshing ? 0.6 : 1 }}
        >
          {refreshing ? 'Checking Twilio…' : '↻ Refresh'}
        </button>
      </div>

      {/* Reconcile summary banner */}
      {data.syncError ? (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(40% 0.18 25)' }}>
          ⚠ Live Twilio reconcile failed — tenant-assigned rows below are shown from the DB but could NOT be verified against Twilio. {data.syncError}
        </div>
      ) : (() => {
        const s = data.syncSummary
        const drift = s.ghost + s.misplaced + s.webhookDrift + s.capDrift
        const clean = drift === 0 && s.orphans === 0
        return (
          <div className="rounded-lg p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1" style={{
            background: clean ? 'oklch(96% 0.05 145)' : 'oklch(96% 0.05 75)',
            color:      clean ? 'oklch(35% 0.16 145)' : 'oklch(38% 0.16 75)',
          }}>
            <span className="font-semibold">
              {clean ? `✓ All ${s.total} tenant numbers match Twilio` : `⚠ ${drift + s.orphans} issue${drift + s.orphans === 1 ? '' : 's'} across ${s.total} tenant numbers`}
            </span>
            {s.ghost       > 0 && <span>Ghost: <strong>{s.ghost}</strong></span>}
            {s.misplaced   > 0 && <span>Misplaced: <strong>{s.misplaced}</strong></span>}
            {s.webhookDrift > 0 && <span>Webhook drift: <strong>{s.webhookDrift}</strong></span>}
            {s.capDrift    > 0 && <span>Cap drift: <strong>{s.capDrift}</strong></span>}
            {s.orphans     > 0 && <span>Untracked on Twilio: <strong>{s.orphans}</strong></span>}
          </div>
        )
      })()}

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
          <div className="mb-4">
            <NumberSearch
              search={searchBackend}
              purchase={purchaseBackend}
              shortlistKey="admin"
              onPurchase={(phone) => {
                setMessage(`✓ Purchased ${phone}. Check Twilio Console for any extra config (webhooks, A2P linking).`)
                reload()
              }}
            />
          </div>
        )}

        {data.platform.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            No platform-owned numbers yet. Click "Get a new number" above to search Twilio inventory and purchase one.
          </div>
        ) : (
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
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
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setReassignTarget({ sid: n.sid, phoneNumber: n.phoneNumber, currentAccountSid: n.accountSid })}
                          className="text-xs px-2.5 py-1 rounded font-medium"
                          style={{ background: 'transparent', color: 'oklch(55% 0.11 193)', border: '1px solid oklch(55% 0.11 193)' }}>
                          Reassign
                        </button>
                        <button onClick={() => release(n.sid, n.phoneNumber)}
                          className="text-xs px-2.5 py-1 rounded font-medium"
                          style={{
                            background: confirmRelease === n.sid ? 'oklch(55% 0.18 25)' : 'transparent',
                            color:      confirmRelease === n.sid ? 'white' : 'oklch(55% 0.18 25)',
                            border:     '1px solid oklch(55% 0.18 25)',
                          }}>
                          {confirmRelease === n.sid ? 'Click again to confirm' : 'Release'}
                        </button>
                      </div>
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
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-raised)' }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Number</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Tenant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Subaccount</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Capabilities</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Twilio sync</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Forwarding</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}></th>
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
                    <td className="px-4 py-2.5 text-xs">
                      {/* Live Twilio account the number ACTUALLY lives on (matched
                          during reconcile), with the SID underneath. */}
                      <span style={{ color: 'var(--text-primary)' }}>{n.sync?.liveAccountLabel ?? '—'}</span>
                      <span className="block font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {(n.sync?.liveAccountSid ?? n.twilioSubaccountSid)?.slice(0, 14) ?? '—'}…
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <CapBadge on={n.isInboundEnabled}  label="Inbound" />
                        <CapBadge on={n.isOutboundEnabled} label="Outbound" />
                        <CapBadge on={n.isSmsEnabled}      label="SMS" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <SyncBadge sync={n.sync} />
                      {n.sync && n.sync.issues.length > 0 && (
                        <div className="mt-1 text-[11px] leading-snug max-w-[260px]" style={{ color: 'var(--text-tertiary)' }}>{n.sync.issues[0]}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{n.forwardingTarget ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {n.sync?.status === 'GHOST' ? (
                        <button onClick={() => purgeGhost(n.id, n.phoneNumber)}
                          title="Delete this stale DB row. Nothing is released at Twilio — the number isn't there."
                          className="text-xs px-2.5 py-1 rounded font-medium"
                          style={{
                            background: confirmPurge === n.id ? 'oklch(55% 0.18 25)' : 'transparent',
                            color:      confirmPurge === n.id ? 'white' : 'oklch(55% 0.18 25)',
                            border:     '1px solid oklch(55% 0.18 25)',
                          }}>
                          {confirmPurge === n.id ? 'Click again to purge' : 'Purge'}
                        </button>
                      ) : n.twilioNumberSid && n.twilioSubaccountSid ? (
                        <button onClick={() => setReassignTarget({
                          sid: n.twilioNumberSid!,
                          phoneNumber: n.phoneNumber,
                          currentAccountSid: n.twilioSubaccountSid!,
                        })}
                          className="text-xs px-2.5 py-1 rounded font-medium"
                          style={{ background: 'transparent', color: 'oklch(55% 0.11 193)', border: '1px solid oklch(55% 0.11 193)' }}>
                          Reassign
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orphans — live on a Twilio subaccount but no DB row */}
      {data.orphans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'oklch(40% 0.18 25)' }}>
            Untracked on Twilio ({data.orphans.length})
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Twilio reports these numbers on a subaccount, but the app has no record of them. They still bill and may take calls the platform can't see. Adopt or release them from the Twilio Console (auto-adopt not enabled here).
          </p>
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid oklch(85% 0.08 25)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'oklch(97% 0.03 25)' }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Number</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Twilio account</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Capabilities</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Voice webhook</th>
                </tr>
              </thead>
              <tbody>
                {data.orphans.map((o, i) => (
                  <tr key={o.twilioNumberSid} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {o.e164Number}
                      {o.friendlyName && <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>· {o.friendlyName}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {o.ownerLabel ?? '—'}
                      <span className="block font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{o.accountSid.slice(0, 14)}…</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <CapBadge on={o.capabilities.voice} label="V" />
                        <CapBadge on={o.capabilities.sms}   label="S" />
                        <CapBadge on={o.capabilities.mms}   label="M" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono truncate max-w-[240px]" style={{ color: 'var(--text-tertiary)' }}>{o.voiceUrl ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
