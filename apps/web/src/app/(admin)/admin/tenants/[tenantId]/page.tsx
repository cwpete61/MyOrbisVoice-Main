'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'
import Link from 'next/link'

interface TenantDetail {
  id: string; displayName: string; legalName: string | null
  status: string; timezone: string; registrationEmail: string
  createdAt: string; updatedAt: string
  businessProfile: { brandName: string } | null
  members: { id: string; isOwner: boolean; user: { email: string; firstName: string | null; lastName: string | null }; roleDefinition: { name: string } }[]
  integrationConnections: { id: string; provider: string; status: string; label: string }[]
  subscriptions: { status: string; plan: { name: string } }[]
  _count: { conversations: number; appointments: number; contacts: number }
}

export default function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: tenant, loading, error, reload } = useApi<TenantDetail>(`/api/admin/tenants/${tenantId}`)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editName, setEditName] = useState('')

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
