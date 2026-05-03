'use client'

import { useApi } from '@/hooks/useApi'

interface ErrorEntry {
  id:           string
  action:       string
  createdAt:    string
  metadataJson: {
    method?:   string
    path?:     string
    message?:  string
    stack?:    string
    tenantId?: string | null
  } | null
}

interface ErrorsResponse { items: ErrorEntry[]; total: number }

export default function AdminErrorsPage() {
  const { data, loading, reload } = useApi<ErrorsResponse>('/api/admin/errors')

  if (loading) {
    return <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Unhandled Errors</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Server-side 500 errors captured by the global error handler. Newest 200.
          </p>
        </div>
        <button onClick={reload} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'oklch(98% 0.02 160)', border: '1px solid oklch(85% 0.10 160)' }}>
          <p className="text-sm font-semibold" style={{ color: 'oklch(35% 0.16 160)' }}>No errors recorded.</p>
          <p className="text-xs mt-1" style={{ color: 'oklch(45% 0.10 160)' }}>The platform is healthy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(e => {
            const m = e.metadataJson ?? {}
            return (
              <details key={e.id} className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <summary className="px-5 py-3 cursor-pointer flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono px-2 py-0.5 rounded font-semibold" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>
                      {m.method ?? '?'}
                    </span>
                    <span className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>{m.path ?? '(unknown path)'}</span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{m.message ?? '(no message)'}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </summary>
                <div className="px-5 py-4 space-y-2 text-xs" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {m.tenantId && <p><span style={{ color: 'var(--text-tertiary)' }}>tenant:</span> <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{m.tenantId}</span></p>}
                  {m.stack && (
                    <pre className="font-mono text-xs whitespace-pre-wrap p-3 rounded-lg overflow-x-auto" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>
                      {m.stack}
                    </pre>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
