'use client'

import { useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

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

export default function AppointmentsPage() {
  const { data, loading, error, reload } = useApi<AppointmentsData>('/api/appointments')
  const [actionId, setActionId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function cancelAppt(id: string) {
    if (!confirm('Cancel this appointment?')) return
    setActionId(id)
    try {
      const res = await apiFetchRaw(`/api/appointments/${id}/cancel`, { method: 'PATCH' })
      if (!res.ok) {
        const json = (await res.json()) as { errors?: { message: string }[] }
        showToast('error', json.errors?.[0]?.message ?? 'Cancel failed')
        return
      }
      showToast('success', 'Appointment canceled.')
      reload()
    } catch {
      showToast('error', 'Failed to cancel appointment')
    } finally {
      setActionId(null)
    }
  }

  const appointments = data?.appointments ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Appointments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Bookings created by your voice agents.
          </p>
        </div>
        {data && data.total > 0 && (
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {data.total} total
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

      {error && <div className="alert-error">Failed to load appointments.</div>}

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
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No appointments yet</p>
          <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--text-tertiary)' }}>
            Connect your Google account and activate a channel. Appointments booked by agents will appear here.
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
                        {appt.appointmentType ?? 'Appointment'}
                      </span>
                      <span className="badge" style={{ background: style.bg, color: style.text }}>
                        {appt.status.charAt(0) + appt.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
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
                  </div>
                  {appt.status !== 'CANCELED' && appt.status !== 'FAILED' && (
                    <button
                      onClick={() => cancelAppt(appt.id)}
                      disabled={actionId === appt.id}
                      className="text-xs flex-shrink-0 transition-opacity disabled:opacity-40"
                      style={{ color: 'var(--error-600)' }}
                    >
                      {actionId === appt.id ? 'Canceling…' : 'Cancel'}
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
