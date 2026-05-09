'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, apiUploadFile, useApi } from '@/hooks/useApi'
import { PushNotificationToggle } from '@/components/PushNotificationToggle'
import { Tooltip } from '@/components/Tooltip'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { BackToOnboarding } from '@/components/BackToOnboarding'
import { IndustryAutocomplete } from '@/components/IndustryAutocomplete'
import { AggressionTierSelector } from '@/components/AggressionTierSelector'

type TFn = (key: string, vars?: Record<string, string | number>) => string

interface Tenant {
  id: string
  displayName: string
  legalName: string | null
  timezone: string
  publicEmail: string | null
  publicPhone: string | null
  website: string | null
  industryVertical: string
}


interface BusinessProfile {
  brandName: string
  logoUrl: string | null
  addressLine1: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  fallbackNotificationEmail: string | null
  // Marketing voice intensity — drives AI-Assist generated copy + default
  // campaign tone. See docs/marketing-style-guide.md for the spectrum.
  aggressionTier: 'conservative' | 'balanced' | 'direct' | 'aggressive'
}

function LogoUpload({
  currentUrl,
  onUploaded,
  t,
}: {
  currentUrl: string | null
  onUploaded: (url: string) => void
  t: TFn
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError(t('tenantSettings.logo.errorUnsupportedType'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('tenantSettings.logo.errorTooLarge'))
      return
    }
    setError(null)
    setUploading(true)
    try {
      const res = await apiUploadFile<{ logoUrl: string }>('/api/business-profile/logo', 'logo', file)
      onUploaded(res.logoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tenantSettings.logo.errorUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <BackToOnboarding markStepKey="profile" />
      <label className="label">{t('tenantSettings.logo.label')}</label>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
        >
          {currentUrl
            ? <img src={currentUrl} alt={t('tenantSettings.logo.altText')} className="w-full h-full object-contain" />
            : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantSettings.logo.noLogo')}</span>
          }
        </div>
        <div className="space-y-1">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn-secondary text-sm"
          >
            {uploading
              ? t('tenantSettings.logo.uploading')
              : currentUrl
                ? t('tenantSettings.logo.replace')
                : t('tenantSettings.logo.upload')}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantSettings.logo.constraints')}</p>
          {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

interface FieldConfig {
  key: string
  labelKey: string
  placeholderKey?: string
  tooltipKey?: string
  type?: string
}

const WORKSPACE_FIELDS: FieldConfig[] = [
  { key: 'displayName', labelKey: 'tenantSettings.workspace.fields.displayName', placeholderKey: 'tenantSettings.workspace.fields.displayNamePlaceholder', tooltipKey: 'tenantSettings.workspace.fields.displayNameTooltip' },
  { key: 'legalName',   labelKey: 'tenantSettings.workspace.fields.legalName',   placeholderKey: 'tenantSettings.workspace.fields.legalNamePlaceholder',   tooltipKey: 'tenantSettings.workspace.fields.legalNameTooltip' },
  { key: 'publicEmail', labelKey: 'tenantSettings.workspace.fields.publicEmail', placeholderKey: 'tenantSettings.workspace.fields.publicEmailPlaceholder', type: 'email', tooltipKey: 'tenantSettings.workspace.fields.publicEmailTooltip' },
  { key: 'publicPhone', labelKey: 'tenantSettings.workspace.fields.publicPhone', placeholderKey: 'tenantSettings.workspace.fields.publicPhonePlaceholder', tooltipKey: 'tenantSettings.workspace.fields.publicPhoneTooltip' },
  { key: 'website',     labelKey: 'tenantSettings.workspace.fields.website',     placeholderKey: 'tenantSettings.workspace.fields.websitePlaceholder', type: 'url', tooltipKey: 'tenantSettings.workspace.fields.websiteTooltip' },
  { key: 'timezone',    labelKey: 'tenantSettings.workspace.fields.timezone',    placeholderKey: 'tenantSettings.workspace.fields.timezonePlaceholder', tooltipKey: 'tenantSettings.workspace.fields.timezoneTooltip' },
]

const PROFILE_FIELDS: FieldConfig[] = [
  { key: 'brandName',                 labelKey: 'tenantSettings.profile.fields.brandName',                 placeholderKey: 'tenantSettings.profile.fields.brandNamePlaceholder', tooltipKey: 'tenantSettings.profile.fields.brandNameTooltip' },
  { key: 'addressLine1',              labelKey: 'tenantSettings.profile.fields.addressLine1',              placeholderKey: 'tenantSettings.profile.fields.addressLine1Placeholder' },
  { key: 'city',                      labelKey: 'tenantSettings.profile.fields.city',                      placeholderKey: 'tenantSettings.profile.fields.cityPlaceholder' },
  { key: 'region',                    labelKey: 'tenantSettings.profile.fields.region',                    placeholderKey: 'tenantSettings.profile.fields.regionPlaceholder' },
  { key: 'postalCode',                labelKey: 'tenantSettings.profile.fields.postalCode',                placeholderKey: 'tenantSettings.profile.fields.postalCodePlaceholder' },
  { key: 'country',                   labelKey: 'tenantSettings.profile.fields.country',                   placeholderKey: 'tenantSettings.profile.fields.countryPlaceholder' },
  { key: 'fallbackNotificationEmail', labelKey: 'tenantSettings.profile.fields.fallbackNotificationEmail', placeholderKey: 'tenantSettings.profile.fields.fallbackNotificationEmailPlaceholder', type: 'email', tooltipKey: 'tenantSettings.profile.fields.fallbackNotificationEmailTooltip' },
]

function FormField({
  config,
  value,
  onChange,
  t,
}: {
  config: FieldConfig
  value: string
  onChange: (v: string) => void
  t: TFn
}) {
  const labelText = t(config.labelKey)
  const tooltipText = config.tooltipKey ? t(config.tooltipKey) : null
  // tooltipText could be the raw key if missing — only treat as tooltip if t() actually translated
  const hasTooltip = tooltipText && tooltipText !== config.tooltipKey
  return (
    <div>
      <label htmlFor={config.key} className="label">
        {hasTooltip ? <Tooltip content={tooltipText}>{labelText}</Tooltip> : labelText}
      </label>
      <input
        id={config.key}
        type={config.type ?? 'text'}
        value={value}
        placeholder={config.placeholderKey ? t(config.placeholderKey) : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </div>
  )
}

function Section({
  title,
  description,
  children,
  onSave,
  saving,
  saveLabel,
  savingLabel,
}: {
  title: string
  description?: string
  children: React.ReactNode
  onSave: () => void
  saving: boolean
  saveLabel: string
  savingLabel: string
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        )}
      </div>
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        {children}
        <div className="pt-2">
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const { data: tenant, loading: tenantLoading, reload: reloadTenant } = useApi<Tenant>('/api/tenants/current')
  const { data: profile, loading: profileLoading, reload: reloadProfile } = useApi<BusinessProfile>('/api/business-profile')

  const [tenantForm, setTenantForm] = useState<Partial<Tenant>>({})
  const [profileForm, setProfileForm] = useState<Partial<BusinessProfile>>({})
  const [saving, setSaving] = useState<'workspace' | 'profile' | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { if (tenant) setTenantForm(tenant) }, [tenant])
  useEffect(() => { if (profile) setProfileForm(profile) }, [profile])

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function saveTenant() {
    setSaving('workspace')
    try {
      await apiFetch('/api/tenants/current', { method: 'PATCH', body: JSON.stringify(tenantForm) })
      await reloadTenant()
      showToast('success', t('tenantSettings.toasts.workspaceSaved'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantSettings.toasts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  async function saveProfile() {
    setSaving('profile')
    try {
      await apiFetch('/api/business-profile', { method: 'PATCH', body: JSON.stringify(profileForm) })
      await reloadProfile()
      showToast('success', t('tenantSettings.toasts.profileSaved'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantSettings.toasts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }


  if (tenantLoading || profileLoading) {
    return (
      <div className="space-y-2 pt-2">
        {[140, 80, 180].map((w) => (
          <div
            key={w}
            className="h-4 rounded animate-pulse"
            style={{ width: `${w}px`, background: 'var(--border-subtle)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('tenantSettings.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantSettings.subtitle')}
        </p>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>
          {toast.text}
        </div>
      )}

      <Section
        title={t('tenantSettings.workspace.title')}
        description={t('tenantSettings.workspace.description')}
        onSave={saveTenant}
        saving={saving === 'workspace'}
        saveLabel={t('tenantSettings.actions.saveWorkspace')}
        savingLabel={t('tenantSettings.actions.saving')}
      >
        {WORKSPACE_FIELDS.map((f) => (
          <FormField
            key={f.key}
            config={f}
            value={(tenantForm[f.key as keyof Tenant] as string) ?? ''}
            onChange={(v) => setTenantForm({ ...tenantForm, [f.key]: v || null })}
            t={t}
          />
        ))}
      </Section>

      <Section
        title={t('tenantSettings.industry.title')}
        description={t('tenantSettings.industry.description')}
        onSave={saveTenant}
        saving={saving === 'workspace'}
        saveLabel={t('tenantSettings.actions.saveIndustry')}
        savingLabel={t('tenantSettings.actions.saving')}
      >
        <div>
          <label className="label">{t('tenantSettings.industry.label')}</label>
          <IndustryAutocomplete
            value={(tenantForm as Tenant).industryVertical ?? 'GENERAL'}
            onChange={code => setTenantForm({ ...tenantForm, industryVertical: code })}
            locale={locale === 'es' ? 'es' : 'en'}
            placeholder={t('tenantSettings.industry.searchPlaceholder')}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantSettings.industry.helper')}
          </p>
        </div>
      </Section>

      <Section
        title={t('tenantSettings.profile.title')}
        description={t('tenantSettings.profile.description')}
        onSave={saveProfile}
        saving={saving === 'profile'}
        saveLabel={t('tenantSettings.actions.saveProfile')}
        savingLabel={t('tenantSettings.actions.saving')}
      >
        <LogoUpload
          currentUrl={profileForm.logoUrl ?? null}
          onUploaded={(url) => {
            setProfileForm((p) => ({ ...p, logoUrl: url }))
            showToast('success', t('tenantSettings.toasts.logoUploaded'))
          }}
          t={t}
        />
        {PROFILE_FIELDS.map((f) => (
          <FormField
            key={f.key}
            config={f}
            value={(profileForm[f.key as keyof BusinessProfile] as string) ?? ''}
            onChange={(v) => setProfileForm({ ...profileForm, [f.key]: v || null })}
            t={t}
          />
        ))}
      </Section>

      <Section
        title={t('tenantSettings.aggressionTier.title')}
        description={t('tenantSettings.aggressionTier.description')}
        onSave={saveProfile}
        saving={saving === 'profile'}
        saveLabel={t('tenantSettings.aggressionTier.save')}
        savingLabel={t('tenantSettings.actions.saving')}
      >
        <AggressionTierSelector
          value={(profileForm.aggressionTier as 'conservative' | 'balanced' | 'direct' | 'aggressive') ?? 'balanced'}
          onChange={(tier) => setProfileForm({ ...profileForm, aggressionTier: tier ?? 'balanced' })}
          saving={saving === 'profile'}
        />
      </Section>

      <section>
        <div className="mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('tenantSettings.notifications.title')}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantSettings.notifications.description')}
          </p>
        </div>
        <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <PushNotificationToggle />
        </div>
      </section>

      <MembersSection onToast={showToast} t={t} dateLocale={dateLocale} />
    </div>
  )
}

interface Member {
  id:        string
  isOwner:   boolean
  createdAt: string
  user:      {
    id: string; email: string; username: string;
    firstName: string | null; lastName: string | null;
    status: string; lastLoginAt: string | null;
  }
  roleDefinition: { key: string; name: string }
}

function MembersSection({
  onToast,
  t,
  dateLocale,
}: {
  onToast: (type: 'success' | 'error', text: string) => void
  t: TFn
  dateLocale: string
}) {
  const { data, loading, reload } = useApi<Member[]>('/api/tenants/current/members')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft]   = useState({ email: '', roleKey: 'tenant_staff' })
  const [saving, setSaving] = useState(false)

  async function addMember() {
    if (!draft.email) { onToast('error', t('tenantSettings.members.toasts.emptyEmail')); return }
    setSaving(true)
    try {
      await apiFetch('/api/tenants/current/members', {
        method: 'POST',
        body: JSON.stringify(draft),
      })
      onToast('success', t('tenantSettings.members.toasts.memberAdded'))
      setDraft({ email: '', roleKey: 'tenant_staff' })
      setAdding(false)
      reload()
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : t('tenantSettings.members.toasts.addFailed'))
    } finally { setSaving(false) }
  }

  async function removeMember(userId: string, displayName: string) {
    if (!confirm(t('tenantSettings.members.confirmRemove', { name: displayName }))) return
    try {
      await apiFetch(`/api/tenants/current/members/${userId}`, { method: 'DELETE' })
      onToast('success', t('tenantSettings.members.toasts.memberRemoved'))
      reload()
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : t('tenantSettings.members.toasts.removeFailed'))
    }
  }

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('tenantSettings.members.title')}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantSettings.members.description')}
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary text-sm">
            {t('tenantSettings.members.addButton')}
          </button>
        )}
      </div>

      <div className="rounded-xl divide-y" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderColor: 'var(--border-subtle)' }}>
        {adding && (
          <div className="p-5 space-y-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="label">{t('tenantSettings.members.emailLabel')}</label>
                <input
                  type="email"
                  className="input"
                  value={draft.email}
                  onChange={e => setDraft(p => ({ ...p, email: e.target.value }))}
                  placeholder={t('tenantSettings.members.emailPlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">{t('tenantSettings.members.roleLabel')}</label>
                <select
                  className="input"
                  value={draft.roleKey}
                  onChange={e => setDraft(p => ({ ...p, roleKey: e.target.value }))}
                >
                  <option value="tenant_owner">{t('tenantSettings.members.roleOwner')}</option>
                  <option value="tenant_manager">{t('tenantSettings.members.roleManager')}</option>
                  <option value="tenant_staff">{t('tenantSettings.members.roleStaff')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addMember} disabled={saving} className="btn-primary text-sm">
                {saving ? t('tenantSettings.members.adding') : t('tenantSettings.members.addAction')}
              </button>
              <button onClick={() => { setAdding(false); setDraft({ email: '', roleKey: 'tenant_staff' }) }} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                {t('tenantSettings.members.cancel')}
              </button>
            </div>
          </div>
        )}

        {loading && <div className="p-5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantSettings.members.loading')}</div>}

        {!loading && data && data.length === 0 && (
          <div className="p-5 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantSettings.members.empty')}
          </div>
        )}

        {!loading && data && data.map((m) => {
          const name = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.username
          return (
            <div key={m.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</p>
                  {m.isOwner && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(96% 0.05 75)', color: 'oklch(35% 0.16 75)' }}>{t('tenantSettings.members.ownerBadge')}</span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {m.user.email} · {m.roleDefinition.name}
                  {m.user.lastLoginAt && ` · ${t('tenantSettings.members.lastLogin', { date: new Date(m.user.lastLoginAt).toLocaleDateString(dateLocale) })}`}
                </p>
              </div>
              {!m.isOwner && (
                <button
                  onClick={() => removeMember(m.user.id, name)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: 'oklch(45% 0.18 25)', background: 'transparent', border: '1px solid oklch(85% 0.10 25)' }}
                >
                  {t('tenantSettings.members.removeButton')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
