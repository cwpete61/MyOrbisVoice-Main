'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'

interface StaffMember {
  id: string
  name: string
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  timezone: string | null
  phoneExtension: string | null
  availabilityJson: unknown
  calendarId: string | null
  isActive: boolean
  integrationConnection: {
    status: string
    externalEmail: string | null
    lastVerifiedAt: string | null
  } | null
}

type Tab = 'profile' | 'calendar' | 'phone' | 'agents'

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile',  label: 'Profile'  },
  { key: 'calendar', label: 'Calendar' },
  { key: 'phone',    label: 'Phone'    },
  { key: 'agents',   label: 'Agents'   },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DEFAULT_HOURS = { start: '09:00', end: '17:00', enabled: true }

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: member, loading, reload } = useApi<StaffMember>(`/api/staff/${staffId}`)

  const initialTab = (searchParams.get('tab') as Tab) ?? 'profile'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [profile, setProfile] = useState({ name: '', title: '', department: '', email: '', phone: '', timezone: '', phoneExtension: '' })
  const [availability, setAvailability] = useState<Record<string, { start: string; end: string; enabled: boolean }>>({})
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (member) {
      setProfile({
        name: member.name,
        title: member.title ?? '',
        department: member.department ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        timezone: member.timezone ?? '',
        phoneExtension: member.phoneExtension ?? '',
      })
      const saved = member.availabilityJson as Record<string, { start: string; end: string; enabled: boolean }> | null
      const init: typeof availability = {}
      for (const day of DAYS) init[day] = saved?.[day] ?? { ...DEFAULT_HOURS }
      setAvailability(init)
    }
  }, [member])

  useEffect(() => {
    if (searchParams.get('google') === 'success') {
      showToast(`Calendar connected: ${searchParams.get('email') ?? ''}`)
      setTab('calendar')
      reload()
    } else if (searchParams.get('google') === 'error') {
      setError(`Calendar connection failed: ${searchParams.get('reason') ?? 'unknown'}`)
    }
  }, [searchParams]) // eslint-disable-line

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  async function saveProfile() {
    setSaving(true); setError('')
    try {
      await apiFetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name || undefined,
          title: profile.title || undefined,
          department: profile.department || undefined,
          email: profile.email || undefined,
          phone: profile.phone || undefined,
          timezone: profile.timezone || undefined,
          phoneExtension: profile.phoneExtension || undefined,
        }),
      })
      reload(); showToast('Profile saved')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function saveAvailability() {
    setSaving(true); setError('')
    try {
      await apiFetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({ availabilityJson: availability }),
      })
      showToast('Availability saved')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function connectCalendar() {
    setConnecting(true); setError('')
    try {
      const result = await apiFetch<{ url: string }>(`/api/staff/${staffId}/google/connect`, { method: 'POST' })
      window.location.href = result.url
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setConnecting(false) }
  }

  async function disconnectCalendar() {
    if (!confirm('Disconnect this calendar? Existing bookings are not affected.')) return
    try {
      await apiFetch(`/api/staff/${staffId}/google`, { method: 'DELETE' })
      reload(); showToast('Calendar disconnected')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  async function toggleActive() {
    try {
      await apiFetch(`/api/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify({ isActive: !member?.isActive }) })
      reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  async function deleteMember() {
    if (!confirm('Permanently remove this staff member? This cannot be undone.')) return
    try {
      await apiFetch(`/api/staff/${staffId}`, { method: 'DELETE' })
      router.push('/staff')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse max-w-3xl">
      <div className="h-6 w-48 rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-48 rounded-xl" style={{ background: 'var(--surface-raised)' }} />
    </div>
  )

  if (!member) return (
    <div className="max-w-3xl">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Staff member not found.</p>
      <Link href="/staff" className="text-sm mt-2 inline-block" style={{ color: 'oklch(55% 0.14 193)' }}>← Back to directory</Link>
    </div>
  )

  const calConnected = member.integrationConnection?.status === 'CONNECTED'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + header */}
      <div>
        <Link href="/staff" className="text-xs mb-3 inline-flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Staff Directory
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }}>
            {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{member.name}</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {[member.title, member.department].filter(Boolean).join(' · ') || 'No title set'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleActive} className="btn-ghost text-xs">
              {member.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={deleteMember} className="btn-ghost text-xs" style={{ color: 'oklch(68% 0.20 25)' }}>Remove</button>
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {toast && <div className="alert-success">{toast}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              color: tab === t.key ? 'oklch(55% 0.14 193)' : 'var(--text-secondary)',
              borderBottom: tab === t.key ? '2px solid oklch(55% 0.14 193)' : '2px solid transparent',
              marginBottom: '-1px',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'name',           label: 'Full name *',   placeholder: 'Jane Smith'          },
              { key: 'title',          label: 'Job title',     placeholder: 'Sales Consultant'    },
              { key: 'department',     label: 'Department',    placeholder: 'Sales'               },
              { key: 'email',          label: 'Email',         placeholder: 'jane@company.com'    },
              { key: 'phone',          label: 'Direct phone',  placeholder: '+1 555 000 0000'     },
              { key: 'timezone',       label: 'Timezone',      placeholder: 'America/New_York'    },
              { key: 'phoneExtension', label: 'Extension',     placeholder: '1042'                },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                <input
                  className="input w-full"
                  placeholder={f.placeholder}
                  value={profile[f.key as keyof typeof profile]}
                  onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button onClick={saveProfile} disabled={saving || !profile.name.trim()} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      )}

      {/* Calendar tab */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Google Calendar</p>
                {calConnected ? (
                  <>
                    <p className="text-xs" style={{ color: 'oklch(65% 0.15 145)' }}>Connected — {member.integrationConnection?.externalEmail}</p>
                    {member.integrationConnection?.lastVerifiedAt && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Last verified {new Date(member.integrationConnection.lastVerifiedAt).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No calendar connected. Bookings cannot be routed to this person until connected.</p>
                )}
              </div>
              {calConnected ? (
                <button onClick={disconnectCalendar} className="btn-ghost text-xs">Disconnect</button>
              ) : (
                <button onClick={connectCalendar} disabled={connecting} className="btn-primary text-sm">
                  {connecting ? 'Redirecting…' : 'Connect Google Calendar'}
                </button>
              )}
            </div>
            {calConnected && member.calendarId && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                Calendar ID: {member.calendarId}
              </div>
            )}
          </div>

          {/* Availability schedule */}
          <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Availability schedule</p>
            <div className="space-y-3">
              {DAYS.map(day => {
                const slot = availability[day] ?? { ...DEFAULT_HOURS }
                return (
                  <div key={day} className="flex items-center gap-4">
                    <div className="w-5 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={slot.enabled}
                        onChange={e => setAvailability(a => ({ ...a, [day]: { ...slot, enabled: e.target.checked } }))}
                        className="rounded"
                      />
                    </div>
                    <span className="text-sm w-24 flex-shrink-0" style={{ color: slot.enabled ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{day}</span>
                    {slot.enabled ? (
                      <div className="flex items-center gap-2">
                        <input type="time" value={slot.start} onChange={e => setAvailability(a => ({ ...a, [day]: { ...slot, start: e.target.value } }))}
                          className="input text-xs py-1 px-2" style={{ width: '7rem' }} />
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
                        <input type="time" value={slot.end} onChange={e => setAvailability(a => ({ ...a, [day]: { ...slot, end: e.target.value } }))}
                          className="input text-xs py-1 px-2" style={{ width: '7rem' }} />
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Unavailable</span>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={saveAvailability} disabled={saving} className="btn-primary text-sm mt-5">
              {saving ? 'Saving…' : 'Save availability'}
            </button>
          </div>
        </div>
      )}

      {/* Phone tab */}
      {tab === 'phone' && (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Phone routing</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Set a direct number or extension for this staff member. The agent can transfer or connect callers to them by name.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Direct phone number</label>
              <input className="input w-full" placeholder="+1 555 000 0000" value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Extension</label>
              <input className="input w-full" placeholder="1042" value={profile.phoneExtension}
                onChange={e => setProfile(p => ({ ...p, phoneExtension: e.target.value }))} />
            </div>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Dedicated Twilio numbers per staff</strong> — assign a specific purchased phone number exclusively to this staff member from your Phone Numbers page. Coming in a future update.
            </p>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Agents tab */}
      {tab === 'agents' && (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Agent assignment</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Control which AI agents are permitted to book appointments with or route callers to this staff member.
            </p>
          </div>
          <div className="rounded-lg px-4 py-8 text-center" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Agent assignment rules coming soon.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Currently all active agents with booking capability can route to any active staff member.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
