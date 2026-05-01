'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi, apiFetchRaw } from '@/hooks/useApi'

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
}

interface ConversationsResponse {
  items: Conversation[]
  total: number
}

const CHANNEL_LABELS: Record<string, string> = {
  WIDGET: 'Widget',
  INBOUND: 'Phone',
  OUTBOUND: 'Outbound',
}

const CHANNEL_COLORS: Record<string, string> = {
  WIDGET:   'oklch(55% 0.11 193)',
  INBOUND:  'oklch(55% 0.14 140)',
  OUTBOUND: 'oklch(55% 0.12 260)',
}

type TranscriptEntry = { role: 'user' | 'assistant'; text: string; timestamp: number }

export default function ConversationsPage() {
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [channelFilter, setChannelFilter] = useState('')
  const [page, setPage] = useState(1)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    setRecordingUrl(null)
    if (!selected?.id || selected.recordingStatus !== 'stored') return
    let objectUrl: string | null = null
    setRecordingLoading(true)
    apiFetchRaw(`/api/conversations/${selected.id}/recording`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.blob()
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setRecordingUrl(objectUrl)
      })
      .catch(() => setRecordingUrl(null))
      .finally(() => setRecordingLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selected?.id])
  const limit = 20

  const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) })
  if (channelFilter) params.set('channelType', channelFilter)

  const { data, loading } = useApi<ConversationsResponse>(`/api/conversations?${params}`)
  const conversations = data?.items ?? []
  const total = data?.total ?? 0

  let transcript: TranscriptEntry[] = []
  if (selected?.transcriptJson && Array.isArray(selected.transcriptJson)) {
    transcript = selected.transcriptJson
  } else if (selected?.transcriptRef) {
    try { transcript = JSON.parse(selected.transcriptRef) } catch { /* ignore */ }
  }

  function formatDuration(start: string, end: string | null) {
    if (!end) return '—'
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    return `${Math.floor(secs / 60)}m ${secs % 60}s`
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Conversations</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Transcripts and summaries from widget, inbound, and outbound sessions.
      </p>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {['', 'WIDGET', 'INBOUND', 'OUTBOUND'].map((ch) => (
          <button
            key={ch}
            onClick={() => { setChannelFilter(ch); setPage(1) }}
            className="px-3 py-1.5 text-xs rounded-lg border transition-colors"
            style={
              channelFilter === ch
                ? { background: 'oklch(55% 0.11 193)', borderColor: 'oklch(55% 0.11 193)', color: '#fff' }
                : { background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }
            }
          >
            {ch || 'All channels'}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No conversations yet.</div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              {conversations.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: selected?.id === c.id ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                    borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: CHANNEL_COLORS[c.channelType] + '22', color: CHANNEL_COLORS[c.channelType] }}
                    >
                      {CHANNEL_LABELS[c.channelType]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(c.startedAt).toLocaleString()}
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
                    <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>No summary</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  Next
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
                {CHANNEL_LABELS[selected.channelType]}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <div className="mb-3 space-y-1">
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {new Date(selected.startedAt).toLocaleString()}
                {selected.endedAt && ` · ${formatDuration(selected.startedAt, selected.endedAt)}`}
              </div>
            </div>

            {/* Recording player */}
            {selected.recordingStatus === 'stored' && (
              <div className="mb-4">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6"/><path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" stroke="none"/>
                  </svg>
                  Recording
                </div>
                {recordingLoading && (
                  <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
                )}
                {!recordingLoading && recordingUrl && (
                  <audio
                    ref={audioRef}
                    src={recordingUrl}
                    controls
                    style={{ width: '100%', height: '36px', accentColor: 'oklch(55% 0.11 193)' }}
                  />
                )}
                {!recordingLoading && !recordingUrl && (
                  <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>Recording not available yet.</div>
                )}
              </div>
            )}

            {selected.summaryText && (
              <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>
                <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Summary</div>
                {selected.summaryText}
              </div>
            )}

            {transcript.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Transcript</div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transcript.map((entry, i) => (
                    <div key={i} className={`text-xs p-2 rounded-lg ${entry.role === 'user' ? 'text-right' : ''}`}
                      style={{
                        background: entry.role === 'user' ? 'oklch(55% 0.11 193 / 0.15)' : 'var(--surface-sunken)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div className="font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                        {entry.role === 'user' ? 'Caller' : 'Agent'}
                      </div>
                      {entry.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transcript.length === 0 && !selected.summaryText && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No transcript available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
