'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface Stage {
  id?: string
  name: string
  sortOrder: number
  color: string | null
  isWon: boolean
  isLost: boolean
  isSystem?: boolean
  contactCount?: number
  /** transient flag for rows added in this session but not yet saved */
  _new?: boolean
}

const PALETTE = [
  'oklch(95% 0.04 250)',
  'oklch(95% 0.04 193)',
  'oklch(95% 0.08 80)',
  'oklch(95% 0.05 145)',
  'oklch(92% 0.10 145)',
  'oklch(95% 0.05 25)',
  'oklch(93% 0 0)',
]

export default function PipelineStagesPage() {
  const t = useT()
  const { data, loading, error, reload } = useApi<Stage[]>('/api/crm/pipeline-stages', [])
  const [stages, setStages] = useState<Stage[]>([])
  const [toDelete, setToDelete] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setStages(data.map((s, i) => ({ ...s, sortOrder: i })))
  }, [data])

  function move(idx: number, delta: number) {
    const j = idx + delta
    if (j < 0 || j >= stages.length) return
    const next = [...stages]
    const [item] = next.splice(idx, 1)
    if (!item) return
    next.splice(j, 0, item)
    setStages(next.map((s, i) => ({ ...s, sortOrder: i })))
  }

  function update(idx: number, patch: Partial<Stage>) {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function addStage() {
    setStages(prev => [
      ...prev,
      {
        name:      t('crmStages.newStageDefaultName'),
        sortOrder: prev.length,
        color:     PALETTE[prev.length % PALETTE.length] ?? null,
        isWon:     false,
        isLost:    false,
        _new:      true,
      },
    ])
  }

  function removeStage(idx: number) {
    const s = stages[idx]
    if (!s) return
    if ((s.contactCount ?? 0) > 0) {
      alert(t('crmStages.deleteBlockedHasContacts', { n: s.contactCount ?? 0 }))
      return
    }
    if (!confirm(t('crmStages.deleteConfirm', { name: s.name }))) return
    if (s.id) setToDelete(prev => [...prev, s.id!])
    setStages(prev => prev.filter((_, i) => i !== idx).map((row, i) => ({ ...row, sortOrder: i })))
  }

  async function save() {
    setSaving(true); setSaveError(''); setSaved(false)
    try {
      await apiFetch('/api/crm/pipeline-stages', {
        method: 'PUT',
        body: JSON.stringify({
          stages: stages.map(({ _new, contactCount, isSystem, ...rest }) => rest),
          toDelete,
        }),
      })
      setToDelete([])
      setSaved(true)
      reload()
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('crmStages.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('crmStages.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('crmStages.subtitle')}
          </p>
        </div>
        <Link href="/crm" className="btn-ghost">{t('crmStages.backToKanban')}</Link>
      </div>

      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error && <div className="alert-error">{error}</div>}

      <div className="rounded-xl divide-y" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        {stages.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="p-3 flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs disabled:opacity-30" aria-label={t('crmStages.moveUp')}>▲</button>
              <button onClick={() => move(i, +1)} disabled={i === stages.length - 1} className="text-xs disabled:opacity-30" aria-label={t('crmStages.moveDown')}>▼</button>
            </div>
            <div
              className="w-3 h-8 rounded-sm flex-shrink-0"
              style={{ background: s.color ?? 'var(--surface-overlay)' }}
              aria-hidden
            />
            <input
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="input flex-1"
              maxLength={80}
              aria-label={t('crmStages.stageName')}
            />
            <select
              value={s.color ?? ''}
              onChange={(e) => update(i, { color: e.target.value || null })}
              className="input"
              aria-label={t('crmStages.stageColor')}
              style={{ maxWidth: 120 }}
            >
              {PALETTE.map((p, idx) => (
                <option key={p} value={p}>{t('crmStages.colorOption', { n: idx + 1 })}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={s.isWon}  onChange={(e) => update(i, { isWon: e.target.checked, isLost: e.target.checked ? false : s.isLost })} />
              {t('crmStages.won')}
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={s.isLost} onChange={(e) => update(i, { isLost: e.target.checked, isWon: e.target.checked ? false : s.isWon })} />
              {t('crmStages.lost')}
            </label>
            <span className="text-xs w-12 text-right" style={{ color: 'var(--text-tertiary)' }}>
              {t('crmStages.contactCount', { n: s.contactCount ?? 0 })}
            </span>
            <button onClick={() => removeStage(i)} className="text-xs px-2 py-1 rounded hover:bg-red-50" style={{ color: 'var(--error-600)' }}>
              {t('crmStages.delete')}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={addStage} className="btn-ghost">{t('crmStages.addStage')}</button>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? t('crmStages.saving') : t('crmStages.save')}
        </button>
        {saved      && <span className="text-xs" style={{ color: 'var(--success-600, #16a34a)' }}>{t('crmStages.savedConfirmation')}</span>}
        {saveError  && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{saveError}</span>}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('crmStages.autoTransitionNote')}
      </p>
    </div>
  )
}
