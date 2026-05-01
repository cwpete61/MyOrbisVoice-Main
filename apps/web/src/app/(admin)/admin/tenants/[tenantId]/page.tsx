'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useApi, apiFetch, apiFetchRaw } from '@/hooks/useApi'
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

export default function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: tenant, loading, error, reload } = useApi<TenantDetail>(`/api/admin/tenants/${tenantId}`)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editName, setEditName] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [quotaOverrideGb, setQuotaOverrideGb] = useState('')
  const [tierSaving, setTierSaving] = useState(false)

  async function assignTier() {
    if (!selectedTier) return
    setTierSaving(true)
    try {
      const res = await apiFetchRaw(`/api/admin/tenants/${tenantId}/storage-tier`, {
        method: 'POST', body: JSON.stringify({ tier: selectedTier }),
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json() as { data?: { gracePeriod: boolean; graceEndsAt: string | null }; errors?: { message: string }[] }
      if (!res.ok) { setMessage(json.errors?.[0]?.message ?? 'Failed'); return }
      const { gracePeriod, graceEndsAt } = json.data!
      await reload()
      setMessage(gracePeriod
        ? `Tier set to ${selectedTier}. Downgrade detected — 30-day grace period active until ${new Date(graceEndsAt!).toLocaleDateString()}.`
        : `Tier ${selectedTier} applied immediately.`)
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setTierSaving(false) }
  }

  async function saveQuotaOverride() {
    setTierSaving(true)
    try {
      const res = await apiFetchRaw(`/api/admin/tenants/${tenantId}/storage-quota`, {
        method: 'PATCH', body: JSON.stringify({ quotaGb: quotaOverrideGb ? parseFloat(quotaOverrideGb) : null }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) { setMessage('Failed to save quota override'); return }
      await reload()
      setMessage('Quota override saved.')
      setQuotaOverrideGb('')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setTierSaving(false) }
  }

  async function suspend() {
    setSaving(true)
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/suspend`, { method: 'POST', body: '{}' })
      await reload()
      setMessage('Tenant suspended.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function restore() {
    setSaving(true)
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/restore`, { method: 'POST', body: '{}' })
      await reload()
      setMessage('Tenant restored.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function saveName() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify({ displayName: editName }) })
      await reload()
      setMessage('Updated.')
      setEditName('')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading…</div>
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>
  if (!tenant) return null

  const sub = tenant.subscriptions[0]

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/tenants" className="text-sm text-gray-500 hover:text-gray-900">← Tenants</Link>
        <h1 className="text-2xl font-semibold text-gray-900">{tenant.displayName}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : tenant.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {tenant.status}
        </span>
      </div>

      {message && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">{message}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Details</h2>
          {[
            ['Email', tenant.registrationEmail],
            ['Timezone', tenant.timezone],
            ['Plan', sub ? `${sub.plan.name} (${sub.status})` : 'No subscription'],
            ['Brand', tenant.businessProfile?.brandName ?? '—'],
            ['Created', new Date(tenant.createdAt).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-medium">{v}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 flex gap-2">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Rename tenant…"
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
            <button onClick={saveName} disabled={saving} className="px-3 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-900 disabled:opacity-50">Save</button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Activity</h2>
          {[
            ['Conversations', tenant._count.conversations],
            ['Appointments', tenant._count.appointments],
            ['Contacts', tenant._count.contacts],
            ['Members', tenant.members.length],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between text-sm py-1">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-semibold">{v}</span>
            </div>
          ))}
        </div>

        {/* Members */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Members</h2>
          <div className="space-y-2">
            {tenant.members.map((m) => (
              <div key={m.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{m.user.email}</span>
                <span className="text-gray-400">{m.roleDefinition.name}{m.isOwner ? ' (owner)' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Integrations</h2>
          {tenant.integrationConnections.length === 0
            ? <p className="text-sm text-gray-400">None configured</p>
            : tenant.integrationConnections.map((i) => (
              <div key={i.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-700">{i.provider}</span>
                <span className={i.status === 'CONNECTED' ? 'text-green-600' : 'text-red-500'}>{i.status}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Storage & Tier */}
      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Recording Storage</h2>

        {/* Current status */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tier', value: tenant.storageTier ?? 'Not assigned' },
            { label: 'Quota', value: tenant.storageQuotaBytes ? `${(Number(tenant.storageQuotaBytes) / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Default' },
            { label: 'Used', value: `${(Number(tenant.storageUsedBytes) / 1024 / 1024 / 1024).toFixed(2)} GB` },
            { label: 'Grace period', value: tenant.storageGracePeriodEndsAt ? `Until ${new Date(tenant.storageGracePeriodEndsAt).toLocaleDateString()}` : 'None' },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Usage bar */}
        {tenant.storageQuotaBytes && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Storage used</span>
              <span>{Math.min(100, Math.round(Number(tenant.storageUsedBytes) / Number(tenant.storageQuotaBytes) * 100))}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Number(tenant.storageUsedBytes) / Number(tenant.storageQuotaBytes) * 100)}%`,
                  background: Number(tenant.storageUsedBytes) / Number(tenant.storageQuotaBytes) >= 0.9 ? '#ef4444' : 'oklch(55% 0.11 193)',
                }}
              />
            </div>
          </div>
        )}

        {/* Assign tier */}
        <div className="flex items-end gap-3 pt-2 border-t border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Assign storage tier</label>
            <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">— Select tier —</option>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={assignTier} disabled={!selectedTier || tierSaving}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50">
            {tierSaving ? 'Applying…' : 'Apply tier'}
          </button>
        </div>

        {/* Manual quota override */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Manual quota override (GB) — overrides tier default</label>
            <input type="number" min="0.1" step="0.5" value={quotaOverrideGb}
              onChange={e => setQuotaOverrideGb(e.target.value)}
              placeholder="e.g. 25 — leave blank to clear override"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={saveQuotaOverride} disabled={tierSaving}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50">
            Save override
          </button>
        </div>
      </div>

      {/* Admin actions */}
      <div className="mt-6 flex gap-3">
        {tenant.status !== 'SUSPENDED' && (
          <button onClick={suspend} disabled={saving}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
            Suspend tenant
          </button>
        )}
        {tenant.status === 'SUSPENDED' && (
          <button onClick={restore} disabled={saving}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
            Restore tenant
          </button>
        )}
      </div>
    </div>
  )
}
