'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

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

// Day keys map to dictionary entries under tenantStaff.detail.calendar.schedule.days.*
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_KEYS: Record<string, string> = {
  Monday: 'tenantStaff.detail.calendar.schedule.days.monday',
  Tuesday: 'tenantStaff.detail.calendar.schedule.days.tuesday',
  Wednesday: 'tenantStaff.detail.calendar.schedule.days.wednesday',
  Thursday: 'tenantStaff.detail.calendar.schedule.days.thursday',
  Friday: 'tenantStaff.detail.calendar.schedule.days.friday',
  Saturday: 'tenantStaff.detail.calendar.schedule.days.saturday',
  Sunday: 'tenantStaff.detail.calendar.schedule.days.sunday',
}
const DEFAULT_HOURS = { start: '09:00', end: '17:00', enabled: true }

export default function StaffDetailPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { staffId } = useParams<{ staffId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: member, loading, reload } = useApi<StaffMember>(`/api/staff/${staffId}`)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',  label: t('tenantStaff.detail.tabs.profile')  },
    { key: 'calendar', label: t('tenantStaff.detail.tabs.calendar') },
    { key: 'phone',    label: t('tenantStaff.detail.tabs.phone')    },
    { key: 'agents',   label: t('tenantStaff.detail.tabs.agents')   },
  ]

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
      showToast(t('tenantStaff.detail.toasts.calendarConnected', { email: searchParams.get('email') ?? '' }))
      setTab('calendar')
      reload()
    } else if (searchParams.get('google') === 'error') {
      setError(t('tenantStaff.detail.errors.calendarConnectFailed', {
        reason: searchParams.get('reason') ?? t('tenantStaff.detail.errors.unknownReason'),
      }))
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
      reload(); showToast(t('tenantStaff.detail.toasts.profileSaved'))
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
    finally { setSaving(false) }
  }

  async function saveAvailability() {
    setSaving(true); setError('')
    try {
      await apiFetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({ availabilityJson: availability }),
      })
      showToast(t('tenantStaff.detail.toasts.availabilitySaved'))
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
    finally { setSaving(false) }
  }

  async function connectCalendar() {
    setConnecting(true); setError('')
    try {
      const result = await apiFetch<{ url: string }>(`/api/staff/${staffId}/google/connect`, { method: 'POST' })
      window.location.href = result.url
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')); setConnecting(false) }
  }

  async function disconnectCalendar() {
    if (!confirm(t('tenantStaff.detail.confirms.disconnectCalendar'))) return
    try {
      await apiFetch(`/api/staff/${staffId}/google`, { method: 'DELETE' })
      reload(); showToast(t('tenantStaff.detail.toasts.calendarDisconnected'))
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
  }

  async function toggleActive() {
    try {
      await apiFetch(`/api/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify({ isActive: !member?.isActive }) })
      reload()
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
  }

  async function deleteMember() {
    if (!confirm(t('tenantStaff.detail.confirms.deleteMember'))) return
    try {
      await apiFetch(`/api/staff/${staffId}`, { method: 'DELETE' })
      router.push('/staff')
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse max-w-3xl">
      <div className="h-6 w-48 rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-48 rounded-xl" style={{ background: 'var(--surface-raised)' }} />
    </div>
  )

  if (!member) return (
    <div className="max-w-3xl">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.detail.notFound')}</p>
      <Link href="/staff" className="text-sm mt-2 inline-block" style={{ color: 'oklch(55% 0.14 193)' }}>{t('tenantStaff.detail.backLink')}</Link>
    </div>
  )

  const calConnected = member.integrationConnection?.status === 'CONNECTED'

  const profileFields: Array<{ key: keyof typeof profile; label: string; placeholder: string }> = [
    { key: 'name',           label: t('tenantStaff.detail.profile.fields.nameLabel'),       placeholder: t('tenantStaff.detail.profile.fields.namePlaceholder')       },
    { key: 'title',          label: t('tenantStaff.detail.profile.fields.titleLabel'),      placeholder: t('tenantStaff.detail.profile.fields.titlePlaceholder')      },
    { key: 'department',     label: t('tenantStaff.detail.profile.fields.departmentLabel'), placeholder: t('tenantStaff.detail.profile.fields.departmentPlaceholder') },
    { key: 'email',          label: t('tenantStaff.detail.profile.fields.emailLabel'),      placeholder: t('tenantStaff.detail.profile.fields.emailPlaceholder')      },
    { key: 'phone',          label: t('tenantStaff.detail.profile.fields.phoneLabel'),      placeholder: t('tenantStaff.detail.profile.fields.phonePlaceholder')      },
    { key: 'timezone',       label: t('tenantStaff.detail.profile.fields.timezoneLabel'),   placeholder: t('tenantStaff.detail.profile.fields.timezonePlaceholder')   },
    { key: 'phoneExtension', label: t('tenantStaff.detail.profile.fields.extensionLabel'),  placeholder: t('tenantStaff.detail.profile.fields.extensionPlaceholder')  },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + header */}
      <div>
        <Link href="/staff" className="text-xs mb-3 inline-flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {t('tenantStaff.detail.backToDirectory')}
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }}>
            {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{member.name}</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {[member.title, member.department].filter(Boolean).join(' · ') || t('tenantStaff.detail.noTitleSet')}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleActive} className="btn-ghost text-xs">
              {member.isActive ? t('tenantStaff.detail.actions.deactivate') : t('tenantStaff.detail.actions.activate')}
            </button>
            <button onClick={deleteMember} className="btn-ghost text-xs" style={{ color: 'oklch(68% 0.20 25)' }}>{t('tenantStaff.detail.actions.remove')}</button>
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {toast && <div className="alert-success">{toast}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              color: tab === tabItem.key ? 'oklch(55% 0.14 193)' : 'var(--text-secondary)',
              borderBottom: tab === tabItem.key ? '2px solid oklch(55% 0.14 193)' : '2px solid transparent',
              marginBottom: '-1px',
              fontWeight: tab === tabItem.key ? 600 : 400,
            }}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profileFields.map(f => (
              <div key={f.key}>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                <input
                  className="input w-full"
                  placeholder={f.placeholder}
                  value={profile[f.key]}
                  onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button onClick={saveProfile} disabled={saving || !profile.name.trim()} className="btn-primary text-sm">
            {saving ? t('tenantStaff.detail.profile.savingButton') : t('tenantStaff.detail.profile.saveButton')}
          </button>
        </div>
      )}

      {/* Calendar tab */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.detail.calendar.googleCalendar')}</p>
                {calConnected ? (
                  <>
                    <p className="text-xs" style={{ color: 'oklch(65% 0.15 145)' }}>
                      {t('tenantStaff.detail.calendar.connectedTo', { email: member.integrationConnection?.externalEmail ?? '' })}
                    </p>
                    {member.integrationConnection?.lastVerifiedAt && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {t('tenantStaff.detail.calendar.lastVerified', {
                          date: new Date(member.integrationConnection.lastVerifiedAt).toLocaleDateString(dateLocale),
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.detail.calendar.noCalendarConnected')}</p>
                )}
              </div>
              {calConnected ? (
                <button onClick={disconnectCalendar} className="btn-ghost text-xs">{t('tenantStaff.detail.calendar.disconnectButton')}</button>
              ) : (
                <button onClick={connectCalendar} disabled={connecting} className="btn-primary text-sm">
                  {connecting ? t('tenantStaff.detail.calendar.redirectingButton') : t('tenantStaff.detail.calendar.connectButton')}
                </button>
              )}
            </div>
            {calConnected && member.calendarId && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                {t('tenantStaff.detail.calendar.calendarIdLabel', { id: member.calendarId })}
              </div>
            )}
          </div>

          {/* Availability schedule */}
          <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.detail.calendar.schedule.heading')}</p>
            <div className="space-y-3">
              {DAYS.map(day => {
                const slot = availability[day] ?? { ...DEFAULT_HOURS }
                const dayLabel = t(DAY_KEYS[day]!)
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
                    <span className="text-sm w-24 flex-shrink-0" style={{ color: slot.enabled ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{dayLabel}</span>
                    {slot.enabled ? (
                      <div className="flex items-center gap-2">
                        <input type="time" value={slot.start} onChange={e => setAvailability(a => ({ ...a, [day]: { ...slot, start: e.target.value } }))}
                          className="input text-xs py-1 px-2" style={{ width: '7rem' }} />
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.detail.calendar.schedule.to')}</span>
                        <input type="time" value={slot.end} onChange={e => setAvailability(a => ({ ...a, [day]: { ...slot, end: e.target.value } }))}
                          className="input text-xs py-1 px-2" style={{ width: '7rem' }} />
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.detail.calendar.schedule.unavailable')}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={saveAvailability} disabled={saving} className="btn-primary text-sm mt-5">
              {saving ? t('tenantStaff.detail.calendar.schedule.savingButton') : t('tenantStaff.detail.calendar.schedule.saveButton')}
            </button>
          </div>
        </div>
      )}

      {/* Phone tab */}
      {tab === 'phone' && (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.detail.phone.heading')}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('tenantStaff.detail.phone.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.detail.phone.directPhoneLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.detail.phone.directPhonePlaceholder')} value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.detail.phone.extensionLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.detail.phone.extensionPlaceholder')} value={profile.phoneExtension}
                onChange={e => setProfile(p => ({ ...p, phoneExtension: e.target.value }))} />
            </div>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.detail.phone.dedicatedTwilioTitle')}</strong> {t('tenantStaff.detail.phone.dedicatedTwilioDescription')}
            </p>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">
            {saving ? t('tenantStaff.detail.phone.savingButton') : t('tenantStaff.detail.phone.saveButton')}
          </button>
        </div>
      )}

      {/* Agents tab */}
      {tab === 'agents' && (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.detail.agents.heading')}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('tenantStaff.detail.agents.description')}
            </p>
          </div>
          <div className="rounded-lg px-4 py-8 text-center" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.detail.agents.comingSoonTitle')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantStaff.detail.agents.comingSoonDescription')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
