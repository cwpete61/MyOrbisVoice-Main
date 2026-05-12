'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi, apiFetchRaw, apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

interface Contact { firstName: string | null; lastName: string | null; email: string | null; phoneE164: string | null }

interface Conversation {
  id: string
  channelType: 'WIDGET' | 'INBOUND' | 'OUTBOUND'
  direction: 'INBOUND' | 'OUTBOUND'
  status: string
  startedAt: string
  endedAt: string | null
  summaryText: string | null
  transcriptRef: string | null
  transcriptJson: TranscriptEntry[] | null
  recordingStatus: string | null
  outcomeCode: string | null
  contact: Contact | null
}

// Tenant-editable disposition tags — what was the BUSINESS outcome of this call?
// Distinct from `status` (technical: completed/missed/failed) and from
// `outcomeCode` set by the system (e.g. `voicemail`, `busy`, `no_answer` for
// outbound). A tenant can override outcomeCode on any conversation to one
// of these tags so funnel reports group by real outcomes.
const DISPOSITION_VALUES: { value: string; labelKey: string }[] = [
  { value: '',                  labelKey: 'tenantConversations.dispositions.none' },
  { value: 'booked',             labelKey: 'tenantConversations.dispositions.booked' },
  { value: 'qualified',          labelKey: 'tenantConversations.dispositions.qualified' },
  { value: 'callback',           labelKey: 'tenantConversations.dispositions.callback' },
  { value: 'not_interested',     labelKey: 'tenantConversations.dispositions.notInterested' },
  { value: 'wrong_number',       labelKey: 'tenantConversations.dispositions.wrongNumber' },
  { value: 'voicemail',          labelKey: 'tenantConversations.dispositions.voicemail' },
  { value: 'no_answer',          labelKey: 'tenantConversations.dispositions.noAnswer' },
  { value: 'spam',               labelKey: 'tenantConversations.dispositions.spam' },
]

interface ConversationsResponse { items: Conversation[]; total: number }
type TranscriptEntry = { role: 'user' | 'assistant'; text: string; timestamp: number }

const CHANNEL_COLORS: Record<string, string> = {
  WIDGET: 'oklch(55% 0.11 193)',
  INBOUND: 'oklch(55% 0.14 140)',
  OUTBOUND: 'oklch(55% 0.12 260)',
}
const STATUS_OPTS = ['', 'COMPLETED', 'MISSED', 'FAILED', 'OPEN']

function contactName(c: Contact | null): string {
  if (!c) return ''
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return name || c.email || c.phoneE164 || ''
}

export default function ConversationsPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [selected, setSelected] = useState<Conversation | null>(null)
  const [channelFilter, setChannelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [hasRecording, setHasRecording] = useState('')
  const [sortBy, setSortBy] = useState('startedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const limit = 20

  function channelLabel(channelType: string): string {
    switch (channelType) {
      case 'WIDGET':   return t('tenantConversations.channel.widget')
      case 'INBOUND':  return t('tenantConversations.channel.inbound')
      case 'OUTBOUND': return t('tenantConversations.channel.outbound')
      default:         return channelType
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case 'COMPLETED': return t('tenantConversations.status.completed')
      case 'MISSED':    return t('tenantConversations.status.missed')
      case 'FAILED':    return t('tenantConversations.status.failed')
      case 'OPEN':      return t('tenantConversations.status.open')
      default:          return status
    }
  }

  function statusPillLabel(status: string | null | undefined): string {
    if (!status) return ''
    switch (status.toUpperCase()) {
      case 'COMPLETED': return t('tenantConversations.statusPill.completed')
      case 'MISSED':    return t('tenantConversations.statusPill.missed')
      case 'FAILED':    return t('tenantConversations.statusPill.failed')
      case 'OPEN':      return t('tenantConversations.statusPill.open')
      default:          return status.toLowerCase()
    }
  }

  function formatDuration(start: string, end: string | null): string {
    if (!end) return t('tenantConversations.duration.none')
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
    if (secs < 60) return t('tenantConversations.duration.seconds', { s: secs })
    return t('tenantConversations.duration.minutesSeconds', { m: Math.floor(secs / 60), s: secs % 60 })
  }

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchInput])

  useEffect(() => {
    setRecordingUrl(null)
    if (!selected?.id || selected.recordingStatus !== 'stored') return
    let objectUrl: string | null = null
    setRecordingLoading(true)
    apiFetchRaw(`/api/conversations/${selected.id}/recording`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.blob() })
      .then(blob => { objectUrl = URL.createObjectURL(blob); setRecordingUrl(objectUrl) })
      .catch(() => setRecordingUrl(null))
      .finally(() => setRecordingLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selected?.id])

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String((page - 1) * limit),
    sortBy,
    sortDir,
  })
  if (channelFilter) params.set('channelType', channelFilter)
  if (statusFilter) params.set('status', statusFilter)
  if (search) params.set('search', search)
  if (hasRecording) params.set('hasRecording', hasRecording)

  const { data, loading, reload } = useApi<ConversationsResponse>(`/api/conversations?${params}`)
  const conversations = data?.items ?? []
  const total = data?.total ?? 0

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const allPageChecked = conversations.length > 0 && conversations.every(c => checkedIds.has(c.id))

  function toggleAll() {
    if (allPageChecked) {
      setCheckedIds(prev => { const n = new Set(prev); conversations.forEach(c => n.delete(c.id)); return n })
    } else {
      setCheckedIds(prev => { const n = new Set(prev); conversations.forEach(c => n.add(c.id)); return n })
    }
  }

  function toggleOne(id: string) {
    setCheckedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function setDisposition(value: string) {
    if (!selected) return
    const newOutcome = value || null
    // Optimistic UI
    setSelected({ ...selected, outcomeCode: newOutcome })
    try {
      await apiFetch(`/api/conversations/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ outcomeCode: newOutcome }),
      })
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantConversations.detail.dispositionUpdateFailed'))
      // Roll back
      setSelected({ ...selected })
    }
  }

  function openFollowupEmail() {
    if (!selected) return
    const name = [selected.contact?.firstName, selected.contact?.lastName].filter(Boolean).join(' ') || ''
    const greeting = name
      ? t('tenantConversations.email.defaultGreeting', { name })
      : t('tenantConversations.email.defaultGreetingNoName')
    const summaryLine = selected.summaryText ? `\n\n${selected.summaryText}` : ''
    setEmailDraft({
      to:      selected.contact?.email ?? '',
      subject: t('tenantConversations.email.defaultSubject'),
      body:    t('tenantConversations.email.defaultBody', { greeting, summaryLine }),
    })
  }

  async function sendFollowupEmail() {
    if (!emailDraft) return
    if (!emailDraft.to || !emailDraft.subject.trim() || !emailDraft.body.trim()) {
      showToast('error', t('tenantConversations.email.validationError'))
      return
    }
    setEmailSending(true)
    try {
      await apiFetch('/api/integrations/google/send-email', {
        method: 'POST',
        body: JSON.stringify(emailDraft),
      })
      showToast('success', t('tenantConversations.email.sentSuccess', { to: emailDraft.to }))
      setEmailDraft(null)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantConversations.email.sendFailed'))
    } finally { setEmailSending(false) }
  }

  async function downloadPdf() {
    if (!selected) return
    setPdfDownloading(true)
    try {
      const res = await apiFetchRaw(`/api/conversations/${selected.id}/export.pdf`)
      if (!res.ok) {
        let msg = t('tenantConversations.detail.pdfExportFailed')
        try {
          const ct = res.headers.get('Content-Type') ?? ''
          if (ct.includes('json')) {
            const j = await res.json() as { error?: string; errors?: { message: string }[] }
            msg = j.error ?? j.errors?.[0]?.message ?? msg
          }
        } catch { /* ignore */ }
        throw new Error(msg)
      }

      // Pull filename from Content-Disposition if present, otherwise build one.
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const fallback = `conversation-${selected.id}-${(selected.startedAt ?? '').slice(0, 10)}.pdf`
      const filename = match?.[1] ? decodeURIComponent(match[1]) : fallback

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke after a tick — some browsers need the URL alive briefly
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantConversations.detail.pdfExportFailed'))
    } finally {
      setPdfDownloading(false)
    }
  }

  async function bulkDelete() {
    if (checkedIds.size === 0) return
    const confirmMsg = checkedIds.size > 1
      ? t('tenantConversations.bulk.confirmPlural', { n: checkedIds.size })
      : t('tenantConversations.bulk.confirmSingular', { n: checkedIds.size })
    if (!confirm(confirmMsg)) return
    setDeleting(true)
    try {
      await apiFetch('/api/conversations', { method: 'DELETE', body: JSON.stringify({ ids: [...checkedIds] }) })
      const deletedCount = checkedIds.size
      setCheckedIds(new Set())
      if (selected && checkedIds.has(selected.id)) setSelected(null)
      await reload()
      const successMsg = deletedCount > 1
        ? t('tenantConversations.bulk.deletedPlural', { n: deletedCount })
        : t('tenantConversations.bulk.deletedSingular', { n: deletedCount })
      showToast('success', successMsg)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantConversations.bulk.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  let transcript: TranscriptEntry[] = []
  if (selected?.transcriptJson && Array.isArray(selected.transcriptJson)) {
    transcript = selected.transcriptJson as TranscriptEntry[]
  } else if (selected?.transcriptRef) {
    try { transcript = JSON.parse(selected.transcriptRef) } catch { /* ignore */ }
  }

  const totalCountText = total !== 1
    ? t('tenantConversations.list.totalPlural', { n: total })
    : t('tenantConversations.list.totalSingular', { n: total })

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {t('tenantConversations.title')}
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {t('tenantConversations.subtitle')}
      </p>

      {toast && <div className={`mb-4 ${toast.type === 'success' ? 'alert-success' : 'alert-error'}`}>{toast.text}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5l3 3"/>
          </svg>
          <input
            className="input pl-7 text-xs"
            placeholder={t('tenantConversations.searchPlaceholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        {/* Channel filter */}
        <select
          className="input text-xs w-auto"
          value={channelFilter}
          onChange={e => { setChannelFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('tenantConversations.filters.allChannels')}</option>
          <option value="WIDGET">{t('tenantConversations.channel.widget')}</option>
          <option value="INBOUND">{t('tenantConversations.channel.inbound')}</option>
          <option value="OUTBOUND">{t('tenantConversations.channel.outbound')}</option>
        </select>

        {/* Status filter */}
        <select
          className="input text-xs w-auto"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          {STATUS_OPTS.map(s => (
            <option key={s} value={s}>{s ? statusLabel(s) : t('tenantConversations.filters.allStatuses')}</option>
          ))}
        </select>

        {/* Recording filter */}
        <select
          className="input text-xs w-auto"
          value={hasRecording}
          onChange={e => { setHasRecording(e.target.value); setPage(1) }}
        >
          <option value="">{t('tenantConversations.filters.allRecordings')}</option>
          <option value="true">{t('tenantConversations.filters.hasRecording')}</option>
          <option value="false">{t('tenantConversations.filters.noRecording')}</option>
        </select>

        {/* Sort */}
        <select
          className="input text-xs w-auto"
          value={`${sortBy}:${sortDir}`}
          onChange={e => { const [by, dir] = e.target.value.split(':'); setSortBy(by!); setSortDir(dir as 'asc' | 'desc'); setPage(1) }}
        >
          <option value="startedAt:desc">{t('tenantConversations.sort.newestFirst')}</option>
          <option value="startedAt:asc">{t('tenantConversations.sort.oldestFirst')}</option>
          <option value="status:asc">{t('tenantConversations.sort.statusAsc')}</option>
        </select>

        {/* Bulk delete */}
        {checkedIds.size > 0 && (
          <button onClick={bulkDelete} disabled={deleting} className="btn-danger text-xs">
            {deleting ? t('tenantConversations.bulk.deleting') : t('tenantConversations.bulk.deleteCount', { n: checkedIds.size })}
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantConversations.list.loading')}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantConversations.list.empty')}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Header row with select-all */}
              <div
                className="flex items-center gap-3 px-4 py-2 text-xs"
                style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <input
                  type="checkbox"
                  checked={allPageChecked}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 flex-shrink-0"
                />
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {checkedIds.size > 0
                    ? t('tenantConversations.list.selectedCount', { n: checkedIds.size })
                    : totalCountText}
                </span>
              </div>

              {conversations.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: selected?.id === c.id ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                    borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                  }}
                  onClick={() => setSelected(c)}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(c.id)}
                    onChange={(e) => { e.stopPropagation(); toggleOne(c.id) }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 flex-shrink-0 mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: CHANNEL_COLORS[c.channelType] + '22', color: CHANNEL_COLORS[c.channelType] }}
                      >
                        {channelLabel(c.channelType)}
                      </span>
                      {contactName(c.contact) && (
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {contactName(c.contact)}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {formatInTimezone(c.startedAt, { tz, locale: dateLocale, dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDuration(c.startedAt, c.endedAt)}
                      </span>
                    </div>
                    {c.summaryText ? (
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {c.summaryText}
                      </p>
                    ) : (
                      <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
                        {t('tenantConversations.list.noSummary')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantConversations.pagination.range', {
                  from: (page - 1) * limit + 1,
                  to: Math.min(page * limit, total),
                  total,
                })}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  {t('tenantConversations.pagination.previous')}
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  {t('tenantConversations.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div
            className="w-80 flex-shrink-0 rounded-xl border p-4"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ background: CHANNEL_COLORS[selected.channelType] + '22', color: CHANNEL_COLORS[selected.channelType] }}
              >
                {channelLabel(selected.channelType)}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label={t('tenantConversations.detail.close')}
              >
                ✕
              </button>
            </div>

            <div className="mb-3 space-y-0.5">
              {contactName(selected.contact) && (
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{contactName(selected.contact)}</div>
              )}
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {formatInTimezone(selected.startedAt, { tz, locale: dateLocale, dateStyle: 'medium', timeStyle: 'short' })}
                {selected.endedAt && ` · ${formatDuration(selected.startedAt, selected.endedAt)}`}
              </div>
              <span className="badge capitalize text-xs" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                {statusPillLabel(selected.status)}
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                {t('tenantConversations.detail.dispositionLabel')}
              </label>
              <select
                value={selected.outcomeCode ?? ''}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {DISPOSITION_VALUES.map(d => (
                  <option key={d.value} value={d.value}>{t(d.labelKey)}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantConversations.detail.dispositionHelp')}
              </p>
            </div>

            <button
              onClick={openFollowupEmail}
              className="w-full mb-2 text-xs font-medium px-3 py-2 rounded-lg flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="1" />
                <path d="M2 4l6 5 6-5" />
              </svg>
              {t('tenantConversations.detail.sendFollowupEmail')}
            </button>

            <button
              onClick={downloadPdf}
              disabled={pdfDownloading}
              className="w-full mb-4 text-xs font-medium px-3 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v8m0 0L5 7m3 3l3-3" />
                <path d="M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V12" />
              </svg>
              {pdfDownloading ? t('tenantConversations.detail.generatingPdf') : t('tenantConversations.detail.downloadPdf')}
            </button>

            {/* Recording player */}
            {selected.recordingStatus === 'stored' && (
              <div className="mb-4">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6"/><path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" stroke="none"/>
                  </svg>
                  {t('tenantConversations.detail.recording')}
                </div>
                {recordingLoading && (
                  <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
                    {t('tenantConversations.detail.recordingLoading')}
                  </div>
                )}
                {!recordingLoading && recordingUrl && (
                  <audio ref={audioRef} src={recordingUrl} controls style={{ width: '100%', height: '36px', accentColor: 'oklch(55% 0.11 193)' }} />
                )}
                {!recordingLoading && !recordingUrl && (
                  <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
                    {t('tenantConversations.detail.recordingUnavailable')}
                  </div>
                )}
              </div>
            )}

            {selected.summaryText && (
              <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>
                <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t('tenantConversations.detail.summary')}
                </div>
                {selected.summaryText}
              </div>
            )}

            {transcript.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('tenantConversations.detail.transcript')}
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transcript.map((entry, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2 rounded-lg ${entry.role === 'user' ? 'text-right' : ''}`}
                      style={{
                        background: entry.role === 'user' ? 'oklch(55% 0.11 193 / 0.15)' : 'var(--surface-sunken)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div className="font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                        {entry.role === 'user'
                          ? t('tenantConversations.detail.speakerCaller')
                          : t('tenantConversations.detail.speakerAgent')}
                      </div>
                      {entry.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transcript.length === 0 && !selected.summaryText && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantConversations.detail.noTranscript')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Follow-up email compose modal */}
      {emailDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(15% 0.02 270 / 0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEmailDraft(null) }}
        >
          <div
            className="w-full max-w-lg rounded-xl p-5 space-y-4"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('tenantConversations.email.title')}
              </h3>
              <button
                onClick={() => setEmailDraft(null)}
                className="text-sm"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label={t('tenantConversations.detail.close')}
              >
                ✕
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantConversations.email.intro')} <a href="/integrations" className="underline">{t('tenantConversations.email.integrationsLink')}</a>.
            </p>
            <div>
              <label className="label">{t('tenantConversations.email.to')}</label>
              <input
                type="email"
                className="input"
                value={emailDraft.to}
                onChange={(e) => setEmailDraft({ ...emailDraft, to: e.target.value })}
                placeholder={t('tenantConversations.email.toPlaceholder')}
              />
            </div>
            <div>
              <label className="label">{t('tenantConversations.email.subject')}</label>
              <input
                className="input"
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('tenantConversations.email.message')}</label>
              <textarea
                className="input font-mono text-xs"
                rows={10}
                value={emailDraft.body}
                onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setEmailDraft(null)}
                disabled={emailSending}
                className="text-sm px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('tenantConversations.email.cancel')}
              </button>
              <button
                onClick={sendFollowupEmail}
                disabled={emailSending}
                className="btn-primary text-sm"
              >
                {emailSending ? t('tenantConversations.email.sending') : t('tenantConversations.email.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
