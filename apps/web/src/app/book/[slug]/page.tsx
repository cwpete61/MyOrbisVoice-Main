'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale, type Locale } from '@/lib/i18n/I18nProvider'
import { getBrowserTimezone } from '@/lib/timezone'

// Phase E.4 / E.8 — public prospect booking page.
//
// Layout (matches the Google Calendar appointment-scheduling pattern):
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Partner header (avatar · name · business name)               │
//   │ Business-Hours metadata block (duration · invite · services) │
//   ├──────────────┬───────────────────────────────────────────────┤
//   │ Mini month   │ Timezone label                       ← week → │
//   │  calendar    │ ┌────┬────┬────┬────┬────┬────┬────┐         │
//   │  (clickable  │ │THU │FRI │SAT │SUN │MON │TUE │WED │         │
//   │   day jumps  │ │ 14 │ 15 │ 16 │ 17 │ 18 │ 19 │ 20 │         │
//   │   the 7-day  │ │1pm │1pm │ —  │ —  │1pm │1pm │1pm │         │
//   │   window)    │ │2pm │2pm │    │    │2pm │2pm │2pm │         │
//   │              │ │ …  │ …  │    │    │ …  │ …  │ …  │         │
//   │              │ └────┴────┴────┴────┴────┴────┴────┘         │
//   └──────────────┴───────────────────────────────────────────────┘
//
// Contact form drops in below the grid once a time is selected.
// Confirmation state replaces the whole picking pane.

type DayHours = { open: string; close: string; breakStart?: string; breakEnd?: string } | null
type ShortDay = 'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'

type BookingInfo = {
  slug:            string
  displayName:     string
  businessName:    string | null
  bio:             string | null
  avatarUrl:       string | null
  calendarReady:   boolean
  slotDurationMin: number
  minNoticeMin:    number
  maxAdvanceDays:  number
  bufferBeforeMin?: number
  bufferAfterMin?:  number
  timezone:        string | null
  openDays:        Record<ShortDay, boolean>
  hours?:          Record<ShortDay, DayHours>
}

type Slot = { startAt: string; endAt: string; available: boolean }

type BookingResp = {
  appointmentId: string
  status:        'PENDING' | 'CONFIRMED'
  startAt:       string
  endAt:         string
  timezone:      string
}

const SHORT_DAYS: Array<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'> = [
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
]

// ── Date utilities (timezone-agnostic where it doesn't matter) ────────────
// Helpers operate on Date objects in the browser's local timezone for UI
// math (week stepping, mini-calendar grid). Server-issued slot times stay
// in ISO and are formatted with the visitor's IANA tz only when displayed.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function isoDateInTz(d: Date | string, tz: string): string {
  // en-CA renders YYYY-MM-DD which is what we use as the grouping key.
  return new Date(d).toLocaleDateString('en-CA', { timeZone: tz })
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

/** "(GMT-04:00) Eastern Time - New York" — mirrors the format Google's
 *  scheduling page shows. Built from Intl so locale + DST are correct. */
function formatTimezoneLabel(tz: string, locale: string): string {
  try {
    const now = new Date()
    // longOffset → "GMT-04:00"
    const offsetParts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(now)
    const offset = offsetParts.find(p => p.type === 'timeZoneName')?.value ?? ''
    // long → "Eastern Daylight Time"
    const longParts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'long' })
      .formatToParts(now)
    const long = longParts.find(p => p.type === 'timeZoneName')?.value ?? ''
    // City part — strip "America/New_York" → "New York"
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
    return `(${offset}) ${long} - ${city}`
  } catch {
    return tz
  }
}

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const t = useT()
  const { setLocale, locale } = useLocale()

  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tz] = useState<string>(getBrowserTimezone())

  // ── Week-window state ───────────────────────────────────────────────────
  // weekStart is the date in column 0 of the 7-day grid. Defaults to today;
  // navigation buttons step ±7 days.
  const today = useMemo(() => startOfDay(new Date()), [])
  const [weekStart, setWeekStart] = useState<Date>(today)

  // Mini-calendar month state — what month the left rail is showing. Defaults
  // to the month containing today; navigates independently of the week grid.
  const [calMonth, setCalMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1))

  // ── Slot fetch (covers the full 7-day window in one request) ────────────
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<BookingResp | null>(null)

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    apiFetch<BookingInfo>(`/api/public/partners/${encodeURIComponent(slug)}/booking-info`)
      .then(d => { if (!cancelled) setInfo(d) })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? 'load_failed') })
    return () => { cancelled = true }
  }, [slug])

  // ── Fetch slots for the visible 7-day window ────────────────────────────
  useEffect(() => {
    if (!info) return
    setSlotsLoading(true)
    setSlotsError(null)
    setSelectedSlot(null)

    const from = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0)
    const to   = addDays(from, 7)
    const qs = new URLSearchParams({
      from:     from.toISOString(),
      to:       to.toISOString(),
      timezone: tz,
    })

    apiFetch<{ slots: Slot[]; timezone: string; durationMin: number }>(
      `/api/public/partners/${encodeURIComponent(slug)}/slots?${qs.toString()}`,
    )
      .then(d => setSlots(d.slots))
      .catch(e => setSlotsError((e as Error).message ?? 'slots_failed'))
      .finally(() => setSlotsLoading(false))
  }, [info, slug, tz, weekStart])

  // ── Slots grouped by tz-day so the 7-day grid can render columns ───────
  const slotsByDay = useMemo<Record<string, Slot[]>>(() => {
    const out: Record<string, Slot[]> = {}
    for (const s of slots) {
      const key = isoDateInTz(s.startAt, tz)
      if (!out[key]) out[key] = []
      out[key].push(s)
    }
    return out
  }, [slots, tz])

  // ── The 7 days in the current week window ──────────────────────────────
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      return {
        date:     d,
        iso:      isoDateInTz(d, tz),
        weekday:  d.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase(),
        dayNum:   d.getDate(),
        isToday:  isSameDay(d, today),
        openDay:  info?.openDays[SHORT_DAYS[d.getDay()]!] ?? true,
        inRange:  d >= today && (info ? d <= addDays(today, info.maxAdvanceDays) : true),
      }
    })
  }, [weekStart, tz, locale, today, info])

  // ── Submit booking ──────────────────────────────────────────────────────
  async function submitBooking() {
    if (!selectedSlot || !info) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = await apiFetch<BookingResp>(`/api/public/partners/${encodeURIComponent(slug)}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone:    phone || undefined,
          startAt:  selectedSlot.startAt,
          endAt:    selectedSlot.endAt,
          timezone: tz,
          notes:    notes || undefined,
          appointmentType: 'Consultation',
        }),
      })
      setConfirmation(data)
    } catch (e: unknown) {
      setSubmitError((e as Error).message ?? t('publicBooking.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render branches ─────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Shell setLocale={setLocale}>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('publicBooking.notFound.title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('publicBooking.notFound.body')}
          </p>
        </div>
      </Shell>
    )
  }
  if (!info) {
    return (
      <Shell setLocale={setLocale}>
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 rounded-full border-2 animate-spin"
               style={{ borderColor: 'var(--brand-500)', borderTopColor: 'transparent' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>{t('publicBooking.loading')}</p>
        </div>
      </Shell>
    )
  }

  if (confirmation) {
    return (
      <Shell setLocale={setLocale}>
        <PartnerHeader info={info} />
        <div className="rounded-xl p-6 text-center" style={{ background: 'oklch(55% 0.18 145 / 0.12)', border: '1px solid oklch(55% 0.18 145 / 0.40)' }}>
          <div className="text-4xl mb-2">✓</div>
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('publicBooking.confirmed.title')}
          </h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('publicBooking.confirmed.body', { name: info.displayName })}
          </p>
          <div className="inline-block rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-primary)' }}>
              {new Date(confirmation.startAt).toLocaleString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                timeZone: tz,
              })}
            </div>
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>
            {t('publicBooking.confirmed.emailHint', { email })}
          </p>
        </div>
      </Shell>
    )
  }

  const tzLabel = formatTimezoneLabel(tz, locale)
  const maxDate = addDays(today, info.maxAdvanceDays)

  return (
    <Shell setLocale={setLocale}>
      <PartnerHeader info={info} />

      <BusinessHoursBlock info={info} t={t} locale={locale} />

      {!info.calendarReady && (
        <div className="rounded-lg px-4 py-3 mb-4 text-sm"
             style={{ background: 'oklch(60% 0.2 30 / 0.15)', border: '1px solid oklch(60% 0.2 30 / 0.40)', color: 'oklch(55% 0.20 30)' }}>
          {t('publicBooking.calendarNotReady')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mt-2">
        {/* Mini month calendar — left rail */}
        <div className="order-2 lg:order-1">
          <MiniCalendar
            month={calMonth}
            onMonthChange={setCalMonth}
            today={today}
            maxDate={maxDate}
            weekStart={weekStart}
            openDays={info.openDays}
            onPickDay={(d) => {
              setWeekStart(startOfDay(d))
              if (d.getMonth() !== calMonth.getMonth() || d.getFullYear() !== calMonth.getFullYear()) {
                setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1))
              }
            }}
            t={t}
            locale={locale}
          />
        </div>

        {/* Header + 7-day grid */}
        <div className="order-1 lg:order-2 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('publicBooking.selectTime')}
            </h2>
            <div className="text-xs text-right" style={{ color: 'var(--text-tertiary)' }}>
              {tzLabel}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              aria-label={t('publicBooking.prevWeek')}
              onClick={() => {
                const next = addDays(weekStart, -7)
                setWeekStart(next < today ? today : next)
              }}
              disabled={weekStart <= today}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              type="button"
              aria-label={t('publicBooking.nextWeek')}
              onClick={() => {
                const next = addDays(weekStart, 7)
                setWeekStart(next > maxDate ? weekStart : next)
              }}
              disabled={addDays(weekStart, 7) > maxDate}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* 7-day matrix — 7 columns on desktop, stacked on mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const daySlots = (slotsByDay[day.iso] ?? []).filter(s => s.available)
              const dayUsable = day.openDay && day.inRange
              return (
                <div key={day.iso} className="flex flex-col gap-1.5">
                  <div className="text-center mb-1">
                    <div
                      className="text-[11px] font-semibold tracking-wider uppercase"
                      style={{ color: day.isToday ? 'var(--brand-500)' : 'var(--text-tertiary)' }}
                    >
                      {day.weekday}
                    </div>
                    <div
                      className="text-lg font-bold inline-flex items-center justify-center"
                      style={day.isToday
                        ? {
                            background: 'var(--brand-500)',
                            color: '#fff',
                            width: 32, height: 32, borderRadius: '50%',
                            lineHeight: '32px',
                          }
                        : { color: 'var(--text-primary)' }}
                    >
                      {day.dayNum}
                    </div>
                  </div>

                  {!dayUsable || daySlots.length === 0 ? (
                    <div
                      className="text-center py-2 text-sm"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {slotsLoading ? '…' : t('publicBooking.noSlotsShort')}
                    </div>
                  ) : (
                    daySlots.map((s) => {
                      const isSel = selectedSlot?.startAt === s.startAt
                      const time = new Date(s.startAt).toLocaleTimeString(locale, {
                        hour: 'numeric', minute: '2-digit', timeZone: tz,
                      }).replace(/\s/g, '').toLowerCase() // "1:00pm"
                      return (
                        <button
                          key={s.startAt}
                          onClick={() => setSelectedSlot(s)}
                          className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                          style={{
                            background: isSel ? 'var(--brand-500)' : 'transparent',
                            border:     '1px solid ' + (isSel ? 'var(--brand-500)' : 'var(--border-subtle)'),
                            color:      isSel ? '#fff' : 'var(--brand-500)',
                          }}
                        >
                          {time}
                        </button>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>

          {slotsError && (
            <p className="text-xs mt-3" style={{ color: 'oklch(60% 0.2 30)' }}>{slotsError}</p>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="rounded-xl p-5 mt-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('publicBooking.yourDetails')}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedSlot(null)}
              className="text-xs underline"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('publicBooking.back')}
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {new Date(selectedSlot.startAt).toLocaleString(locale, {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
              timeZone: tz,
            })}
          </p>
          <FormField label={t('publicBooking.fields.name')} value={name} onChange={setName} placeholder={t('publicBooking.fields.namePlaceholder')} />
          <FormField label={t('publicBooking.fields.email')} value={email} onChange={setEmail} type="email" placeholder={t('publicBooking.fields.emailPlaceholder')} />
          <FormField label={t('publicBooking.fields.phone')} value={phone} onChange={setPhone} type="tel" placeholder={t('publicBooking.fields.phonePlaceholder')} optional />
          <FormField label={t('publicBooking.fields.notes')} value={notes} onChange={setNotes} placeholder={t('publicBooking.fields.notesPlaceholder')} multiline optional />

          {submitError && (
            <p className="text-xs mb-3 px-2 py-1 rounded" style={{ background: 'oklch(60% 0.2 30 / 0.15)', color: 'oklch(55% 0.20 30)' }}>
              {submitError}
            </p>
          )}

          <button
            onClick={submitBooking}
            disabled={submitting || !name.trim() || !email.trim()}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold"
            style={{
              background: 'var(--brand-500)', color: '#fff',
              opacity: (submitting || !name.trim() || !email.trim()) ? 0.5 : 1,
            }}
          >
            {submitting ? t('publicBooking.submitting') : t('publicBooking.submitCta')}
          </button>
        </div>
      )}
    </Shell>
  )
}

// ─── Shell + sub-components ──────────────────────────────────────────────────

function Shell({ children, setLocale }: { children: React.ReactNode; setLocale: (l: Locale) => void }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-app)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://myorbisvoice.com" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            MyOrbisVoice
          </a>
          <div className="flex gap-1">
            <button onClick={() => setLocale('en')} className="px-2 py-1 text-xs rounded"
                    style={{ color: 'var(--text-secondary)' }}>EN</button>
            <button onClick={() => setLocale('es')} className="px-2 py-1 text-xs rounded"
                    style={{ color: 'var(--text-secondary)' }}>ES</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function PartnerHeader({ info }: { info: BookingInfo }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      {info.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover"
             style={{ border: '1px solid var(--border-subtle)' }} />
      ) : (
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
             style={{ background: 'var(--brand-500)', color: '#fff' }}>
          {info.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {info.displayName}
        </h1>
        {info.businessName && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{info.businessName}</p>
        )}
      </div>
    </div>
  )
}

// Google-style metadata strip under the partner header: duration, calendar-
// invite line, services bullets (from the partner bio if present), plus the
// full booking-preferences schedule (per-day open/close, break window, notice
// + advance limits) so customers see exactly what the partner offers.
const HOUR_DAY_ORDER: ShortDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function formatClockTime(hhmm: string, locale: string): string {
  const [hh, mm] = hhmm.split(':').map(n => parseInt(n, 10))
  if (hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) return hhmm
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '').toLowerCase()
}

function formatNoticeLabel(min: number, t: (k: string, v?: Record<string, string|number>) => string): string {
  if (min < 60)       return t('publicBooking.noticeMinutes', { n: min })
  if (min % 60 === 0) return t('publicBooking.noticeHours',   { n: min / 60 })
  return t('publicBooking.noticeMinutes', { n: min })
}

function BusinessHoursBlock({
  info, t, locale,
}: {
  info: BookingInfo
  t: (k: string, v?: Record<string, string|number>) => string
  locale: string
}) {
  const services = (info.bio ?? '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4)

  // Map of day → label using the visitor's locale (Mon / Lun / …)
  const dayLabels: Record<ShortDay, string> = (() => {
    const ref = new Date(2024, 0, 1) // Monday
    const offset: Record<ShortDay, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const out = {} as Record<ShortDay, string>
    for (const d of HOUR_DAY_ORDER) {
      const dt = new Date(ref); dt.setDate(ref.getDate() + offset[d])
      out[d] = dt.toLocaleDateString(locale, { weekday: 'short' })
    }
    return out
  })()

  const hours = info.hours
  const anyHours = hours ? HOUR_DAY_ORDER.some(d => hours[d]) : false
  const closedLabel = t('publicBooking.dayClosed')

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {t('publicBooking.businessHours')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="flex items-start gap-2.5" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span>{t('publicBooking.durationLine', { min: info.slotDurationMin })}</span>
        </div>
        <div className="flex items-start gap-2.5" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <span>{t('publicBooking.inviteLine')}</span>
        </div>

        {/* Notice + advance limits — mirror booking preferences */}
        <div className="flex items-start gap-2.5" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l2 2"/><circle cx="12" cy="12" r="9"/>
            </svg>
          </span>
          <span>
            {formatNoticeLabel(info.minNoticeMin, t)}
            {' · '}
            {t('publicBooking.advanceLine', { n: info.maxAdvanceDays })}
          </span>
        </div>

        {/* Per-day open windows — only render when partner configured hours */}
        {anyHours && hours && (
          <div className="sm:col-span-2 rounded-lg px-3 py-2.5 mt-1"
               style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                 style={{ color: 'var(--text-tertiary)' }}>
              {t('publicBooking.weeklyHours')}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {HOUR_DAY_ORDER.map((d) => {
                const h = hours[d]
                return (
                  <li key={d} className="flex items-baseline justify-between gap-3 text-sm">
                    <span style={{ color: 'var(--text-tertiary)', minWidth: 36 }}>
                      {dayLabels[d]}
                    </span>
                    <span style={{ color: h ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {h ? (
                        <>
                          {formatClockTime(h.open, locale)} – {formatClockTime(h.close, locale)}
                          {h.breakStart && h.breakEnd && (
                            <span className="ml-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {' · '}
                              {t('publicBooking.breakLine', {
                                start: formatClockTime(h.breakStart, locale),
                                end:   formatClockTime(h.breakEnd,   locale),
                              })}
                            </span>
                          )}
                        </>
                      ) : closedLabel}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {services.length > 0 && (
          <ul className="sm:col-span-2 list-disc pl-5 space-y-0.5 mt-1" style={{ color: 'var(--text-secondary)' }}>
            {services.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

// Compact month calendar — left rail. Bolded numbers = days the partner has
// hours configured AND that fall inside the booking window; the day in the
// currently visible 7-day grid is ringed; today is filled brand.
function MiniCalendar({
  month, onMonthChange, today, maxDate, weekStart, openDays, onPickDay, t, locale,
}: {
  month:        Date
  onMonthChange: (d: Date) => void
  today:        Date
  maxDate:      Date
  weekStart:    Date
  openDays:     Record<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat', boolean>
  onPickDay:    (d: Date) => void
  t:            (k: string, v?: Record<string, string|number>) => string
  locale:       string
}) {
  // Build a 6×7 grid of dates anchored on the first Sunday on/before the 1st
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart    = addDays(firstOfMonth, -firstOfMonth.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  // Weekday header letters — derived from Intl so locale wins
  const weekHeaders = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(gridStart, i)
    return d.toLocaleDateString(locale, { weekday: 'narrow' })
  })

  const windowEnd = addDays(weekStart, 6)

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={t('publicBooking.prevMonth')}
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={firstOfMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}
            className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button"
            aria-label={t('publicBooking.nextMonth')}
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={firstOfMonth >= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)}
            className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
        {weekHeaders.map((h, i) => <div key={i}>{h.toUpperCase()}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-sm">
        {cells.map((d) => {
          const inMonth   = d.getMonth() === month.getMonth()
          const isToday   = isSameDay(d, today)
          const inWindow  = d >= weekStart && d <= windowEnd
          const inRange   = d >= today && d <= maxDate
          const dayOpen   = openDays[SHORT_DAYS[d.getDay()]!]
          const hasAvail  = inRange && dayOpen
          const isPickable = inRange
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => isPickable && onPickDay(d)}
              disabled={!isPickable}
              className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs"
              style={{
                background: isToday ? 'var(--brand-500)'
                          : inWindow ? 'oklch(72% 0.12 245 / 0.18)'
                          : 'transparent',
                color: isToday ? '#fff'
                     : !inMonth ? 'var(--text-tertiary)'
                     : !isPickable ? 'var(--text-tertiary)'
                     : 'var(--text-primary)',
                opacity: isPickable ? 1 : 0.4,
                fontWeight: hasAvail && !isToday ? 600 : 400,
                cursor: isPickable ? 'pointer' : 'not-allowed',
              }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text', multiline = false, optional = false }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
  optional?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}{optional && <span style={{ color: 'var(--text-tertiary)' }}> —</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      )}
    </div>
  )
}
