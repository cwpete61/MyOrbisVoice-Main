'use client'

import { useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { formatInTimezone } from '@/lib/timezone'

interface ReminderSummary {
  pending:        number
  sent:           number
  failed:         number
  cancelled:      number
  nextScheduledAt: string | null
  nextChannel:    'EMAIL' | 'SMS' | null
}

interface Appointment {
  id: string
  status: string
  appointmentType: string | null
  startAt: string
  endAt: string
  timezone: string
  location: string | null
  notes: string | null
  createdAt: string
  reminderSummary?: ReminderSummary
}

interface AppointmentsData {
  appointments: Appointment[]
  total: number
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  CONFIRMED:   { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)' },
  PENDING:     { bg: 'oklch(14% 0.04 75)',  text: 'oklch(70% 0.16 75)' },
  RESCHEDULED: { bg: 'oklch(14% 0.03 258)', text: 'oklch(72% 0.13 258)' },
  CANCELED:    { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
  FAILED:      { bg: 'oklch(13% 0.04 25)',  text: 'oklch(68% 0.20 25)' },
}

// Map raw status enum to its translation key under tenantAppointments.statusPill.*
const STATUS_LABEL_KEY: Record<string, string> = {
  CONFIRMED:   'tenantAppointments.statusPill.confirmed',
  PENDING:     'tenantAppointments.statusPill.pending',
  RESCHEDULED: 'tenantAppointments.statusPill.rescheduled',
  CANCELED:    'tenantAppointments.statusPill.canceled',
  FAILED:      'tenantAppointments.statusPill.failed',
  NO_SHOW:     'tenantAppointments.statusPill.noShow',
  COMPLETED:   'tenantAppointments.statusPill.completed',
}

export default function AppointmentsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data, loading, error, reload } = useApi<AppointmentsData>('/api/appointments')
  const [actionId, setActionId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function cancelAppt(id: string) {
    if (!confirm(t('tenantAppointments.confirm.cancel'))) return
    setActionId(id)
    try {
      const res = await apiFetchRaw(`/api/appointments/${id}/cancel`, { method: 'PATCH' })
      if (!res.ok) {
        const json = (await res.json()) as { errors?: { message: string }[] }
        showToast('error', json.errors?.[0]?.message ?? t('tenantAppointments.toast.cancelFailed'))
        return
      }
      showToast('success', t('tenantAppointments.toast.cancelSuccess'))
      reload()
    } catch {
      showToast('error', t('tenantAppointments.toast.cancelException'))
    } finally {
      setActionId(null)
    }
  }

  const appointments = data?.appointments ?? []

  function statusLabel(rawStatus: string): string {
    const key = STATUS_LABEL_KEY[rawStatus]
    if (key) return t(key)
    // Unknown status: fall back to the title-cased raw value so it's still legible.
    return rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantAppointments.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantAppointments.subtitle')}
          </p>
        </div>
        {data && data.total > 0 && (
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantAppointments.totalLabel', { n: data.total })}
          </span>
        )}
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      )}

      {error && <div className="alert-error">{t('tenantAppointments.loadFailed')}</div>}

      {!loading && appointments.length === 0 && (
        <div
          className="rounded-xl px-6 py-14 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'oklch(19% 0.04 193)' }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(55% 0.11 193)' }}>
              <path d="M4 3h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              <path d="M7 7h2M7 10h2M4 6h8" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('tenantAppointments.empty.heading')}</p>
          <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantAppointments.empty.body')}
          </p>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="space-y-2">
          {appointments.map((appt) => {
            const style = STATUS_STYLES[appt.status] ?? STATUS_STYLES['PENDING']!
            const start = new Date(appt.startAt)
            const end = new Date(appt.endAt)
            return (
              <div
                key={appt.id}
                className="rounded-xl px-5 py-4"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {appt.appointmentType ?? t('tenantAppointments.defaultType')}
                      </span>
                      <span className="badge" style={{ background: style.bg, color: style.text }}>
                        {statusLabel(appt.status)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {/* Render in the appointment's *booking* timezone (snapshot at time of booking),
                          not the viewer's preferred zone. The customer was told "2pm EST" — that's
                          what the dashboard must show, regardless of where the user is looking from. */}
                      {formatInTimezone(start, { tz: appt.timezone, locale: dateLocale, weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {formatInTimezone(start, { tz: appt.timezone, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {formatInTimezone(end, { tz: appt.timezone, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                      {appt.timezone && (
                        <span style={{ color: 'var(--text-tertiary)' }}> {appt.timezone}</span>
                      )}
                    </p>
                    {appt.location && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{appt.location}</p>
                    )}
                    {appt.notes && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-tertiary)' }}>{appt.notes}</p>
                    )}
                    {/* Phase E.6 — reminder summary. Only renders when the
                        appointment has at least one reminder row (active OR
                        historical) so we don't clutter cards for appointments
                        booked before reminders shipped, or appointments
                        without an attached contact. */}
                    {appt.reminderSummary && (appt.reminderSummary.pending + appt.reminderSummary.sent + appt.reminderSummary.failed + appt.reminderSummary.cancelled > 0) && (
                      <p className="text-xs mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--text-tertiary)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('tenantAppointments.reminders.label')}</span>
                        {appt.reminderSummary.pending > 0 && (
                          <span style={{ color: 'oklch(72% 0.12 193)' }}>
                            🔔 {t('tenantAppointments.reminders.pending', { n: appt.reminderSummary.pending })}
                          </span>
                        )}
                        {appt.reminderSummary.sent > 0 && (
                          <span style={{ color: 'oklch(60% 0.18 145)' }}>
                            ✓ {t('tenantAppointments.reminders.sent', { n: appt.reminderSummary.sent })}
                          </span>
                        )}
                        {appt.reminderSummary.failed > 0 && (
                          <span style={{ color: 'oklch(60% 0.20 25)' }}>
                            ⚠ {t('tenantAppointments.reminders.failed', { n: appt.reminderSummary.failed })}
                          </span>
                        )}
                        {appt.reminderSummary.cancelled > 0 && (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {t('tenantAppointments.reminders.cancelled', { n: appt.reminderSummary.cancelled })}
                          </span>
                        )}
                        {appt.reminderSummary.nextScheduledAt && (
                          <span>
                            {t('tenantAppointments.reminders.nextAt', {
                              when:    formatInTimezone(new Date(appt.reminderSummary.nextScheduledAt), { tz: appt.timezone, locale: dateLocale, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                              channel: appt.reminderSummary.nextChannel ?? '',
                            })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {appt.status !== 'CANCELED' && appt.status !== 'FAILED' && (
                    <button
                      onClick={() => cancelAppt(appt.id)}
                      disabled={actionId === appt.id}
                      className="text-xs flex-shrink-0 transition-opacity disabled:opacity-40"
                      style={{ color: 'var(--error-600)' }}
                    >
                      {actionId === appt.id ? t('tenantAppointments.actions.canceling') : t('tenantAppointments.actions.cancel')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
