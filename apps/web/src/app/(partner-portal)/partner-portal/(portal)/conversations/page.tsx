'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

const TEAL = 'oklch(55% 0.11 193)'

interface ConversationListItem {
  id:                    string
  channelType:           string
  startedAt:             string
  endedAt:               string | null
  status:                string
  summary:               string | null
  outcomeCode:           string | null
  hasRecording:          boolean
  recordingDurationSecs: number | null
  contact:               { id: string; fullName: string | null; firstName: string | null; email: string | null; phoneE164: string | null } | null
  appointmentCount:      number
}

interface ListResponse {
  items:  ConversationListItem[]
  total:  number
  limit:  number
  offset: number
}

const OUTCOME_PILL: Record<string, { bg: string; fg: string }> = {
  BOOKED:             { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)' },
  CALLBACK_REQUESTED: { bg: 'oklch(95% 0.05 75)',  fg: 'oklch(50% 0.15 75)' },
  INFO_REQUEST:       { bg: 'oklch(95% 0.04 193)', fg: TEAL },
  QUALIFIED_LEAD:     { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)' },
  MISSED_CALL:        { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(50% 0.15 25)' },
}

export default function PartnerConversationsPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<ListResponse>('/api/partner/conversations?limit=50')
      .then(setData)
      .catch(e => setError((e as Error).message ?? 'load_failed'))
      .finally(() => setLoading(false))
  }, [])

  function formatDuration(secs: number | null): string {
    if (!secs || secs < 1) return '—'
    const mins = Math.floor(secs / 60)
    const rem  = secs % 60
    return `${mins}:${String(rem).padStart(2, '0')}`
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('partnerConversations.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('partnerConversations.subtitle')}
        </p>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      )}

      {error && <div className="alert-error">{t('partnerConversations.loadFailed')}</div>}

      {!loading && !error && items.length === 0 && (
        <div
          className="rounded-xl px-6 py-14 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'oklch(19% 0.04 193)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(55% 0.11 193)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerConversations.empty.heading')}</p>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.empty.body')}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.totalLabel', { n: data?.total ?? items.length })}
          </p>

          <div className="space-y-2">
            {items.map(c => {
              const outcomePill = c.outcomeCode ? OUTCOME_PILL[c.outcomeCode] : null
              const contactLabel = c.contact?.fullName ?? c.contact?.email ?? c.contact?.phoneE164 ?? t('partnerConversations.anonymousCaller')

              return (
                <Link
                  key={c.id}
                  href={`/partner-portal/conversations/${c.id}`}
                  className="block rounded-xl px-5 py-4 transition-colors"
                  style={{
                    background: 'var(--surface-raised)',
                    border:     '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {contactLabel}
                        </span>
                        {outcomePill && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: outcomePill.bg, color: outcomePill.fg }}>
                            {c.outcomeCode}
                          </span>
                        )}
                        {c.appointmentCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'oklch(95% 0.05 145)', color: 'oklch(45% 0.15 145)' }}>
                            {t('partnerConversations.bookedBadge', { n: c.appointmentCount })}
                          </span>
                        )}
                        {c.hasRecording && (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            ▸ {formatDuration(c.recordingDurationSecs)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {formatInTimezone(new Date(c.startedAt), { tz, locale: dateLocale, weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {formatInTimezone(new Date(c.startedAt), { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {c.channelType.toLowerCase()}
                      </p>
                      {c.summary && (
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {c.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
