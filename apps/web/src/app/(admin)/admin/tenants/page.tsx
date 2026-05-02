'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import Link from 'next/link'

interface Tenant {
  id: string; slug: string; displayName: string; status: string
  registrationEmail: string; createdAt: string
  _count: { members: number; conversations: number }
}
interface ListResult { items: Tenant[]; total: number }

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  TRIAL:     { bg: 'oklch(14% 0.04 75)',  text: 'oklch(70% 0.16 75)'  },
  ACTIVE:    { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)' },
  SUSPENDED: { bg: 'oklch(13% 0.04 25)',  text: 'oklch(68% 0.20 25)'  },
  PAST_DUE:  { bg: 'oklch(14% 0.04 45)',  text: 'oklch(70% 0.18 45)'  },
  CANCELED:  { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
}

export default function AdminTenantsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery]   = useState('')
  const { data, loading, error } = useApi<ListResult>(
    `/api/admin/tenants${query ? `?search=${encodeURIComponent(query)}` : ''}`,
    [query]
  )

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setQuery(search) }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Tenants</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data ? `${data.total} total workspace${data.total !== 1 ? 's' : ''}` : 'All registered workspaces'}
          </p>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, slug, or email…"
          className="input max-w-sm"
        />
        <button type="submit" className="btn-ghost">Search</button>
        {query && (
          <button type="button" onClick={() => { setSearch(''); setQuery('') }} className="btn-ghost">Clear</button>
        )}
      </form>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Workspace', 'Email', 'Status', 'Members', 'Conversations', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((t, i) => {
                const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.TRIAL!
                return (
                  <tr
                    key={t.id}
                    style={{ borderBottom: i < (data?.items.length ?? 0) - 1 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--surface-raised)' }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium hover:underline" style={{ color: 'oklch(72% 0.12 193)' }}>
                        {t.displayName}
                      </Link>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{t.registrationEmail}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={{ background: s.bg, color: s.text }}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t._count.members}</td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t._count.conversations}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
              {(data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
