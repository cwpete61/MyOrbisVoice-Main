'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT, type Locale } from '@/lib/i18n/I18nProvider'
import { getBrowserTimezone } from '@/lib/timezone'

// Phase E.4 — public prospect booking page.
//
// Three-state UI:
//   1. loading  — initial booking-info fetch in flight
//   2. picking  — date picker + slot grid + contact form
//   3. booked   — confirmation screen with the appointment details
//
// All copy goes through useT(); the toggle in the header flips between
// en + es. Mounted on app.myorbisvoice.com/book/<slug> (linked to from the
// marketing site partner pages).

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
  timezone:        string | null
  openDays:        Record<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat', boolean>
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

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const t = useT()

  // Local locale state — separate from the I18nProvider for now so the
  // toggle on this public page works without touching the rest of the app.
  // We DO call setLocale() through the provider, which flips global state.
  const { setLocale } = useLocale()

  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tz] = useState<string>(getBrowserTimezone())

  const [selectedDate, setSelectedDate] = useState<string | null>(null) // YYYY-MM-DD in tz
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

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

  // ── Date list — next N days where the partner has hours configured ──────
  const dayOptions = useMemo(() => {
    if (!info) return []
    const out: Array<{ date: string; iso: string; weekdayShort: string; dayNum: string; openDay: boolean }> = []
    const now = new Date()
    const max = Math.min(info.maxAdvanceDays, 30)
    for (let i = 0; i <= max; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const shortKey = SHORT_DAYS[d.getDay()]!
      const openDay = info.openDays[shortKey]
      out.push({
        date: iso,
        iso,
        weekdayShort: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: String(d.getDate()),
        openDay,
      })
    }
    return out
  }, [info])

  // ── Fetch slots whenever a date is picked ───────────────────────────────
  useEffect(() => {
    if (!selectedDate || !info) return
    setSlotsLoading(true)
    setSlotsError(null)
    setSelectedSlot(null)

    const dayStart = new Date(`${selectedDate}T00:00:00`)
    const dayEnd   = new Date(`${selectedDate}T23:59:59`)
    const qs = new URLSearchParams({
      from:     dayStart.toISOString(),
      to:       dayEnd.toISOString(),
      timezone: tz,
    })

    apiFetch<{ slots: Slot[]; timezone: string; durationMin: number }>(
      `/api/public/partners/${encodeURIComponent(slug)}/slots?${qs.toString()}`,
    )
      .then(d => setSlots(d.slots))
      .catch(e => setSlotsError((e as Error).message ?? 'slots_failed'))
      .finally(() => setSlotsLoading(false))
  }, [selectedDate, info, slug, tz])

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
        <PartnerHeader info={info} t={t} />
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

  return (
    <Shell setLocale={setLocale}>
      <PartnerHeader info={info} t={t} />

      {!info.calendarReady && (
        <div className="rounded-lg px-4 py-3 mb-4 text-sm"
             style={{ background: 'oklch(60% 0.2 30 / 0.15)', border: '1px solid oklch(60% 0.2 30 / 0.40)', color: 'oklch(55% 0.20 30)' }}>
          {t('publicBooking.calendarNotReady')}
        </div>
      )}

      <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {t('publicBooking.pickDate')}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {dayOptions.map(d => (
          <button
            key={d.iso}
            disabled={!d.openDay}
            onClick={() => setSelectedDate(d.iso)}
            className="flex-shrink-0 rounded-lg px-3 py-2 text-center w-16"
            style={{
              background: selectedDate === d.iso
                ? 'var(--brand-500)'
                : d.openDay ? 'var(--surface-raised)' : 'transparent',
              border: '1px solid ' + (selectedDate === d.iso ? 'var(--brand-500)' : 'var(--border-subtle)'),
              color: selectedDate === d.iso ? '#fff' : d.openDay ? 'var(--text-primary)' : 'var(--text-tertiary)',
              opacity: d.openDay ? 1 : 0.35,
              cursor: d.openDay ? 'pointer' : 'not-allowed',
            }}
          >
            <div className="text-xs uppercase">{d.weekdayShort}</div>
            <div className="text-lg font-bold">{d.dayNum}</div>
          </button>
        ))}
      </div>

      {selectedDate && (
        <>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('publicBooking.pickTime')}
          </h2>
          {slotsLoading && (
            <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>{t('publicBooking.loadingSlots')}</p>
          )}
          {slotsError && (
            <p className="text-xs mb-4" style={{ color: 'oklch(60% 0.2 30)' }}>{slotsError}</p>
          )}
          {!slotsLoading && slots && slots.length === 0 && (
            <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>{t('publicBooking.noSlots')}</p>
          )}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
              {slots.map(s => {
                const isSel = selectedSlot?.startAt === s.startAt
                const time = new Date(s.startAt).toLocaleTimeString(undefined, {
                  hour: 'numeric', minute: '2-digit', timeZone: tz,
                })
                return (
                  <button
                    key={s.startAt}
                    onClick={() => setSelectedSlot(s)}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: isSel ? 'var(--brand-500)' : 'var(--surface-raised)',
                      border:     '1px solid ' + (isSel ? 'var(--brand-500)' : 'var(--border-subtle)'),
                      color:      isSel ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedSlot && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('publicBooking.yourDetails')}
          </h2>
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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
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
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function PartnerHeader({ info, t }: { info: BookingInfo; t: (k: string, v?: Record<string, string|number>) => string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
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
          {t('publicBooking.bookWith', { name: info.displayName })}
        </h1>
        {info.businessName && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{info.businessName}</p>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {t('publicBooking.slotDurationLabel', { min: info.slotDurationMin })}
        </p>
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
        {label}{optional && <span style={{ color: 'var(--text-tertiary)' }}> ({/* optional */}—)</span>}
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

// Local helper — only exists so the file can call setLocale from the
// I18nProvider without re-implementing the hook. The provider exposes it
// only through useT() / its context, so we read the context directly.
import { useContext } from 'react'
import { I18nContext } from '@/lib/i18n/I18nProvider'
function useLocale() {
  // I18nContext is the named export added to I18nProvider — see the patch
  // alongside this file. Falls back to a no-op setLocale outside provider.
  const ctx = useContext(I18nContext)
  return { setLocale: ctx?.setLocale ?? (() => {}) }
}
