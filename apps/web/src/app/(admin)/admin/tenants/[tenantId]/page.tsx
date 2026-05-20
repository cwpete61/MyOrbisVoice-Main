'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useApi, apiFetch, apiFetchRaw } from '@/hooks/useApi'
import { setTokens } from '@/lib/auth'
import Link from 'next/link'

const TIERS = ['LTD', 'BASIC', 'ESSENTIALS', 'PREMIUM', 'ENTERPRISE'] as const

interface TenantDetail {
  id: string; displayName: string; legalName: string | null
  status: string; timezone: string; registrationEmail: string
  createdAt: string; updatedAt: string
  businessProfile: { brandName: string } | null
  members: { id: string; isOwner: boolean; user: { email: string; firstName: string | null; lastName: string | null }; roleDefinition: { name: string } }[]
  integrationConnections: { id: string; provider: string; status: string; label: string }[]
  subscriptions: { status: string; plan: { name: string } }[]
  _count: { conversations: number; appointments: number; contacts: number }
  storageTier: string | null
  storageQuotaBytes: string | null
  storageUsedBytes: string
  storageGracePeriodEndsAt: string | null
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  TRIAL:     { bg: 'oklch(14% 0.04 75)',  text: 'oklch(70% 0.16 75)'  },
  ACTIVE:    { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)' },
  SUSPENDED: { bg: 'oklch(13% 0.04 25)',  text: 'oklch(68% 0.20 25)'  },
  PAST_DUE:  { bg: 'oklch(14% 0.04 45)',  text: 'oklch(70% 0.18 45)'  },
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export default function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: tenant, loading, error, reload } = useApi<TenantDetail>(`/api/admin/tenants/${tenantId}`)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editName, setEditName]   = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [quotaGb, setQuotaGb]   = useState('')
  const [tierSaving, setTierSaving] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const router = useRouter()

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  async function assignTier() {
    if (!selectedTier) return
    setTierSaving(true)
    try {
      const res  = await apiFetchRaw(`/api/admin/tenants/${tenantId}/storage-tier`, {
        method: 'POST', body: JSON.stringify({ tier: selectedTier }),
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json() as { data?: { gracePeriod: boolean; graceEndsAt: string | null }; errors?: { message: string }[] }
      if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); return }
      await reload()
      const { gracePeriod, graceEndsAt } = json.data!
      showToast('success', gracePeriod
        ? `Tier ${selectedTier} applied — 30-day grace until ${new Date(graceEndsAt!).toLocaleDateString()}.`
        : `Tier ${selectedTier} applied.`)
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setTierSaving(false) }
  }

  async function saveQuotaOverride() {
    setTierSaving(true)
    try {
      const res = await apiFetchRaw(`/api/admin/tenants/${tenantId}/storage-quota`, {
        method: 'PATCH', body: JSON.stringify({ quotaGb: quotaGb ? parseFloat(quotaGb) : null }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) { showToast('error', 'Failed to save quota override'); return }
      await reload(); setQuotaGb('')
      showToast('success', 'Quota override saved.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setTierSaving(false) }
  }

  async function suspend() {
    setSaving(true)
    try { await apiFetch(`/api/admin/tenants/${tenantId}/suspend`, { method: 'POST', body: '{}' }); await reload(); showToast('success', 'Tenant suspended.') }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function restore() {
    setSaving(true)
    try { await apiFetch(`/api/admin/tenants/${tenantId}/restore`, { method: 'POST', body: '{}' }); await reload(); showToast('success', 'Tenant restored.') }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  const [grantPlanCode, setGrantPlanCode] = useState('')
  const [grantSaving, setGrantSaving]     = useState(false)
  async function grantPlan() {
    if (!grantPlanCode) return
    setGrantSaving(true)
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/grant-plan`, { method: 'POST', body: JSON.stringify({ planCode: grantPlanCode }) })
      await reload()
      showToast('success', `Plan '${grantPlanCode}' granted (Stripe bypassed).`)
      setGrantPlanCode('')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Grant failed') }
    finally { setGrantSaving(false) }
  }
  async function revokePlan() {
    if (!confirm('Revoke admin-granted plan and reset entitlements to Free? Real Stripe subscriptions are not affected.')) return
    setGrantSaving(true)
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/revoke-plan`, { method: 'POST', body: '{}' })
      await reload()
      showToast('success', 'Admin grant revoked. Entitlements reset to Free tier.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Revoke failed') }
    finally { setGrantSaving(false) }
  }

  async function enterAsTenant() {
    setImpersonating(true)
    try {
      const res = await apiFetchRaw(`/api/admin/tenants/${tenantId}/impersonate`, { method: 'POST', body: '{}' })
      const json = await res.json() as { data?: { token: string; sessionId: string; tenantName: string }; errors?: { message: string }[] }
      if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); return }
      const { token, sessionId, tenantName } = json.data!
      // Preserve admin token first, then swap to impersonation token
      const adminToken = localStorage.getItem('va_access_token') ?? ''
      sessionStorage.setItem('impersonation_admin_token', adminToken)
      sessionStorage.setItem('impersonation_session_id', sessionId)
      sessionStorage.setItem('impersonation_tenant_name', tenantName)
      setTokens(token, null)
      router.push('/dashboard')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setImpersonating(false) }
  }

  async function saveName() {
    if (!editName.trim()) return
    setSaving(true)
    try { await apiFetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify({ displayName: editName }) }); await reload(); setEditName(''); showToast('success', 'Name updated.') }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />)}
      </div>
    </div>
  )
  if (error) return <div className="alert-error">{error}</div>
  if (!tenant) return null

  const sub    = tenant.subscriptions[0]
  const status = STATUS_STYLE[tenant.status] ?? STATUS_STYLE.TRIAL!
  const usedBytes  = Number(tenant.storageUsedBytes)
  const quotaBytes = tenant.storageQuotaBytes ? Number(tenant.storageQuotaBytes) : null
  const storagePct = quotaBytes ? Math.min(100, Math.round(usedBytes / quotaBytes * 100)) : 0

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/tenants" className="text-sm hover:underline" style={{ color: 'var(--text-tertiary)' }}>← Tenants</Link>
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{tenant.displayName}</h1>
          <span className="badge" style={{ background: status.bg, color: status.text }}>{tenant.status}</span>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="impersonate-btn"
            onClick={enterAsTenant}
            disabled={impersonating || tenant.status === 'SUSPENDED'}
            className="btn-ghost text-xs"
            title="Enter this tenant's dashboard as support mode"
          >
            {impersonating ? 'Entering…' : 'Enter as tenant →'}
          </button>
          {tenant.status !== 'SUSPENDED' ? (
            <button onClick={suspend} disabled={saving} className="btn-danger text-xs">{saving ? 'Working…' : 'Suspend'}</button>
          ) : (
            <button onClick={restore} disabled={saving} className="btn-primary text-xs">{saving ? 'Working…' : 'Restore'}</button>
          )}
        </div>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Details */}
        <Card title="Details">
          <dl className="space-y-2.5">
            {[
              ['Email',    tenant.registrationEmail],
              ['Timezone', tenant.timezone],
              ['Plan',     sub ? `${sub.plan.name} (${sub.status})` : 'No subscription'],
              ['Brand',    tenant.businessProfile?.brandName ?? '—'],
              ['Created',  new Date(tenant.createdAt).toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{k}</dt>
                <dd className="text-xs font-medium text-right" style={{ color: 'var(--text-primary)' }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Rename tenant…"
              className="input flex-1 text-xs"
            />
            <button onClick={saveName} disabled={saving || !editName.trim()} className="btn-ghost text-xs">
              Rename
            </button>
          </div>
        </Card>

        {/* Plan / Tier — Admin Grant (bypasses Stripe) */}
        <Card title="Plan / Tier (Admin Grant — Bypasses Stripe)">
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Grant this tenant any tier&apos;s entitlements without going through Stripe checkout. Real Stripe subscriptions are NOT affected.
            Use for internal feature testing only — every grant is audit-logged.
          </p>
          <div className="flex gap-2 mb-3">
            <select
              value={grantPlanCode}
              onChange={(e) => setGrantPlanCode(e.target.value)}
              className="input flex-1 text-xs"
            >
              <option value="">Select a plan to grant…</option>
              <option value="free">Free</option>
              <option value="basic_monthly">Basic ($197/mo)</option>
              <option value="pro_monthly">Pro ($497/mo)</option>
              <option value="premier_monthly">Premier ($997/mo)</option>
              <option value="enterprise_monthly">Enterprise ($1,997/mo)</option>
              <option value="ltd">LTD ($497 lifetime)</option>
            </select>
            <button
              onClick={grantPlan}
              disabled={grantSaving || !grantPlanCode}
              className="btn-primary text-xs"
            >
              {grantSaving ? 'Working…' : 'Grant'}
            </button>
          </div>
          <button
            onClick={revokePlan}
            disabled={grantSaving}
            className="btn-ghost text-xs w-full"
            style={{ borderColor: 'oklch(55% 0.14 25 / 0.4)', color: 'oklch(60% 0.18 25)' }}
          >
            Revoke admin grant → reset to Free tier
          </button>
        </Card>

        {/* Activity */}
        <Card title="Activity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Conversations', value: tenant._count.conversations },
              { label: 'Appointments',  value: tenant._count.appointments },
              { label: 'Contacts',      value: tenant._count.contacts },
              { label: 'Members',       value: tenant.members.length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-overlay)' }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Members */}
        <Card title="Members">
          {tenant.members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No members</p>
          ) : (
            <div className="space-y-2">
              {tenant.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{m.user.email}</p>
                    {(m.user.firstName || m.user.lastName) && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {[m.user.firstName, m.user.lastName].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                  <span className="badge text-xs" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                    {m.roleDefinition.name}{m.isOwner ? ' · owner' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Integrations */}
        <Card title="Integrations">
          {tenant.integrationConnections.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>None configured</p>
          ) : (
            <div className="space-y-2">
              {tenant.integrationConnections.map((i) => (
                <div key={i.id} className="flex items-center justify-between">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{i.provider}</p>
                  <span
                    className="badge"
                    style={i.status === 'CONNECTED'
                      ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                      : { background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }
                    }
                  >{i.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Storage */}
      <Card title="Recording Storage">
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tier',    value: tenant.storageTier ?? 'Not assigned' },
              { label: 'Quota',   value: quotaBytes ? `${(quotaBytes / 1024 ** 3).toFixed(1)} GB` : 'Default' },
              { label: 'Used',    value: `${(usedBytes / 1024 ** 3).toFixed(2)} GB` },
              { label: 'Grace',   value: tenant.storageGracePeriodEndsAt ? `Until ${new Date(tenant.storageGracePeriodEndsAt).toLocaleDateString()}` : 'None' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-overlay)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          {quotaBytes && (
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                <span>Usage</span><span>{storagePct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'var(--border-subtle)' }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${storagePct}%`,
                    background: storagePct >= 90 ? '#ef4444' : 'oklch(55% 0.14 193)',
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <label className="label">Assign storage tier</label>
              <select className="input" value={selectedTier} onChange={e => setSelectedTier(e.target.value)}>
                <option value="">— Select tier —</option>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={assignTier} disabled={!selectedTier || tierSaving} className="btn-primary mt-2 text-xs">
                {tierSaving ? 'Applying…' : 'Apply tier'}
              </button>
            </div>
            <div>
              <label className="label">Manual quota override (GB)</label>
              <input
                type="number" min="0.1" step="0.5"
                className="input"
                value={quotaGb}
                onChange={e => setQuotaGb(e.target.value)}
                placeholder="e.g. 25 — blank to clear"
              />
              <button onClick={saveQuotaOverride} disabled={tierSaving} className="btn-ghost mt-2 text-xs">
                Save override
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
