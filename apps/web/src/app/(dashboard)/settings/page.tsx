'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, apiUploadFile, useApi } from '@/hooks/useApi'
import { PushNotificationToggle } from '@/components/PushNotificationToggle'
import { Tooltip } from '@/components/Tooltip'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { BackToOnboarding } from '@/components/BackToOnboarding'
import { IndustryAutocomplete } from '@/components/IndustryAutocomplete'
import { AggressionTierSelector } from '@/components/AggressionTierSelector'
import { TimezoneSelect } from '@/components/TimezoneSelect'

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

// Booking preferences (Phase E.5) — short-key day shape matches partner side.
type DayHours = { open: string; close: string } | null
type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
type BookingHours = Partial<Record<DayKey, DayHours>>
interface BookingPrefs {
  businessHoursJson:       BookingHours | null
  bookingSlotDurationMin:  number
  bookingMinNoticeMin:     number
  bookingMaxAdvanceDays:   number
  bookingBufferBeforeMin:  number
  bookingBufferAfterMin:   number
  timezone:                string | null
  // Phase E.6 — reminders
  reminderEnabled:         boolean
  reminderOffsetsMin:      number[]
  reminderEmailEnabled:    boolean
  reminderSmsEnabled:      boolean
}

// Friendly preset offsets for the reminders editor (minutes before appointment).
const REMINDER_PRESET_OFFSETS: number[] = [
  10080, // 1 week
  4320,  // 3 days
  2880,  // 2 days
  1440,  // 1 day  ← default
  720,   // 12 hours
  240,   // 4 hours
  120,   // 2 hours
  60,    // 1 hour ← default
  30,    // 30 min
  15,    // 15 min
]
const BOOKING_DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const BOOKING_DEFAULT_DAY: DayHours = { open: '09:00', close: '17:00' }

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
    // Allowed image formats — PNG, JPEG, WebP only (project image rules).
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
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
        accept="image/png,image/jpeg,image/webp"
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
  const { data: bookingPrefs, loading: bookingLoading, reload: reloadBooking } =
    useApi<BookingPrefs>('/api/business-profile/booking-preferences')

  const [tenantForm, setTenantForm] = useState<Partial<Tenant>>({})
  const [profileForm, setProfileForm] = useState<Partial<BusinessProfile>>({})
  const [saving, setSaving] = useState<'workspace' | 'profile' | 'booking' | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Booking-preferences form state (Phase E.5) ──────────────────────────────
  const [bookingHours, setBookingHours] = useState<BookingHours>({})
  const [slotDuration, setSlotDuration] = useState(30)
  const [minNotice, setMinNotice] = useState(60)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60)
  const [bufferBefore, setBufferBefore] = useState(0)
  const [bufferAfter, setBufferAfter] = useState(0)
  const [bookingTz, setBookingTz] = useState<string | null>(null)
  // Phase E.6 — reminder state
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([1440, 60])
  const [reminderEmail, setReminderEmail] = useState(true)
  const [reminderSms, setReminderSms] = useState(true)

  useEffect(() => { if (tenant) setTenantForm(tenant) }, [tenant])
  useEffect(() => { if (profile) setProfileForm(profile) }, [profile])
  useEffect(() => {
    if (!bookingPrefs) return
    setBookingHours(bookingPrefs.businessHoursJson ?? {})
    setSlotDuration(bookingPrefs.bookingSlotDurationMin)
    setMinNotice(bookingPrefs.bookingMinNoticeMin)
    setMaxAdvanceDays(bookingPrefs.bookingMaxAdvanceDays)
    setBufferBefore(bookingPrefs.bookingBufferBeforeMin)
    setBufferAfter(bookingPrefs.bookingBufferAfterMin)
    setBookingTz(bookingPrefs.timezone)
    setReminderEnabled(bookingPrefs.reminderEnabled)
    setReminderOffsets(bookingPrefs.reminderOffsetsMin)
    setReminderEmail(bookingPrefs.reminderEmailEnabled)
    setReminderSms(bookingPrefs.reminderSmsEnabled)
  }, [bookingPrefs])

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

  async function saveBookingPrefs() {
    setSaving('booking')
    try {
      await apiFetch('/api/business-profile/booking-preferences', {
        method: 'PUT',
        body: JSON.stringify({
          businessHoursJson:      bookingHours,
          bookingSlotDurationMin: slotDuration,
          bookingMinNoticeMin:    minNotice,
          bookingMaxAdvanceDays:  maxAdvanceDays,
          bookingBufferBeforeMin: bufferBefore,
          bookingBufferAfterMin:  bufferAfter,
          timezone:               bookingTz,
          reminderEnabled,
          reminderOffsetsMin:     reminderOffsets,
          reminderEmailEnabled:   reminderEmail,
          reminderSmsEnabled:     reminderSms,
        }),
      })
      await reloadBooking()
      await reloadTenant()
      showToast('success', t('tenantSettings.toasts.bookingSaved'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantSettings.toasts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  function toggleReminderOffset(offset: number) {
    setReminderOffsets(prev => {
      if (prev.includes(offset)) {
        return prev.filter(o => o !== offset)
      }
      // Keep sorted descending (longest lead time first) for predictable display.
      return [...prev, offset].sort((a, b) => b - a)
    })
  }
  function formatOffset(min: number, t: TFn): string {
    if (min >= 1440 && min % 1440 === 0) {
      const d = min / 1440
      return t(d === 1 ? 'tenantSettings.reminders.dayOne' : 'tenantSettings.reminders.dayN', { n: d })
    }
    if (min >= 60 && min % 60 === 0) {
      const h = min / 60
      return t(h === 1 ? 'tenantSettings.reminders.hourOne' : 'tenantSettings.reminders.hourN', { n: h })
    }
    return t('tenantSettings.reminders.minuteN', { n: min })
  }

  function setBookingDayOpen(day: DayKey, open: boolean) {
    setBookingHours(prev => ({ ...prev, [day]: open ? (prev[day] ?? BOOKING_DEFAULT_DAY) : null }))
  }
  function setBookingDayHours(day: DayKey, part: 'open' | 'close', value: string) {
    setBookingHours(prev => {
      const current = prev[day] ?? BOOKING_DEFAULT_DAY
      return { ...prev, [day]: { ...current, [part]: value } }
    })
  }


  if (tenantLoading || profileLoading || bookingLoading) {
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

      <Section
        title={t('tenantSettings.booking.title')}
        description={t('tenantSettings.booking.description')}
        onSave={saveBookingPrefs}
        saving={saving === 'booking'}
        saveLabel={t('tenantSettings.actions.saveBooking')}
        savingLabel={t('tenantSettings.actions.saving')}
      >
        {/* Working hours grid — same shape as the partner UI so the engine
            treats both sides identically (E.3 / E.5 share the converter). */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantSettings.booking.hoursLabel')}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantSettings.booking.hoursHelp')}
          </p>
          <div className="space-y-2">
            {BOOKING_DAY_KEYS.map(day => {
              const dh = bookingHours[day]
              const isOpen = !!dh
              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-12 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    {t(`partnerProfile.booking.days.${day}`)}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer w-20">
                    <input type="checkbox" checked={isOpen} onChange={e => setBookingDayOpen(day, e.target.checked)} />
                    <span className="text-xs" style={{ color: isOpen ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {isOpen ? t('partnerProfile.booking.open') : t('partnerProfile.booking.closed')}
                    </span>
                  </label>
                  {isOpen && (
                    <>
                      <input
                        type="time"
                        value={dh!.open}
                        onChange={e => setBookingDayHours(day, 'open', e.target.value)}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.booking.to')}</span>
                      <input
                        type="time"
                        value={dh!.close}
                        onChange={e => setBookingDayHours(day, 'close', e.target.value)}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Numeric prefs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <BookingNumField
            label={t('partnerProfile.booking.slotDuration.label')}
            help={t('partnerProfile.booking.slotDuration.help')}
            value={slotDuration} min={5} max={480} onChange={setSlotDuration}
          />
          <BookingNumField
            label={t('partnerProfile.booking.minNotice.label')}
            help={t('partnerProfile.booking.minNotice.help')}
            value={minNotice} min={0} max={60 * 24 * 7} onChange={setMinNotice}
          />
          <BookingNumField
            label={t('partnerProfile.booking.maxAdvance.label')}
            help={t('partnerProfile.booking.maxAdvance.help')}
            value={maxAdvanceDays} min={1} max={365} onChange={setMaxAdvanceDays}
          />
          <BookingNumField
            label={t('partnerProfile.booking.bufferBefore.label')}
            help={t('partnerProfile.booking.bufferBefore.help')}
            value={bufferBefore} min={0} max={240} onChange={setBufferBefore}
          />
          <BookingNumField
            label={t('partnerProfile.booking.bufferAfter.label')}
            help={t('partnerProfile.booking.bufferAfter.help')}
            value={bufferAfter} min={0} max={240} onChange={setBufferAfter}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantSettings.booking.timezone.label')}
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantSettings.booking.timezone.help')}
          </p>
          <TimezoneSelect value={bookingTz} onChange={setBookingTz} />
        </div>

        {/* ── Reminders (Phase E.6) ───────────────────────────────────────── */}
        <div className="pt-4 mt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('tenantSettings.reminders.heading')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {t('tenantSettings.reminders.description')}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={e => setReminderEnabled(e.target.checked)}
              />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {reminderEnabled ? t('tenantSettings.reminders.on') : t('tenantSettings.reminders.off')}
              </span>
            </label>
          </div>

          {reminderEnabled && (
            <>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('tenantSettings.reminders.offsetsLabel')}
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantSettings.reminders.offsetsHelp')}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {REMINDER_PRESET_OFFSETS.map(offset => {
                  const isOn = reminderOffsets.includes(offset)
                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => toggleReminderOffset(offset)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: isOn ? 'var(--brand-500)'  : 'var(--surface-app)',
                        border:     '1px solid ' + (isOn ? 'var(--brand-500)' : 'var(--border-subtle)'),
                        color:      isOn ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {formatOffset(offset, t)}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('tenantSettings.reminders.channelsLabel')}
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reminderEmail} onChange={e => setReminderEmail(e.target.checked)} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {t('tenantSettings.reminders.channelEmail')}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reminderSms} onChange={e => setReminderSms(e.target.checked)} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {t('tenantSettings.reminders.channelSms')}
                  </span>
                </label>
              </div>

              {reminderOffsets.length === 0 && (
                <p className="text-xs mt-3 px-2 py-1 rounded" style={{ background: 'oklch(70% 0.13 70 / 0.15)', color: 'oklch(45% 0.16 70)' }}>
                  {t('tenantSettings.reminders.warnNoOffsets')}
                </p>
              )}
              {reminderEnabled && reminderOffsets.length > 0 && !reminderEmail && !reminderSms && (
                <p className="text-xs mt-3 px-2 py-1 rounded" style={{ background: 'oklch(70% 0.13 70 / 0.15)', color: 'oklch(45% 0.16 70)' }}>
                  {t('tenantSettings.reminders.warnNoChannels')}
                </p>
              )}
            </>
          )}
        </div>
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

function BookingNumField({ label, help, value, min, max, onChange }: {
  label: string
  help?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {help && <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{help}</p>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.floor(n))))
        }}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
      />
    </div>
  )
}
