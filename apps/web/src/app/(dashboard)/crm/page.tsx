'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

interface BoardStage {
  id: string
  name: string
  sortOrder: number
  color: string | null
  isWon: boolean
  isLost: boolean
  isSystem: boolean
  contactCount: number
}

interface BoardContact {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phoneE164: string | null
  source: string
  pipelineStageId: string | null
  stageUpdatedAt: string | null
  createdAt: string
}

interface BoardData {
  stages:   BoardStage[]
  contacts: BoardContact[]
}

export default function CrmKanbanPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const { data, loading, error, reload } = useApi<BoardData>('/api/crm/board', [])
  const [search, setSearch] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [savingMove, setSavingMove] = useState(false)

  // Group contacts by stage. Re-runs only when data or search change.
  const grouped = useMemo(() => {
    const m = new Map<string, BoardContact[]>()
    const q = search.trim().toLowerCase()
    const filtered = (data?.contacts ?? []).filter(c => {
      if (!q) return true
      const hay = [c.fullName, c.firstName, c.lastName, c.email, c.phoneE164]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    for (const c of filtered) {
      if (!c.pipelineStageId) continue
      const arr = m.get(c.pipelineStageId) ?? []
      arr.push(c)
      m.set(c.pipelineStageId, arr)
    }
    return m
  }, [data, search])

  async function moveContact(contactId: string, stageId: string) {
    setSavingMove(true)
    try {
      await apiFetch(`/api/crm/contacts/${contactId}/stage`, {
        method: 'PATCH',
        body:   JSON.stringify({ stageId }),
      })
      reload()
    } catch (e) {
      // Snap back via reload — no need to surface a toast for a drag undo.
      reload()
      console.warn('[crm] move failed:', e)
    } finally {
      setSavingMove(false)
    }
  }

  function fullName(c: BoardContact): string {
    return c.fullName ?? [c.firstName, c.lastName].filter(Boolean).join(' ') ?? t('crm.unnamed')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('crm.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('crm.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('crm.searchPlaceholder')}
            className="input max-w-xs"
          />
          <Link href="/contacts" className="btn-ghost">{t('crm.listView')}</Link>
          <Link href="/crm/stages" className="btn-ghost">{t('crm.manageStages')}</Link>
        </div>
      </div>

      {loading && (
        <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />
      )}
      {error && <div className="alert-error">{error}</div>}

      {data && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max" style={{ alignItems: 'flex-start' }}>
            {data.stages.map((stage) => {
              const items = grouped.get(stage.id) ?? []
              return (
                <div
                  key={stage.id}
                  className="rounded-xl flex flex-col"
                  style={{
                    width:      280,
                    minHeight:  200,
                    background: stage.color ?? 'var(--surface-overlay)',
                    border:     '1px solid var(--border-subtle)',
                  }}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggedId) {
                      moveContact(draggedId, stage.id)
                      setDraggedId(null)
                    }
                  }}
                >
                  <div
                    className="px-3 py-2 flex items-center justify-between rounded-t-xl"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {stage.name}
                      </span>
                      {stage.isWon  && <span className="text-xs">🏆</span>}
                      {stage.isLost && <span className="text-xs">✕</span>}
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                    >
                      {items.length}
                    </span>
                  </div>

                  <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                    {items.length === 0 && (
                      <div
                        className="text-xs text-center py-6 rounded-lg"
                        style={{ color: 'var(--text-tertiary)', border: '1px dashed var(--border-subtle)' }}
                      >
                        {t('crm.column.empty')}
                      </div>
                    )}
                    {items.map((c) => (
                      <Link
                        key={c.id}
                        href={`/contacts/${c.id}`}
                        draggable
                        onDragStart={() => setDraggedId(c.id)}
                        onDragEnd={() => setDraggedId(null)}
                        className="block p-2 rounded-lg cursor-move transition-shadow hover:shadow-md"
                        style={{
                          background: 'var(--surface-raised)',
                          border:     '1px solid var(--border-subtle)',
                          opacity:    draggedId === c.id ? 0.4 : 1,
                        }}
                      >
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {fullName(c)}
                        </div>
                        {c.email && (
                          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {c.email}
                          </div>
                        )}
                        {c.phoneE164 && (
                          <div className="text-xs font-mono truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {c.phoneE164}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}
                          >
                            {c.source}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            {new Date(c.stageUpdatedAt ?? c.createdAt).toLocaleDateString(dateLocale)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {savingMove && (
        <div className="fixed bottom-4 right-4 text-xs px-3 py-2 rounded-lg shadow-lg"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
          {t('crm.movingContact')}
        </div>
      )}
    </div>
  )
}
