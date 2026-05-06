'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

// ── Types ─────────────────────────────────────────────────────────────────────
interface OutboundCampaign {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  _count: { attempts: number }
}

interface Attempt {
  id: string
  status: string
  outcomeCode: string | null
  attemptNumber: number
  startedAt: string | null
  endedAt: string | null
  conversationId: string | null
  contact: {
    id: string
    fullName: string | null
    firstName: string | null
    lastName: string | null
    phoneE164: string | null
    email: string | null
  }
}

interface Contact {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  phoneE164: string | null
  email: string | null
}

interface ContactList {
  items: Contact[]
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-50 text-blue-700',
  RUNNING:   'bg-green-100 text-green-800',
  PAUSED:    'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-teal-100 text-teal-800',
  CANCELED:  'bg-red-100 text-red-700',
}

const ATTEMPT_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-600',
  DIALING:   'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED:    'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

function contactNameOf(c: Contact | Attempt['contact'], fallback: string) {
  return c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.phoneE164 || c.email || fallback
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-900'

// ── Main Page ─────────────────────────────────────────────────────────────────
type View = 'list' | 'detail'

export default function OutboundPage() {
  const t = useT()
  const [view, setView]       = useState<View>('list')
  const [selected, setSelected] = useState<OutboundCampaign | null>(null)
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showMsg(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  function openCampaign(c: OutboundCampaign) {
    setSelected(c)
    setView('detail')
  }

  function backToList() {
    setSelected(null)
    setView('list')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tenantOutbound.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('tenantOutbound.subtitle')}
          </p>
        </div>
        {view === 'detail' && (
          <button onClick={backToList} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            {t('tenantOutbound.backToCampaigns')}
          </button>
        )}
      </div>

      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.text}
        </div>
      )}

      {view === 'list'   && <CampaignList onOpen={openCampaign} onMsg={showMsg} />}
      {view === 'detail' && selected && (
        <CampaignDetail campaign={selected} onMsg={showMsg} onBack={backToList} />
      )}
    </div>
  )
}

// ── Campaign List ─────────────────────────────────────────────────────────────
function CampaignList({
  onOpen,
  onMsg,
}: {
  onOpen: (c: OutboundCampaign) => void
  onMsg: (t: 'success' | 'error', m: string) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data: campaigns, loading, error, reload } = useApi<OutboundCampaign[]>('/api/outbound-campaigns')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ name: '', description: '' })

  async function createCampaign() {
    if (!form.name.trim()) { onMsg('error', t('tenantOutbound.messages.nameRequired')); return }
    setSaving(true)
    try {
      await apiFetch('/api/outbound-campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || undefined }),
      })
      onMsg('success', t('tenantOutbound.messages.createSuccess'))
      setForm({ name: '', description: '' })
      setShowNew(false)
      reload()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.createFailed'))
    } finally { setSaving(false) }
  }

  async function deleteCampaign(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('tenantOutbound.messages.deleteConfirm'))) return
    try {
      await apiFetch(`/api/outbound-campaigns/${id}`, { method: 'DELETE' })
      onMsg('success', t('tenantOutbound.messages.deleteSuccess'))
      reload()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.deleteFailed'))
    }
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">{t('tenantOutbound.loading')}</div>
  if (error)   return <div className="text-sm text-red-600 py-8 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)} className="btn-primary">{t('tenantOutbound.actions.newCampaign')}</button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('tenantOutbound.list.newHeading')}</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('tenantOutbound.list.form.name')}</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inp}
              placeholder={t('tenantOutbound.list.form.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('tenantOutbound.list.form.description')}</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={inp}
              placeholder={t('tenantOutbound.list.form.descriptionPlaceholder')}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={createCampaign} disabled={saving} className="btn-primary">
              {saving ? t('tenantOutbound.actions.creating') : t('tenantOutbound.actions.createCampaign')}
            </button>
            <button onClick={() => setShowNew(false)} className="btn-ghost">{t('tenantOutbound.actions.cancel')}</button>
          </div>
        </div>
      )}

      {(campaigns ?? []).length === 0 && !showNew && (
        <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
          {t('tenantOutbound.list.empty.line1')}<br />{t('tenantOutbound.list.empty.line2')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(campaigns ?? []).map(c => (
          <div
            key={c.id}
            onClick={() => onOpen(c)}
            className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900 text-sm leading-snug">{c.name}</p>
              <Badge label={c.status} color={STATUS_COLORS[c.status]} />
            </div>
            {c.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{c.description}</p>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">
                {t(c._count.attempts === 1 ? 'tenantOutbound.list.card.contact' : 'tenantOutbound.list.card.contacts', { count: c._count.attempts })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString(dateLocale)}</span>
                {!['RUNNING', 'COMPLETED'].includes(c.status) && (
                  <button
                    onClick={e => deleteCampaign(c.id, e)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    {t('tenantOutbound.actions.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Campaign Detail ───────────────────────────────────────────────────────────
function CampaignDetail({
  campaign: initial,
  onMsg,
  onBack: _onBack,
}: {
  campaign: OutboundCampaign
  onMsg: (t: 'success' | 'error', m: string) => void
  onBack: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  void _onBack

  const { data: campaign, loading: cLoading, reload: reloadCampaign } =
    useApi<OutboundCampaign>(`/api/outbound-campaigns/${initial.id}`)

  const { data: attempts, loading: aLoading, reload: reloadAttempts } =
    useApi<Attempt[]>(`/api/outbound-campaigns/${initial.id}/attempts`)

  const [tab, setTab]           = useState<'contacts' | 'results'>('contacts')
  const [acting, setActing]     = useState<string | null>(null)
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({ name: initial.name, description: initial.description ?? '' })
  const [saving, setSaving]     = useState(false)

  // Contact picker state
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [adding, setAdding]         = useState(false)

  const { data: contactData, loading: contactsLoading } = useApi<ContactList>(
    `/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    [search]
  )
  const allContacts = contactData?.items ?? []

  const current = campaign ?? initial

  // Live polling: when a campaign is RUNNING, refresh attempts every 5s so
  // the user sees calls land without manually reloading.
  useEffect(() => {
    if (current.status !== 'RUNNING') return
    const id = setInterval(() => {
      reloadAttempts()
      reloadCampaign()
    }, 5000)
    return () => clearInterval(id)
  }, [current.status, reloadAttempts, reloadCampaign])

  function outcomeLabel(code: string): string {
    // OUTCOME_LABELS keys map to translation keys under tenantOutbound.outcomeLabels.*
    const known = ['answered','busy','no_answer','voicemail','failed','canceled','campaign_canceled','dispatch_error','no_phone']
    return known.includes(code) ? t(`tenantOutbound.outcomeLabels.${code}`) : code
  }

  async function doAction(action: 'start' | 'pause' | 'cancel') {
    setActing(action)
    try {
      await apiFetch(`/api/outbound-campaigns/${current.id}/${action}`, { method: 'POST' })
      const msgKey =
        action === 'start' ? 'tenantOutbound.messages.campaignStarted' :
        action === 'pause' ? 'tenantOutbound.messages.campaignPaused' :
        'tenantOutbound.messages.campaignCanceled'
      onMsg('success', t(msgKey))
      reloadCampaign()
      reloadAttempts()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.actionFailed'))
    } finally { setActing(null) }
  }

  async function saveEdit() {
    if (!editForm.name.trim()) { onMsg('error', t('tenantOutbound.messages.nameRequired')); return }
    setSaving(true)
    try {
      await apiFetch(`/api/outbound-campaigns/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editForm.name.trim(), description: editForm.description.trim() || undefined }),
      })
      onMsg('success', t('tenantOutbound.messages.updateSuccess'))
      setEditing(false)
      reloadCampaign()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.updateFailed'))
    } finally { setSaving(false) }
  }

  async function addContacts() {
    if (selected.size === 0) return
    setAdding(true)
    try {
      const result = await apiFetch(`/api/outbound-campaigns/${current.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds: Array.from(selected) }),
      }) as { data: { added: number } }
      const added = result.data.added
      onMsg('success', t(added === 1 ? 'tenantOutbound.messages.contactsAdded' : 'tenantOutbound.messages.contactsAddedPlural', { count: added }))
      setSelected(new Set())
      setShowPicker(false)
      setSearch('')
      reloadCampaign()
      reloadAttempts()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.addContactsFailed'))
    } finally { setAdding(false) }
  }

  async function removeContact(contactId: string) {
    try {
      await apiFetch(`/api/outbound-campaigns/${current.id}/contacts/${contactId}`, { method: 'DELETE' })
      reloadAttempts()
      reloadCampaign()
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantOutbound.messages.removeFailed'))
    }
  }

  // Summary stats
  const attemptList = attempts ?? []
  const totalAttempts  = attemptList.length
  const completed  = attemptList.filter(a => a.status === 'COMPLETED').length
  const failed     = attemptList.filter(a => a.status === 'FAILED').length
  const pending    = attemptList.filter(a => a.status === 'PENDING').length
  const dialing    = attemptList.filter(a => a.status === 'DIALING').length
  const answered   = attemptList.filter(a => a.outcomeCode === 'answered').length

  const canStart  = ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(current.status)
  const canPause  = current.status === 'RUNNING'
  const canCancel = !['COMPLETED', 'CANCELED'].includes(current.status)

  if (cLoading) return <div className="text-sm text-gray-500 py-8 text-center">{t('tenantOutbound.loading')}</div>

  const unknownLabel = t('tenantOutbound.attempts.unknown')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {editing ? (
          <div className="space-y-3">
            <input
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className={inp}
              placeholder={t('tenantOutbound.detail.edit.namePlaceholder')}
            />
            <input
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              className={inp}
              placeholder={t('tenantOutbound.detail.edit.descriptionPlaceholder')}
            />
            <div className="flex gap-3">
              <button onClick={saveEdit} disabled={saving} className="btn-primary">
                {saving ? t('tenantOutbound.actions.saving') : t('tenantOutbound.actions.save')}
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost">{t('tenantOutbound.actions.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">{current.name}</h2>
                <Badge label={current.status} color={STATUS_COLORS[current.status]} />
              </div>
              {current.description && (
                <p className="text-sm text-gray-500 mt-1">{current.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!['RUNNING', 'COMPLETED', 'CANCELED'].includes(current.status) && (
                <button onClick={() => { setEditForm({ name: current.name, description: current.description ?? '' }); setEditing(true) }}
                  className="btn-ghost text-xs">{t('tenantOutbound.actions.edit')}</button>
              )}
              {canStart  && <button onClick={() => doAction('start')}  disabled={!!acting} className="btn-primary text-sm">{acting === 'start'  ? t('tenantOutbound.actions.starting') : t('tenantOutbound.actions.start')}</button>}
              {canPause  && <button onClick={() => doAction('pause')}  disabled={!!acting} className="btn-secondary text-sm">{acting === 'pause'  ? t('tenantOutbound.actions.pausing') : t('tenantOutbound.actions.pause')}</button>}
              {canCancel && <button onClick={() => doAction('cancel')} disabled={!!acting} className="btn-danger text-sm">{acting === 'cancel' ? t('tenantOutbound.actions.canceling') : t('tenantOutbound.actions.cancelAction')}</button>}
            </div>
          </div>
        )}

        {/* Progress bar — visible during and after a run */}
        {totalAttempts > 0 && (
          <div className="pt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{t('tenantOutbound.detail.progress.doneOf', { done: completed + failed, total: totalAttempts })}</span>
              <span>{Math.round(((completed + failed) / totalAttempts) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full transition-all"
                style={{
                  width: `${((completed + failed) / totalAttempts) * 100}%`,
                  background: current.status === 'RUNNING' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.11 193 / 0.5)',
                }}
              />
            </div>
            {current.status === 'RUNNING' && (
              <p className="text-xs text-gray-400 mt-1">{t('tenantOutbound.detail.progress.live')}</p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100">
          {[
            { label: t('tenantOutbound.detail.stats.totalContacts'), value: totalAttempts },
            { label: t('tenantOutbound.detail.stats.answered'), value: answered },
            { label: t('tenantOutbound.detail.stats.pending'), value: pending + dialing },
            { label: t('tenantOutbound.detail.stats.failedNoAnswer'), value: failed },
            { label: t('tenantOutbound.detail.stats.completed'), value: completed },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['contacts', t('tenantOutbound.detail.tabs.contacts')],
          ['results',  t('tenantOutbound.detail.tabs.results')],
        ] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v as 'contacts' | 'results')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === v ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <div className="space-y-4">
          {/* Add contacts button */}
          {['DRAFT', 'PAUSED'].includes(current.status) && (
            <div>
              <button onClick={() => setShowPicker(!showPicker)} className="btn-secondary text-sm">
                {showPicker ? t('tenantOutbound.actions.closePicker') : t('tenantOutbound.actions.addContacts')}
              </button>
            </div>
          )}

          {/* Contact picker */}
          {showPicker && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{t('tenantOutbound.picker.heading')}</p>
                {selected.size > 0 && (
                  <button onClick={addContacts} disabled={adding} className="btn-primary text-sm">
                    {adding
                      ? t('tenantOutbound.picker.adding')
                      : t(selected.size === 1 ? 'tenantOutbound.picker.addCount' : 'tenantOutbound.picker.addCountPlural', { count: selected.size })}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('tenantOutbound.picker.searchPlaceholder')}
                className={inp}
              />
              {contactsLoading && <p className="text-sm text-gray-400">{t('tenantOutbound.picker.loadingContacts')}</p>}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {allContacts.length === 0 && !contactsLoading && (
                  <p className="text-sm text-gray-400 py-4 text-center">{t('tenantOutbound.picker.noResults')}</p>
                )}
                {allContacts.map(c => {
                  const alreadyAdded = attemptList.some(a => a.contact.id === c.id)
                  const isSelected   = selected.has(c.id)
                  return (
                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyAdded}
                        onChange={() => {
                          if (alreadyAdded) return
                          setSelected(prev => {
                            const next = new Set(prev)
                            if (next.has(c.id)) next.delete(c.id)
                            else next.add(c.id)
                            return next
                          })
                        }}
                        className="rounded border-gray-300 text-teal-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{contactNameOf(c, unknownLabel)}</p>
                        <p className="text-xs text-gray-400 truncate">{c.phoneE164 ?? c.email ?? '—'}</p>
                      </div>
                      {alreadyAdded && <span className="text-xs text-gray-400">{t('tenantOutbound.picker.alreadyAdded')}</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attempts table */}
          {aLoading && <div className="text-sm text-gray-500 py-4 text-center">{t('tenantOutbound.loading')}</div>}
          {!aLoading && attemptList.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
              {t('tenantOutbound.attempts.empty')}
            </div>
          )}
          {attemptList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      t('tenantOutbound.attempts.headers.contact'),
                      t('tenantOutbound.attempts.headers.phone'),
                      t('tenantOutbound.attempts.headers.status'),
                      t('tenantOutbound.attempts.headers.outcome'),
                      t('tenantOutbound.attempts.headers.started'),
                      t('tenantOutbound.attempts.headers.duration'),
                      t('tenantOutbound.attempts.headers.actions'),
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attemptList.map(a => {
                    const durationSecs = a.startedAt && a.endedAt
                      ? Math.round((new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()) / 1000)
                      : null
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{contactNameOf(a.contact, unknownLabel)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.contact.phoneE164 ?? '—'}</td>
                        <td className="px-4 py-3"><Badge label={a.status} color={ATTEMPT_STATUS_COLORS[a.status]} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{a.outcomeCode ? outcomeLabel(a.outcomeCode) : '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {a.startedAt ? new Date(a.startedAt).toLocaleString(dateLocale) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {durationSecs != null ? t('tenantOutbound.attempts.duration', { secs: durationSecs }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {a.conversationId && (
                            <Link
                              href={`/conversations?id=${a.conversationId}`}
                              className="text-xs text-blue-500 hover:text-blue-700 transition-colors mr-3"
                            >
                              {t('tenantOutbound.actions.view')}
                            </Link>
                          )}
                          {a.status === 'PENDING' && ['DRAFT', 'PAUSED'].includes(current.status) && (
                            <button
                              onClick={() => removeContact(a.contact.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                              {t('tenantOutbound.actions.remove')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-6">
          {/* Outcome breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('tenantOutbound.results.outcomeBreakdown')}</h3>
            {totalAttempts === 0 ? (
              <p className="text-sm text-gray-400">{t('tenantOutbound.results.noAttempts')}</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  attemptList.reduce<Record<string, number>>((acc, a) => {
                    const key = a.outcomeCode ?? a.status
                    acc[key] = (acc[key] ?? 0) + 1
                    return acc
                  }, {})
                ).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                  <div key={code} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-36 flex-shrink-0">
                      {outcomeLabel(code)}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-teal-500"
                        style={{ width: `${(count / totalAttempts) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{count}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {((count / totalAttempts) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed call list */}
          {attemptList.filter(a => a.status === 'COMPLETED').length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{t('tenantOutbound.results.answeredCalls')}</p>
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      t('tenantOutbound.attempts.headers.contact'),
                      t('tenantOutbound.attempts.headers.phone'),
                      t('tenantOutbound.attempts.headers.outcome'),
                      t('tenantOutbound.attempts.headers.duration'),
                      t('tenantOutbound.attempts.headers.callTime'),
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attemptList.filter(a => a.status === 'COMPLETED').map(a => {
                    const durationSecs = a.startedAt && a.endedAt
                      ? Math.round((new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()) / 1000)
                      : null
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{contactNameOf(a.contact, unknownLabel)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.contact.phoneE164 ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{a.outcomeCode ? outcomeLabel(a.outcomeCode) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{durationSecs != null ? t('tenantOutbound.attempts.duration', { secs: durationSecs }) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {a.startedAt ? new Date(a.startedAt).toLocaleString(dateLocale) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
