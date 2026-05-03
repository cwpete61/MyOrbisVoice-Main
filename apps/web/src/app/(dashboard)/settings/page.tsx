'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, apiUploadFile, useApi } from '@/hooks/useApi'

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

const INDUSTRY_VERTICALS = [
  { value: 'GENERAL',             label: 'General' },
  { value: 'ACCOUNTING',          label: 'Accounting / Tax' },
  { value: 'AUTO_REPAIR',         label: 'Auto Repair' },
  { value: 'BEAUTY',              label: 'Beauty & Wellness' },
  { value: 'CHILDCARE',           label: 'Childcare / Nursery' },
  { value: 'DENTAL',              label: 'Dental' },
  { value: 'EDUCATION',           label: 'Education' },
  { value: 'FINANCIAL',           label: 'Financial Services' },
  { value: 'FITNESS',             label: 'Fitness & Gym' },
  { value: 'HOME_SERVICES',       label: 'Home Services' },
  { value: 'HOSPITALITY',         label: 'Hospitality' },
  { value: 'INSURANCE',           label: 'Insurance' },
  { value: 'LEGAL',               label: 'Legal' },
  { value: 'MEDICAL',             label: 'Medical / Clinic' },
  { value: 'PROPERTY_MANAGEMENT', label: 'Property Management' },
  { value: 'REAL_ESTATE',         label: 'Real Estate' },
  { value: 'VETERINARY',          label: 'Veterinary' },
]

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

function LogoUpload({ currentUrl, onUploaded }: { currentUrl: string | null; onUploaded: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Unsupported type. Use PNG, JPG, or WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const res = await apiUploadFile<{ logoUrl: string }>('/api/business-profile/logo', 'logo', file)
      onUploaded(res.logoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="label">Logo</label>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
        >
          {currentUrl
            ? <img src={currentUrl} alt="Logo" className="w-full h-full object-contain" />
            : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No logo</span>
          }
        </div>
        <div className="space-y-1">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn-secondary text-sm"
          >
            {uploading ? 'Uploading…' : currentUrl ? 'Replace logo' : 'Upload logo'}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>PNG, JPG, SVG, or WebP — max 2 MB</p>
          {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
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
        title="Industry"
        description="Select your industry so we can recommend the right campaign templates for your business."
        onSave={saveTenant}
        saving={saving === 'workspace'}
        saveLabel="Save industry"
      >
        <div>
          <label className="label">Industry vertical</label>
          <select
            value={(tenantForm as Tenant).industryVertical ?? 'GENERAL'}
            onChange={e => setTenantForm({ ...tenantForm, industryVertical: e.target.value })}
            className="input"
          >
            {INDUSTRY_VERTICALS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            This determines which campaign templates appear in your Campaign Library.
          </p>
        </div>
      </Section>

      <Section
        title="Business profile"
        description="Address and contact details used in confirmations and correspondence."
        onSave={saveProfile}
        saving={saving === 'profile'}
        saveLabel="Save profile"
      >
        <LogoUpload
          currentUrl={profileForm.logoUrl ?? null}
          onUploaded={(url) => {
            setProfileForm((p) => ({ ...p, logoUrl: url }))
            showToast('success', 'Logo uploaded.')
          }}
        />
        {PROFILE_FIELDS.map((f) => (
          <FormField
            key={f.key}
            config={f}
            value={(profileForm[f.key as keyof BusinessProfile] as string) ?? ''}
            onChange={(v) => setProfileForm({ ...profileForm, [f.key]: v || null })}
          />
        ))}
      </Section>

      <MembersSection onToast={showToast} />
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

function MembersSection({ onToast }: { onToast: (t: 'success' | 'error', text: string) => void }) {
  const { data, loading, reload } = useApi<Member[]>('/api/tenants/current/members')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft]   = useState({ email: '', roleKey: 'tenant_staff' })
  const [saving, setSaving] = useState(false)

  async function addMember() {
    if (!draft.email) { onToast('error', 'Enter an email.'); return }
    setSaving(true)
    try {
      await apiFetch('/api/tenants/current/members', {
        method: 'POST',
        body: JSON.stringify(draft),
      })
      onToast('success', 'Member added.')
      setDraft({ email: '', roleKey: 'tenant_staff' })
      setAdding(false)
      reload()
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to add member.')
    } finally { setSaving(false) }
  }

  async function removeMember(userId: string, displayName: string) {
    if (!confirm(`Remove ${displayName} from this workspace?`)) return
    try {
      await apiFetch(`/api/tenants/current/members/${userId}`, { method: 'DELETE' })
      onToast('success', 'Member removed.')
      reload()
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Failed to remove member.')
    }
  }

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Team members</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Invite teammates to share access to this workspace. They must sign up first; then add them here by email.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary text-sm">
            + Add member
          </button>
        )}
      </div>

      <div className="rounded-xl divide-y" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderColor: 'var(--border-subtle)' }}>
        {adding && (
          <div className="p-5 space-y-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={draft.email}
                  onChange={e => setDraft(p => ({ ...p, email: e.target.value }))}
                  placeholder="teammate@example.com"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={draft.roleKey}
                  onChange={e => setDraft(p => ({ ...p, roleKey: e.target.value }))}
                >
                  <option value="tenant_owner">Owner — full control</option>
                  <option value="tenant_manager">Manager — config + members</option>
                  <option value="tenant_staff">Staff — day-to-day use</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addMember} disabled={saving} className="btn-primary text-sm">
                {saving ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setDraft({ email: '', roleKey: 'tenant_staff' }) }} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <div className="p-5 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}

        {!loading && data && data.length === 0 && (
          <div className="p-5 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            No members yet.
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
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(96% 0.05 75)', color: 'oklch(35% 0.16 75)' }}>Owner</span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {m.user.email} · {m.roleDefinition.name}
                  {m.user.lastLoginAt && ` · last login ${new Date(m.user.lastLoginAt).toLocaleDateString()}`}
                </p>
              </div>
              {!m.isOwner && (
                <button
                  onClick={() => removeMember(m.user.id, name)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: 'oklch(45% 0.18 25)', background: 'transparent', border: '1px solid oklch(85% 0.10 25)' }}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
