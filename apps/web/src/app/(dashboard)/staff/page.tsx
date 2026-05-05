'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
  isActive: boolean
  calendarId: string | null
  integrationConnection: { status: string; externalEmail: string | null } | null
}

export default function StaffDirectoryPage() {
  const t = useT()
  const { locale } = useLocale()
  // Hint to satisfy locale usage when not directly referenced in JSX (kept for future date formatting).
  void locale
  const { data: entitlements } = useApi<Record<string, boolean | number | string | null>>('/api/entitlements')
  const { data: staff, loading, reload } = useApi<StaffMember[]>('/api/staff')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', department: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const searchParams = useSearchParams()

  const enabled = entitlements?.['multi_calendar_booking'] === true
  const maxSeats = (entitlements?.['max_seats'] as number | undefined) ?? 1
  const used = staff?.filter(s => s.isActive).length ?? 0

  useEffect(() => {
    if (searchParams.get('google') === 'error') {
      setError(t('tenantStaff.errors.calendarConnectFailed', {
        reason: searchParams.get('reason') ?? t('tenantStaff.errors.unknownReason'),
      }))
    }
  }, [searchParams, t])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  async function addMember() {
    if (!form.name.trim()) return
    setSaving(true); setError('')
    try {
      await apiFetch('/api/staff', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), title: form.title || undefined, department: form.department || undefined, email: form.email || undefined }),
      })
      setForm({ name: '', title: '', department: '', email: '' })
      setAdding(false)
      reload()
      showToast(t('tenantStaff.toasts.memberAdded'))
    } catch (e) { setError(e instanceof Error ? e.message : t('tenantStaff.errors.genericFailed')) }
    finally { setSaving(false) }
  }

  if (!enabled) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.subtitleShort')}</p>
        </div>
        <div className="rounded-xl px-6 py-10 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.gate.title')}</p>
          <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantStaff.gate.description')}
          </p>
          <a href="/billing" className="btn-primary text-sm">{t('tenantStaff.gate.viewPlans')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantStaff.subtitleLong')}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantStaff.header.seatsUsed', { used, max: maxSeats })}
          </p>
          {!adding && used < maxSeats && (
            <button onClick={() => setAdding(true)} className="btn-primary text-sm">{t('tenantStaff.header.addMember')}</button>
          )}
          {!adding && used >= maxSeats && (
            <p className="text-xs" style={{ color: 'oklch(70% 0.16 75)' }}>{t('tenantStaff.header.seatLimitReached')}</p>
          )}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {toast && <div className="alert-success">{toast}</div>}

      {/* Add form */}
      {adding && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.form.heading')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.form.fullNameLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.form.fullNamePlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.form.jobTitleLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.form.jobTitlePlaceholder')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.form.departmentLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.form.departmentPlaceholder')} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.form.emailLabel')}</label>
              <input className="input w-full" placeholder={t('tenantStaff.form.emailPlaceholder')} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addMember} disabled={saving || !form.name.trim()} className="btn-primary text-sm">
              {saving ? t('tenantStaff.form.addingButton') : t('tenantStaff.form.addButton')}
            </button>
            <button onClick={() => { setAdding(false); setForm({ name: '', title: '', department: '', email: '' }) }} className="btn-secondary text-sm">{t('tenantStaff.form.cancelButton')}</button>
          </div>
        </div>
      )}

      {/* Directory */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: 'var(--surface-raised)' }} />)}
        </div>
      ) : !staff?.length ? (
        <div className="rounded-xl px-6 py-12 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.empty.title')}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.empty.description')}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {staff.map((member, i) => (
            <Link
              key={member.id}
              href={`/staff/${member.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-overlay)]"
              style={{
                background: 'var(--surface-raised)',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                opacity: member.isActive ? 1 : 0.5,
                display: 'flex',
              }}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                style={{ background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }}>
                {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
                  {member.title && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{member.title}</span>}
                  {member.department && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                      {member.department}
                    </span>
                  )}
                  {!member.isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{t('tenantStaff.row.inactive')}</span>
                  )}
                </div>
                {member.email && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{member.email}</p>}
              </div>

              {/* Status chips */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={member.integrationConnection?.status === 'CONNECTED'
                    ? { background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }
                    : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                  {member.integrationConnection?.status === 'CONNECTED' ? t('tenantStaff.row.calendarConnected') : t('tenantStaff.row.noCalendar')}
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-tertiary)' }}>
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Calendar integrations footer */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.integrations.heading')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-raised)', border: '1px solid oklch(55% 0.14 193)' }}>
            <GoogleIcon />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantStaff.integrations.googleCalendar')}</p>
              <p className="text-xs" style={{ color: 'oklch(65% 0.15 145)' }}>{t('tenantStaff.integrations.availableNow')}</p>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', opacity: 0.55 }}>
            <OutlookIcon />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.integrations.outlook')}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.integrations.comingSoon')}</p>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', opacity: 0.55 }}>
            <CalendlyIcon />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('tenantStaff.integrations.calendly')}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantStaff.integrations.comingSoon')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none">
      <rect x="2" y="2" width="11" height="11" rx="2" fill="#0078D4"/>
      <rect x="11" y="11" width="11" height="11" rx="2" fill="#0078D4" opacity="0.7"/>
    </svg>
  )
}

function CalendlyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0">
      <circle cx="12" cy="12" r="11" fill="#006BFF"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>
  )
}
