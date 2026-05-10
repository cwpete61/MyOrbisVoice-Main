'use client'

import { useState, useMemo } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'
import { isPlatformSuperAdmin } from '@/lib/auth'
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
  const { data, loading, error, reload } = useApi<ListResult>(
    `/api/admin/tenants${query ? `?search=${encodeURIComponent(query)}` : ''}`,
    [query]
  )

  // Selection state — Set of tenant IDs the admin has checked.
  // Cleared on any list reload (post-delete) so stale IDs don't linger.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const items = data?.items ?? []
  const allSelected = items.length > 0 && items.every(t => selected.has(t.id))
  const partialSelected = !allSelected && items.some(t => selected.has(t.id))
  const selectedCount = selected.size

  // Only Super Admin can hard-delete tenants. Lesser admins can suspend
  // (existing /tenants/[id] page) but never destroy.
  const canDelete = useMemo(() => isPlatformSuperAdmin(), [])

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setQuery(search) }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => {
      if (items.every(t => prev.has(t.id))) {
        // All visible rows selected → clear them
        const next = new Set(prev)
        for (const t of items) next.delete(t.id)
        return next
      }
      // Add every visible row to the selection
      const next = new Set(prev)
      for (const t of items) next.add(t.id)
      return next
    })
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  async function executeDelete() {
    setDeleting(true)
    try {
      const result = await apiFetch<{ deletedCount: number; deletedIds: string[] }>('/api/admin/tenants/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      setSelected(new Set())
      setConfirmOpen(false)
      setConfirmText('')
      showToast('success', `Deleted ${result.deletedCount} tenant${result.deletedCount !== 1 ? 's' : ''}.`)
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Bulk delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  // Tenants in the current page that are still selected — used by the modal
  // to render the "you are about to wipe these specific rows" list.
  const selectedTenants = items.filter(t => selected.has(t.id))

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
      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

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
                {canDelete && (
                  <th className="px-4 py-3 text-left" style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = partialSelected }}
                      onChange={toggleAll}
                      aria-label="Select all tenants on this page"
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                )}
                {['Workspace', 'Email', 'Status', 'Members', 'Conversations', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => {
                const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.TRIAL!
                const isSelected = selected.has(t.id)
                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      background: isSelected ? 'var(--surface-overlay)' : 'var(--surface-raised)',
                    }}
                  >
                    {canDelete && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(t.id)}
                          aria-label={`Select ${t.displayName}`}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
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
              {items.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating action bar — only when ≥1 selected */}
      {canDelete && selectedCount > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full px-5 py-3 shadow-2xl"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selectedCount} selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: 'oklch(55% 0.20 25)', color: '#fff' }}
          >
            Delete {selectedCount}…
          </button>
        </div>
      )}

      {/* Confirmation modal — type-DELETE-to-enable */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !deleting && setConfirmText('') /* clicking backdrop does NOT close while there's input */}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--surface-raised)', border: '1px solid oklch(55% 0.20 25 / 0.40)' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'oklch(60% 0.20 25)' }}>
                Permanently delete {selectedCount} tenant{selectedCount !== 1 ? 's' : ''}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                This cannot be undone. All members, conversations, contacts, appointments,
                campaigns, recordings, transcripts, integrations, and audit history for these
                workspaces will be permanently removed. Recovery would require restoring from
                a DB snapshot.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                You are about to delete
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--surface-app)' }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Workspace</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Email</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-tertiary)' }}>Members</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-tertiary)' }}>Conversations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTenants.map((t, i) => (
                      <tr key={t.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{t.displayName}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{t.registrationEmail}</td>
                        <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t._count.members}</td>
                        <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t._count.conversations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Type <span className="font-mono font-bold" style={{ color: 'oklch(60% 0.20 25)' }}>DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  placeholder="DELETE"
                  autoFocus
                  disabled={deleting}
                />
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}>
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); setConfirmText('') }}
                className="text-xs px-4 py-2 rounded-md"
                style={{ color: 'var(--text-secondary)' }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deleting || confirmText !== 'DELETE'}
                className="text-xs font-semibold px-4 py-2 rounded-md"
                style={{
                  background: 'oklch(55% 0.20 25)',
                  color: '#fff',
                  opacity: deleting || confirmText !== 'DELETE' ? 0.55 : 1,
                  cursor: deleting || confirmText !== 'DELETE' ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : `Delete ${selectedCount} permanently`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
