'use client'

import { useState, useEffect } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Tenant {
  id: string
  displayName: string
  legalName: string | null
  timezone: string
  publicEmail: string | null
  publicPhone: string | null
  website: string | null
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
}

interface FieldConfig {
  key: string
  label: string
  placeholder?: string
  type?: string
}

const WORKSPACE_FIELDS: FieldConfig[] = [
  { key: 'displayName',  label: 'Display name',    placeholder: 'Acme Corp' },
  { key: 'legalName',    label: 'Legal name',       placeholder: 'Acme Corporation LLC (optional)' },
  { key: 'publicEmail',  label: 'Public email',     placeholder: 'hello@acme.com',    type: 'email' },
  { key: 'publicPhone',  label: 'Public phone',     placeholder: '+1 555 000 0000' },
  { key: 'website',      label: 'Website',          placeholder: 'https://acme.com',   type: 'url' },
  { key: 'timezone',     label: 'Timezone',         placeholder: 'America/New_York' },
]

const PROFILE_FIELDS: FieldConfig[] = [
  { key: 'brandName',                   label: 'Brand name',            placeholder: 'Acme' },
  { key: 'addressLine1',                label: 'Address',               placeholder: '123 Main St' },
  { key: 'city',                        label: 'City',                  placeholder: 'New York' },
  { key: 'region',                      label: 'State / Region',        placeholder: 'NY' },
  { key: 'postalCode',                  label: 'Postal code',           placeholder: '10001' },
  { key: 'country',                     label: 'Country',               placeholder: 'US' },
  { key: 'fallbackNotificationEmail',   label: 'Notification email',    placeholder: 'alerts@acme.com', type: 'email' },
]

function FormField({ config, value, onChange }: { config: FieldConfig; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={config.key} className="label">{config.label}</label>
      <input
        id={config.key}
        type={config.type ?? 'text'}
        value={value}
        placeholder={config.placeholder}
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
}: {
  title: string
  description?: string
  children: React.ReactNode
  onSave: () => void
  saving: boolean
  saveLabel: string
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
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function SettingsPage() {
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
      showToast('success', 'Workspace settings saved.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function saveProfile() {
    setSaving('profile')
    try {
      await apiFetch('/api/business-profile', { method: 'PATCH', body: JSON.stringify(profileForm) })
      await reloadProfile()
      showToast('success', 'Business profile saved.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
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
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Workspace and business profile
        </p>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>
          {toast.text}
        </div>
      )}

      <Section
        title="Workspace"
        description="Basic info shown to your team and in communications."
        onSave={saveTenant}
        saving={saving === 'workspace'}
        saveLabel="Save workspace"
      >
        {WORKSPACE_FIELDS.map((f) => (
          <FormField
            key={f.key}
            config={f}
            value={(tenantForm[f.key as keyof Tenant] as string) ?? ''}
            onChange={(v) => setTenantForm({ ...tenantForm, [f.key]: v || null })}
          />
        ))}
      </Section>

      <Section
        title="Business profile"
        description="Address and contact details used in confirmations and correspondence."
        onSave={saveProfile}
        saving={saving === 'profile'}
        saveLabel="Save profile"
      >
        {PROFILE_FIELDS.map((f) => (
          <FormField
            key={f.key}
            config={f}
            value={(profileForm[f.key as keyof BusinessProfile] as string) ?? ''}
            onChange={(v) => setProfileForm({ ...profileForm, [f.key]: v || null })}
          />
        ))}
      </Section>
    </div>
  )
}
