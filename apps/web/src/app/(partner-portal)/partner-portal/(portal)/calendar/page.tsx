'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

/**
 * Phase E.1 — Partner-portal calendar view.
 *
 * Four views over the partner's connected Google Calendar (the one wired up
 * in E.0): Day (hourly grid), Week (7-column grid, default), Month (6×7 grid
 * with up to 3 events per cell), Agenda (chronological list).
 *
 * Events that came from the Orby agent (extendedProperties.private.source =
 * 'myorbisvoice') are visually badged so the partner can tell at a glance
 * which slots came from the voice widget vs the rest of their schedule.
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

type View = 'day' | 'week' | 'month' | 'agenda'

// ─── Date helpers (work in local tz; we display via formatInTimezone) ─────────
function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d); x.setDate(1); return x
}
function startOfMonthGrid(d: Date): Date {
  // First day of the calendar grid for the month containing d: the Sunday
  // on or before the first of the month. Always returns a date such that
  // adding 42 days covers ≥ the entire month.
  return startOfWeek(startOfMonth(d))
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d); x.setMonth(x.getMonth() + n); return x
}

// Day view time grid: 7am → 9pm (15-hour window covers nearly all booking activity).
const DAY_VIEW_START_HOUR = 7
const DAY_VIEW_END_HOUR   = 21
const HOUR_PX             = 44
const DAY_VIEW_HEIGHT     = (DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR) * HOUR_PX

export default function PartnerCalendarPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [view, setView]            = useState<View>('week')
  const [focusDate, setFocusDate]  = useState<Date>(() => startOfDay(new Date()))
  const [data, setData]            = useState<EventsResponse | null>(null)
  const [loading, setLoading]      = useState(true)
  const [error, setError]          = useState<string | null>(null)

  // Per-view date range for the API fetch. Stable refs so the effect only fires
  // when the relevant boundaries actually change.
  const { rangeFrom, rangeTo, rangeLabel } = useMemo(() => {
    if (view === 'day') {
      const from = startOfDay(focusDate)
      const to   = addDays(from, 1)
      return { rangeFrom: from, rangeTo: to,
               rangeLabel: formatInTimezone(from, { tz, locale: dateLocale, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
    }
    if (view === 'month') {
      const from = startOfMonthGrid(focusDate)
      const to   = addDays(from, 42)
      return { rangeFrom: from, rangeTo: to,
               rangeLabel: formatInTimezone(startOfMonth(focusDate), { tz, locale: dateLocale, month: 'long', year: 'numeric' }) }
    }
    // week + agenda: 7-day window
    const from = startOfWeek(focusDate)
    const to   = addDays(from, 7)
    return { rangeFrom: from, rangeTo: to,
             rangeLabel: formatInTimezone(from, { tz, locale: dateLocale, month: 'short', day: 'numeric' })
                       + ' – '
                       + formatInTimezone(addDays(to, -1), { tz, locale: dateLocale, month: 'short', day: 'numeric', year: 'numeric' }) }
  }, [view, focusDate, tz, dateLocale])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = `/api/partner/calendar/events?from=${encodeURIComponent(rangeFrom.toISOString())}&to=${encodeURIComponent(rangeTo.toISOString())}`
    apiFetch<EventsResponse>(url)
      .then(setData)
      .catch(e => setError((e as Error).message ?? t('partnerCalendar.loadFailed')))
      .finally(() => setLoading(false))
  }, [rangeFrom.toISOString(), rangeTo.toISOString()])

  // Day-key (yyyy-mm-dd in user tz) helper — used to group events into day buckets
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)

  // Group events by their day in the user's tz so the right events land in the right cell.
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of data?.events ?? []) {
      if (!e.start) continue
      const k = dayKey(new Date(e.start))
      if (!map[k]) map[k] = []
      map[k].push(e)
    }
    // sort each day chronologically
    for (const k of Object.keys(map)) {
      const list = map[k]
      if (list) list.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    }
    return map
  }, [data, tz])

  // Step delta: day=1d, week=7d, month=1mo, agenda=7d
  function navigate(delta: -1 | 1) {
    if (view === 'day')   setFocusDate(addDays(focusDate, delta))
    else if (view === 'month') setFocusDate(addMonths(focusDate, delta))
    else setFocusDate(addDays(focusDate, delta * 7))
  }

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
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('partnerCalendar.title')}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden text-xs" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['day', 'week', 'month', 'agenda'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5"
                style={{
                  background: view === v ? 'var(--brand-500)' : 'transparent',
                  color:      view === v ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {t('partnerCalendar.view' + v.charAt(0).toUpperCase() + v.slice(1))}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-2 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              aria-label={t('partnerCalendar.prev')}
            >‹</button>
            <button
              onClick={() => setFocusDate(startOfDay(new Date()))}
              className="px-3 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              {t('partnerCalendar.today')}
            </button>
            <button
              onClick={() => navigate(1)}
              className="px-2 py-1 rounded text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              aria-label={t('partnerCalendar.next')}
            >›</button>
          </div>
        </div>
      </div>

      <p className="text-[11px] mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerCalendar.calendarHint').replace('{calendar}', data?.calendarId ?? '…')}
      </p>

      {loading && <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCalendar.loading')}</div>}
      {error   && <div className="text-sm p-3 rounded-lg" style={{ color: 'oklch(60% 0.2 30)', background: 'oklch(60% 0.2 30 / 0.10)' }}>{error}</div>}

      {!loading && !error && view === 'day'   && <DayView day={focusDate} events={eventsByDay[dayKey(focusDate)] ?? []} tz={tz} dateLocale={dateLocale} t={t} />}
      {!loading && !error && view === 'week'  && <WeekView weekStart={startOfWeek(focusDate)} eventsByDay={eventsByDay} tz={tz} dateLocale={dateLocale} dayKey={dayKey} />}
      {!loading && !error && view === 'month' && <MonthView monthStart={startOfMonth(focusDate)} eventsByDay={eventsByDay} tz={tz} dateLocale={dateLocale} dayKey={dayKey} onDayClick={(d) => { setFocusDate(d); setView('day') }} t={t} />}
      {!loading && !error && view === 'agenda' && <AgendaView events={data?.events ?? []} tz={tz} dateLocale={dateLocale} t={t} />}
    </div>
  )
}

// ─── Day view ────────────────────────────────────────────────────────────────
// Single column, hourly time grid 7am → 9pm. Events positioned absolutely by
// start-time. All-day events stack at the top.
function DayView({ day, events, tz, dateLocale, t }: {
  day: Date; events: CalendarEvent[]; tz: string; dateLocale: string; t: (k: string) => string
}) {
  const allDay  = events.filter(e => e.allDay)
  const timed   = events.filter(e => !e.allDay)

  function eventStyle(e: CalendarEvent): React.CSSProperties {
    if (!e.start || !e.end) return { display: 'none' }
    const start = new Date(e.start)
    const end   = new Date(e.end)
    // Get hours-from-midnight in user tz by formatting to HH:MM then parsing
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(start)
    const hStart = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
    const mStart = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
    const durMs  = end.getTime() - start.getTime()
    const durHr  = Math.max(0.25, durMs / (1000 * 60 * 60))
    const topPx  = Math.max(0, (hStart + mStart / 60 - DAY_VIEW_START_HOUR) * HOUR_PX)
    const height = durHr * HOUR_PX - 2
    return { position: 'absolute', top: topPx + 'px', height: height + 'px', left: '52px', right: '4px' }
  }

  const hours = Array.from({ length: DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR + 1 }, (_, i) => DAY_VIEW_START_HOUR + i)

  return (
    <div className="rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      {allDay.length > 0 && (
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCalendar.allDay')}</div>
          <div className="flex flex-wrap gap-1.5">
            {allDay.map(e => (
              <a key={e.id ?? Math.random()} href={e.htmlLink ?? '#'} target="_blank" rel="noopener noreferrer"
                 className="px-2 py-0.5 rounded text-[11px]"
                 style={{ background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193 / 0.18)' : 'oklch(70% 0.05 260 / 0.18)', color: 'var(--text-primary)' }}>
                {e.title}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="relative" style={{ height: DAY_VIEW_HEIGHT + 'px' }}>
        {/* hour grid */}
        {hours.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 flex items-start"
               style={{ top: (i * HOUR_PX) + 'px', height: HOUR_PX + 'px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
            <div className="w-12 text-right pr-2 pt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {formatInTimezone(new Date(2026, 0, 1, h, 0), { tz: undefined, locale: dateLocale, hour: 'numeric' })}
            </div>
          </div>
        ))}
        {/* timed events */}
        {timed.map(e => (
          <a key={e.id ?? Math.random()} href={e.htmlLink ?? '#'} target="_blank" rel="noopener noreferrer"
             style={eventStyle(e)}
             className="rounded text-[11px] px-1.5 py-1 overflow-hidden"
             title={e.title + (e.location ? ' — ' + e.location : '')}>
            <div className="font-semibold truncate" style={{ color: 'var(--text-primary)',
              background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193 / 0.22)' : 'oklch(70% 0.05 260 / 0.22)',
              borderLeft: '2px solid ' + (e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)'),
              padding: '4px 6px',
              borderRadius: '4px',
              height: '100%',
            }}>
              <div className="text-[10px] opacity-70">
                {formatInTimezone(e.start, { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                {e.end && ' – ' + formatInTimezone(e.end, { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
              </div>
              <div className="truncate">{e.title}</div>
            </div>
          </a>
        ))}
        {timed.length === 0 && allDay.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerCalendar.emptyDay')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Week view ───────────────────────────────────────────────────────────────
function WeekView({ weekStart, eventsByDay, tz, dateLocale, dayKey }: {
  weekStart: Date; eventsByDay: Record<string, CalendarEvent[]>; tz: string; dateLocale: string; dayKey: (d: Date) => string
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(d => {
        const isToday = dayKey(d) === dayKey(new Date())
        const dayEvents = eventsByDay[dayKey(d)] ?? []
        return (
          <div key={d.toISOString()}
               className="rounded-lg p-2 min-h-[160px]"
               style={{
                 background: isToday ? 'oklch(55% 0.11 193 / 0.08)' : 'var(--surface-raised)',
                 border:     '1px solid ' + (isToday ? 'oklch(55% 0.11 193 / 0.40)' : 'var(--border-subtle)'),
               }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
              {formatInTimezone(d, { tz, locale: dateLocale, weekday: 'short' })}
            </div>
            <div className="text-sm font-bold mb-2" style={{ color: isToday ? 'oklch(55% 0.11 193)' : 'var(--text-primary)' }}>
              {formatInTimezone(d, { tz, locale: dateLocale, day: 'numeric' })}
            </div>
            <div className="space-y-1.5">
              {dayEvents.length === 0 && <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>—</div>}
              {dayEvents.map(e => (
                <a key={e.id ?? Math.random()} href={e.htmlLink ?? '#'} target="_blank" rel="noopener noreferrer"
                   className="block px-1.5 py-1 rounded text-[11px] truncate"
                   style={{
                     background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193 / 0.18)' : 'oklch(70% 0.05 260 / 0.18)',
                     color: 'var(--text-primary)',
                     borderLeft: '2px solid ' + (e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)'),
                   }}
                   title={e.title + (e.location ? ' — ' + e.location : '')}>
                  {!e.allDay && <span style={{ opacity: 0.7 }}>{formatInTimezone(e.start, { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })} </span>}
                  {e.title}
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Month view ──────────────────────────────────────────────────────────────
// 6×7 grid starting from the Sunday on or before the 1st of the focus month.
// Up to 3 events per cell, then "+N more" link. Click any day to jump to Day view.
function MonthView({ monthStart, eventsByDay, tz, dateLocale, dayKey, onDayClick, t }: {
  monthStart: Date; eventsByDay: Record<string, CalendarEvent[]>; tz: string; dateLocale: string;
  dayKey: (d: Date) => string; onDayClick: (d: Date) => void; t: (k: string) => string
}) {
  const gridStart = startOfMonthGrid(monthStart)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const monthIndex = monthStart.getMonth()
  // Weekday header — use a known Sunday so the labels render correctly
  const sundayRef = startOfWeek(new Date(2026, 0, 4))   // Sun Jan 4 2026
  const headers = Array.from({ length: 7 }, (_, i) => addDays(sundayRef, i))

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {headers.map(d => (
          <div key={d.toISOString()} className="text-center text-[10px] uppercase tracking-wide py-1" style={{ color: 'var(--text-tertiary)' }}>
            {formatInTimezone(d, { tz, locale: dateLocale, weekday: 'short' })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(d => {
          const inMonth = d.getMonth() === monthIndex
          const isToday = dayKey(d) === dayKey(new Date())
          const dayEvents = eventsByDay[dayKey(d)] ?? []
          const shown   = dayEvents.slice(0, 3)
          const overflow = dayEvents.length - shown.length
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              className="text-left rounded-md p-1.5 min-h-[88px] flex flex-col gap-1 transition-colors"
              style={{
                background: isToday ? 'oklch(55% 0.11 193 / 0.10)' : 'var(--surface-raised)',
                border:     '1px solid ' + (isToday ? 'oklch(55% 0.11 193 / 0.40)' : 'var(--border-subtle)'),
                opacity:    inMonth ? 1 : 0.5,
                cursor:     'pointer',
              }}
              title={t('partnerCalendar.clickToDay')}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={{ color: isToday ? 'oklch(55% 0.11 193)' : 'var(--text-primary)' }}>
                  {formatInTimezone(d, { tz, locale: dateLocale, day: 'numeric' })}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {shown.map(e => (
                  <div key={e.id ?? Math.random()}
                       className="text-[10px] truncate px-1 rounded"
                       style={{
                         background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193 / 0.18)' : 'oklch(70% 0.05 260 / 0.14)',
                         color: 'var(--text-primary)',
                         borderLeft: '2px solid ' + (e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)'),
                       }}
                       title={e.title}>
                    {e.title}
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    +{overflow} {t('partnerCalendar.more')}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Agenda view (chronological list) ────────────────────────────────────────
function AgendaView({ events, tz, dateLocale, t }: {
  events: CalendarEvent[]; tz: string; dateLocale: string; t: (k: string) => string
}) {
  if (events.length === 0) {
    return (
      <div className="text-sm rounded-lg p-4 text-center"
           style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        {t('partnerCalendar.empty')}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {events.map(e => (
        <a key={e.id ?? Math.random()} href={e.htmlLink ?? '#'} target="_blank" rel="noopener noreferrer"
           className="block rounded-lg p-3 flex items-start gap-3"
           style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="w-1 self-stretch rounded"
               style={{ background: e.source === 'myorbisvoice' ? 'oklch(55% 0.11 193)' : 'oklch(60% 0.05 260)' }} />
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
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(55% 0.11 193)' }}>
                {t('partnerCalendar.bookedByOrby')}
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}
