'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, apiFetchRaw, apiUploadFile, useApi } from '@/hooks/useApi'
import { useT, useLocale, type Locale } from '@/lib/i18n/I18nProvider'

interface UserMe {
  user: {
    id: string
    email: string
    username: string | null
    firstName: string | null
    lastName: string | null
    preferredLocale?: 'en' | 'es'
    status: string
    createdAt: string
    lastLoginAt: string | null
  }
  memberships: {
    tenantId: string
    tenantName: string
    roleKey: string
    isPlatformRole: boolean
    isOwner: boolean
  }[]
}

interface BillingData {
  subscription: {
    status: string
    plan: { name: string; interval: string } | null
  } | null
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toast({ type, text }: { type: 'success' | 'error'; text: string }) {
  return <div className={type === 'success' ? 'alert-success mb-4' : 'alert-error mb-4'}>{text}</div>
}

interface ProfilePageProps {
  showBilling?: boolean
}

export function ProfilePage({ showBilling = false }: ProfilePageProps) {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [localeToast, setLocaleToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { data: meData, loading: meLoading, reload } = useApi<UserMe>('/api/auth/me')
  const { data: billingData } = useApi<BillingData>(showBilling ? '/api/billing/subscription' : '')
  const { data: logoData, reload: reloadLogo } = useApi<{ logoUrl: string | null }>('/api/business-profile/logo')

  function changeLocale(next: Locale) {
    if (next === locale) return
    setLocale(next)
    setLocaleToast({
      type: 'success',
      text: next === 'es' ? t('profile.languageSavedEs') : t('profile.languageSavedEn'),
    })
    setTimeout(() => setLocaleToast(null), 4000)
  }

  // Logo upload
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  async function handleLogoFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError(t('profile.unsupportedLogoType'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError(t('profile.logoTooLarge'))
      return
    }
    setLogoError(null)
    setLogoUploading(true)
    try {
      await apiUploadFile('/api/business-profile/logo', 'logo', file)
      reloadLogo()
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('profile.uploadFailed'))
    } finally {
      setLogoUploading(false)
    }
  }

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileToast, setProfileToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordToast, setPasswordToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const user = meData?.user

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setUsername(user.username ?? '')
    }
  }, [user])

  function toast(setter: typeof setProfileToast, type: 'success' | 'error', text: string) {
    setter({ type, text })
    setTimeout(() => setter(null), 5000)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: firstName || undefined, lastName: lastName || undefined, username: username || undefined }),
      })
      reload()
      toast(setProfileToast, 'success', t('profile.profileUpdated'))
    } catch (err) {
      toast(setProfileToast, 'error', err instanceof Error ? err.message : t('profile.failedToSave'))
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast(setPasswordToast, 'error', t('profile.passwordsDoNotMatch'))
      return
    }
    setPasswordSaving(true)
    try {
      await apiFetch('/api/auth/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast(setPasswordToast, 'success', t('profile.passwordChangedAndSignedOut'))
    } catch (err) {
      toast(setPasswordToast, 'error', err instanceof Error ? err.message : t('profile.failedToChangePassword'))
    } finally {
      setPasswordSaving(false)
    }
  }

  async function openBillingPortal() {
    try {
      const res = await apiFetchRaw('/api/billing/portal-session', { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; errors?: { message: string }[] }
      if (!res.ok) { toast(setProfileToast, 'error', json.errors?.[0]?.message ?? t('profile.failed')); return }
      window.open(json.data!.url, '_blank')
    } catch {
      toast(setProfileToast, 'error', t('profile.failedToOpenBillingPortal'))
    }
  }

  const initials = (user?.username ?? user?.email ?? '??').slice(0, 2).toUpperCase()
  const membership = meData?.memberships[0]

  if (meLoading) return <div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('profile.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.subtitle')}</p>
      </div>

      {/* Identity summary — logo replaces initials avatar */}
      <div className="rounded-xl px-6 py-5 flex items-center gap-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        {/* Avatar / logo */}
        <button
          type="button"
          title={logoUploading ? t('profile.uploadingLabel') : t('profile.clickToUploadLogo')}
          disabled={logoUploading}
          onClick={() => logoFileRef.current?.click()}
          className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 group"
          style={logoData?.logoUrl ? { border: '1px solid var(--border-subtle)' } : { background: 'oklch(55% 0.11 193 / 0.18)' }}
        >
          {logoData?.logoUrl
            ? <img src={logoData.logoUrl} alt={t('profile.clickToUploadLogo')} className="w-full h-full object-contain" />
            : <span className="text-xl font-bold" style={{ color: 'oklch(72% 0.12 193)' }}>{initials}</span>
          }
          {/* Hover overlay */}
          <span className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'oklch(0% 0 0 / 0.45)' }}>
            {logoUploading
              ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            }
          </span>
        </button>

        <input
          ref={logoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
        />

        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || user?.email}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
          {membership && (
            <span className="badge mt-1.5 capitalize" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
              {membership.roleKey.replace(/_/g, ' ')}
              {membership.tenantName ? ` · ${membership.tenantName}` : ''}
            </span>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {logoUploading ? t('profile.uploadingLabel') : t('profile.clickLogoToUploadHint')}
          </p>
          {logoError && <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>{logoError}</p>}
        </div>
      </div>

      {/* Personal info */}
      <Section title={t('profile.personalInfo')} description={t('profile.personalInfoDesc')}>
        {profileToast && <Toast {...profileToast} />}
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('profile.firstName')}</label>
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('profile.firstNamePlaceholder')} />
            </div>
            <div>
              <label className="label">{t('profile.lastName')}</label>
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('profile.lastNamePlaceholder')} />
            </div>
          </div>
          <div>
            <label className="label">{t('profile.username')}</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('profile.usernamePlaceholder')} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.usernameHelp')}</p>
          </div>
          <div>
            <label className="label">{t('profile.emailLabel')}</label>
            <input className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.5 }} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('profile.emailHelp')}</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={profileSaving} className="btn-primary">
              {profileSaving ? t('profile.saving') : t('profile.saveChanges')}
            </button>
            {user?.lastLoginAt && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('profile.lastLoginAt', { when: new Date(user.lastLoginAt).toLocaleString(dateLocale) })}
              </p>
            )}
          </div>
        </form>
      </Section>

      {/* Language */}
      <Section title={t('profile.language')} description={t('profile.languageDesc')}>
        {localeToast && <Toast {...localeToast} />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeLocale('en')}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left"
            style={{
              background: locale === 'en' ? 'var(--brand-500)' : 'var(--surface-app)',
              color: locale === 'en' ? '#fff' : 'var(--text-primary)',
              border: locale === 'en' ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '1.1rem' }}>🇺🇸</span>
              <div>
                <div style={{ fontWeight: 600 }}>English</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{locale === 'en' ? t('profile.languageActive') : t('profile.languageSwitchToEn')}</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeLocale('es')}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left"
            style={{
              background: locale === 'es' ? 'var(--brand-500)' : 'var(--surface-app)',
              color: locale === 'es' ? '#fff' : 'var(--text-primary)',
              border: locale === 'es' ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '1.1rem' }}>🇲🇽</span>
              <div>
                <div style={{ fontWeight: 600 }}>Español</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{locale === 'es' ? t('profile.languageActiveEs') : t('profile.languageSwitchToEs')}</div>
              </div>
            </div>
          </button>
        </div>
      </Section>

      {/* Password */}
      <Section title={t('profile.password')} description={t('profile.passwordSectionDesc')}>
        {passwordToast && <Toast {...passwordToast} />}
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">{t('profile.currentPassword')}</label>
            <input type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('profile.newPassword')}</label>
            <input type="password" className="input" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder={t('profile.newPasswordPlaceholder')} />
          </div>
          <div>
            <label className="label">{t('profile.confirmPassword')}</label>
            <input type="password" className="input" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={passwordSaving} className="btn-primary">
            {passwordSaving ? t('profile.updating') : t('profile.changePassword')}
          </button>
        </form>
      </Section>

      {/* Billing — tenant users only */}
      {showBilling && (
        <Section title={t('profile.billingTitle')} description={t('profile.billingDesc')}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {billingData?.subscription?.plan?.name ?? t('profile.noActivePlan')}
              </p>
              <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                {billingData?.subscription?.status?.toLowerCase() ?? t('profile.noSubscription')}
                {billingData?.subscription?.plan?.interval ? t('profile.billedInterval', { interval: billingData.subscription.plan.interval.toLowerCase() }) : ''}
              </p>
            </div>
            <span
              className="badge"
              style={billingData?.subscription?.status === 'ACTIVE'
                ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
              }
            >
              {billingData?.subscription?.status ?? t('profile.trialBadge')}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={openBillingPortal} className="btn-ghost">
              {t('profile.manageBillingButton')}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('profile.stripeNote')}
          </p>
        </Section>
      )}

      {/* Account info */}
      <Section title={t('profile.accountTitle')}>
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('profile.accountId')}</dt>
            <dd className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{user?.id}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('profile.memberSince')}</dt>
            <dd className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(dateLocale) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('profile.statusLabel')}</dt>
            <dd>
              <span className="badge capitalize" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
                {user?.status?.toLowerCase()}
              </span>
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  )
}
