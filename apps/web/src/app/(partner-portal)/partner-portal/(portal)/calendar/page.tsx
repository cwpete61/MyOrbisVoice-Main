'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

/**
 * Phase E.1 — Partner-portal calendar view.
 *
 * Shows the partner's connected Google Calendar (the one wired up in E.0)
 * with two view modes: week-grid (default) and agenda-list. Events created
 * by MyOrbisVoice (extendedProperties.private.source = 'myorbisvoice')
 * get a brand-colored badge so the partner can tell at a glance which slots
 * came from the voice agent vs the rest of their schedule.
 */

type CalendarEvent = {
  id:       string | null
  title:    string
  start:    string | null
  end:      string | null
  allDay:   boolean
  location: string | null
  attendees:{ email?: string | null; name: string | null; response: string | null }[]
  organizerEmail: string | null
  htmlLink: string | null
  source:   'myorbisvoice' | 'external'
}

type EventsResponse = {
  events:       CalendarEvent[]
  notConnected: boolean
  calendarId:   string | null
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default function PartnerCalendarPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [view, setView]       = useState<'week' | 'agenda'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [data, setData]       = useState<EventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const from = weekStart.toISOString()
    const to   = weekEnd.toISOString()
    apiFetch<EventsResponse>(`/api/partner/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setData)
      .catch(e => setError((e as Error).message ?? t('partnerCalendar.loadFailed')))
      .finally(() => setLoading(false))
  }, [weekStart])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Group events by ISO date in the user's tz so day columns line up correctly
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of data?.events ?? []) {
      if (!e.start) continue
      const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(e.start))
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(e)
    }
    return map
  }, [data, tz])

  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)

  if (data?.notConnected) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCalendar.title')}</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerCalendar.notConnectedTitle')}</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCalendar.notConnectedBody')}</p>
          <Link href="/partner-portal/profile" className="inline-block px-4 py-2 rounded-md text-xs font-semibold" style={{ background: 'var(--brand-500)', color: '#fff' }}>
            {t('partnerCalendar.connectCta')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('partnerCalendar.title')}</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden text-xs" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['week', 'agenda'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5"
                style={{
                  background: view === v ? 'var(--brand-500)' : 'transparent',
                  color:      view === v ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {v === 'week' ? t('partnerCalendar.viewWeek') : t('partnerCalendar.viewAgenda')}
              </button>
            ))}
          </div>
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-2 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              aria-label={t('partnerCalendar.prevWeek')}
            >‹</button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              {t('partnerCalendar.today')}
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-2 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              aria-label={t('partnerCalendar.nextWeek')}
            >›</button>
          </div>
        </div>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerCalendar.calendarHint').replace('{calendar}', data?.calendarId ?? '…')}
      </p>

      {loading && (
        <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCalendar.loading')}</div>
      )}
      {error && (
        <div className="text-sm p-3 rounded-lg" style={{ color: 'oklch(60% 0.2 30)', background: 'oklch(60% 0.2 30 / 0.10)' }}>
          {error}
        </div>
      )}

      {!loading && !error && view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => {
            const isToday = dayKey(d) === dayKey(new Date())
            const dayEvents = (eventsByDay[dayKey(d)] ?? []).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
            return (
              <div
                key={d.toISOString()}
                className="rounded-lg p-2 min-h-[160px]"
                style={{
                  background: isToday ? 'oklch(55% 0.11 193 / 0.08)' : 'var(--surface-raised)',
                  border:     '1px solid ' + (isToday ? 'oklch(55% 0.11 193 / 0.40)' : 'var(--border-subtle)'),
                }}
              >
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  {formatInTimezone(d, { tz, locale: dateLocale, weekday: 'short' })}
                </div>
                <div className="text-sm font-bold mb-2" style={{ color: isToday ? 'oklch(55% 0.11 193)' : 'var(--text-primary)' }}>
                  {formatInTimezone(d, { tz, locale: dateLocale, day: 'numeric' })}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.length === 0 && (
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>—</div>
                  )}
                  {dayEvents.map(e => (
                    <a
                      key={e.id ?? Math.random()}
                      href={e.htmlLink ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-1.5 py-1 rounded text-[11px] truncate"
                      style={{
                        background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193 / 0.18)' : 'oklch(70% 0.05 260 / 0.18)',
                        color:      'var(--text-primary)',
                        borderLeft: '2px solid ' + (e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)'),
                      }}
                      title={e.title + (e.location ? ' — ' + e.location : '')}
                    >
                      {!e.allDay && (
                        <span style={{ opacity: 0.7 }}>
                          {formatInTimezone(e.start, { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}{' '}
                        </span>
                      )}
                      {e.title}
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && view === 'agenda' && (
        <div className="space-y-2">
          {(data?.events ?? []).length === 0 && (
            <div className="text-sm rounded-lg p-4 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
              {t('partnerCalendar.empty')}
            </div>
          )}
          {(data?.events ?? []).map(e => (
            <a
              key={e.id ?? Math.random()}
              href={e.htmlLink ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg p-3 flex items-start gap-3"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-1 self-stretch rounded"
                style={{ background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {e.allDay
                    ? formatInTimezone(e.start, { tz, locale: dateLocale, weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + t('partnerCalendar.allDay')
                    : <>
                        {formatInTimezone(e.start, { tz, locale: dateLocale, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {e.end && ' – ' + formatInTimezone(e.end, { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                      </>
                  }
                </div>
                {e.location && <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>📍 {e.location}</div>}
                {e.source === 'myorbisvoice' && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(55% 0.11 193)' }}>
                    {t('partnerCalendar.bookedByOrby')}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
