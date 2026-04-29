'use client'

import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'
import Link from 'next/link'

interface Tenant {
  id: string; slug: string; displayName: string; status: string
  registrationEmail: string; createdAt: string
  _count: { members: number; conversations: number }
}
interface ListResult { tenants: Tenant[]; total: number }

const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PAST_DUE: 'bg-orange-100 text-orange-800',
  CANCELED: 'bg-gray-100 text-gray-600',
}

export default function AdminTenantsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const { data, loading, error } = useApi<ListResult>(`/api/admin/tenants${query ? `?search=${encodeURIComponent(query)}` : ''}`, [query])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setQuery(search)
  }

  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
        <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, slug, or email…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900">Search</button>
      </form>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Status', 'Members', 'Conversations', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.tenants ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${t.id}`} className="font-medium text-blue-600 hover:underline">{t.displayName}</Link>
                    <div className="text-xs text-gray-400">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.registrationEmail}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t._count.members}</td>
                  <td className="px-4 py-3 text-gray-600">{t._count.conversations}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(data?.tenants ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No tenants found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
