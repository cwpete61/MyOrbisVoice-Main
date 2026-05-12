'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { AggressionTierSelector, type AggressionTier } from '@/components/AggressionTierSelector'
import { TimezoneSelect } from '@/components/TimezoneSelect'
import { getBrowserTimezone } from '@/lib/timezone'

// Combined User + Partner shape returned by GET /api/partner/me
type Me = {
  user: {
    id:                 string
    email:              string
    firstName:          string | null
    lastName:           string | null
    username:           string | null
    createdAt:          string
    preferredTimezone?: string | null
  }
  partner: {
    id:                    string
    slug:                  string | null
    status:                string
    partnerPageActive:     boolean
    displayName:           string | null
    avatarUrl:             string | null
    bio:                   string | null
    partnerPhone:          string | null
    businessName:          string | null
    emailSignature:        string | null
    calendarId:            string | null
    forwardPlatformEmails: boolean
    aggressionTier:        AggressionTier
    partnerEmail:          string | null
    referralCode:          string
    totalEarnedCents:      number
    totalPaidCents:        number
  }
}

// AffiliateAccount shape from legacy GET /api/affiliate/account — used only for
// payout-method + commission-rate display since those are not surfaced by
// /api/partner/me. Will fold these into /api/partner/me in a future session.
type Account = {
  id:               string
  status:           string
  referralCode:     string
  payoutMethodJson: { type?: string; [k: string]: unknown } | null
  createdAt:        string
}

type Settings = {
  commissionRatePct: number
}

const PAYOUT_METHODS = ['PayPal', 'Bank Transfer', 'Wise', 'Other']

export default function AffiliateProfilePage() {
  const t = useT()
  const [me, setMe] = useState<Me | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  // ─── Payout form state (legacy) ────────────────────────────────────────────
  const [method, setMethod] = useState('')
  const [details, setDetails] = useState('')
  const [savingPayout, setSavingPayout] = useState(false)
  const [savedPayout, setSavedPayout] = useState(false)

  // ─── Aggression tier (legacy auto-save) ────────────────────────────────────
  const [tier, setTier] = useState<AggressionTier>('balanced')
  const [tierSaving, setTierSaving] = useState(false)
  const [tierSaved, setTierSaved] = useState(false)

  // ─── Marketing profile form state (new) ────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [partnerPhone, setPartnerPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [emailSignature, setEmailSignature] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [forwardPlatformEmails, setForwardPlatformEmails] = useState(true)
  const [savingMarketing, setSavingMarketing] = useState(false)
  const [savedMarketing, setSavedMarketing] = useState(false)

  // ─── Avatar uploader state ─────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // ─── Time zone (auto-save on change) ───────────────────────────────────────
  const [timezone, setTimezone] = useState<string | null>(null)
  const [tzSaving, setTzSaving] = useState(false)
  const [tzSaved, setTzSaved] = useState(false)
  const [tzError, setTzError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<Me>('/api/partner/me').catch(() => null),
      apiFetch<Account>('/api/affiliate/account').catch(() => null),
      apiFetch<Settings>('/api/public/affiliate/settings').catch(() => null),
    ]).then(([m, acc, sett]) => {
      setMe(m)
      setAccount(acc)
      setSettings(sett)

      if (acc?.payoutMethodJson) {
        const pmj = acc.payoutMethodJson
        setMethod(typeof pmj.type === 'string' ? pmj.type : '')
        const rest = Object.fromEntries(Object.entries(pmj).filter(([k]) => k !== 'type'))
        setDetails(Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '')
      }
      if (m?.partner.aggressionTier) setTier(m.partner.aggressionTier)

      if (m?.partner) {
        setDisplayName(m.partner.displayName ?? '')
        setBio(m.partner.bio ?? '')
        setPartnerPhone(m.partner.partnerPhone ?? '')
        setBusinessName(m.partner.businessName ?? '')
        setEmailSignature(m.partner.emailSignature ?? '')
        setCalendarId(m.partner.calendarId ?? '')
        setForwardPlatformEmails(m.partner.forwardPlatformEmails)
      }
      if (m?.user) {
        setTimezone(m.user.preferredTimezone ?? null)
      }
      setLoading(false)
    })
  }, [])

  async function saveTimezone(next: string | null) {
    setTimezone(next)
    setTzSaving(true)
    setTzError(null)
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferredTimezone: next }),
      })
      // Sync the localStorage cache that useUserTimezone() reads from, so other
      // pages pick up the change on next render without waiting for /me to re-fetch.
      try {
        const effective = next ?? getBrowserTimezone()
        window.localStorage.setItem('orbis.userTimezone', effective)
      } catch { /* ignore storage quota errors */ }
      setTzSaved(true)
      setTimeout(() => setTzSaved(false), 2500)
    } catch (e: unknown) {
      setTzError((e as Error).message ?? t('timezone.saveFailed'))
    } finally {
      setTzSaving(false)
    }
  }

  async function savePayout() {
    setSavingPayout(true)
    try {
      let parsedDetails: Record<string, unknown> = {}
      if (details.trim()) {
        try { parsedDetails = JSON.parse(details) } catch { parsedDetails = { info: details.trim() } }
      }
      const payload = method ? { type: method, ...parsedDetails } : null
      await apiFetch('/api/affiliate/payout-method', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setSavedPayout(true)
      setTimeout(() => setSavedPayout(false), 2500)
    } catch (e: unknown) {
      alert((e as Error).message ?? t('partnerProfile.saveFailed'))
    }
    setSavingPayout(false)
  }

  async function saveTier(next: AggressionTier | null) {
    if (!next) return
    setTier(next)
    setTierSaving(true)
    try {
      await apiFetch('/api/affiliate/aggression-tier', {
        method: 'PATCH',
        body: JSON.stringify({ tier: next }),
      })
      setTierSaved(true)
      setTimeout(() => setTierSaved(false), 2000)
    } catch (e: unknown) {
      alert((e as Error).message ?? t('partnerProfile.saveFailed'))
    } finally {
      setTierSaving(false)
    }
  }

  async function saveMarketing() {
    setSavingMarketing(true)
    try {
      await apiFetch('/api/partner/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName:           displayName.trim() || null,
          bio:                   bio.trim() || null,
          partnerPhone:          partnerPhone.trim() || null,
          businessName:          businessName.trim() || null,
          emailSignature:        emailSignature.trim() || null,
          calendarId:            calendarId.trim() || null,
          forwardPlatformEmails,
        }),
      })
      setSavedMarketing(true)
      setTimeout(() => setSavedMarketing(false), 2500)
    } catch (e: unknown) {
      alert((e as Error).message ?? t('partnerProfile.saveFailed'))
    }
    setSavingMarketing(false)
  }

  async function handleAvatarFile(file: File) {
    setAvatarError(null)
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarError(t('partnerProfile.avatar.errorUnsupportedType'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t('partnerProfile.avatar.errorTooLarge'))
      return
    }
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      // We can't use apiUploadFile (which sets Content-Type to file's MIME);
      // multer needs multipart. Call fetch directly with our auth token.
      const token = typeof window !== 'undefined' ? localStorage.getItem('va_access_token') : null
      const res = await fetch('/api/partner/profile/avatar', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.errors?.[0]?.message ?? t('partnerProfile.avatar.errorUploadFailed'))
      if (me) {
        setMe({ ...me, partner: { ...me.partner, avatarUrl: json.data.avatarUrl } })
      }
    } catch (e: unknown) {
      setAvatarError((e as Error).message ?? t('partnerProfile.avatar.errorUploadFailed'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.loading')}</div>
  }

  if (!me?.partner || !account) {
    return (
      <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerProfile.noAccount')}
      </div>
    )
  }

  const partner = me.partner

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerProfile.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.subtitle')}</p>

      {/* ── Account info (read-only) ────────────────────────────────────────── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.accountInfoHeading')}</p>
        <div className="space-y-2">
          <Row label={t('partnerProfile.firstNameRow')} value={me.user.firstName ?? '—'} />
          <Row label={t('partnerProfile.lastNameRow')} value={me.user.lastName ?? '—'} />
          <Row label={t('partnerProfile.registrationEmailRow')} value={me.user.email} mono />
          <Row label={t('partnerProfile.usernameRow')} value={me.user.username ?? '—'} mono />
          <Row label={t('partnerProfile.slugRow')} value={partner.slug ?? '—'} mono />
          <Row label={t('partnerProfile.status')} value={partner.status} />
          <Row label={t('partnerProfile.referralCode')} value={partner.referralCode} mono />
          {settings && <Row label={t('partnerProfile.commissionRate')} value={settings.commissionRatePct + '%'} />}
          <Row label={t('partnerProfile.memberSince')} value={new Date(me.user.createdAt).toLocaleDateString()} />
        </div>
      </div>

      {/* ── Marketing profile (editable — drives partner pages + Mailbox) ─── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.marketingHeading')}</p>
          {savedMarketing && <span className="text-xs" style={{ color: 'oklch(55% 0.18 145)' }}>✓ {t('partnerProfile.saved')}</span>}
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.marketingSubtitle')}</p>

        {/* Avatar — saves immediately on upload (no parent Save needed) */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-base font-semibold flex-shrink-0"
            style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(72% 0.12 193)', border: '1px solid var(--border-subtle)' }}
          >
            {partner.avatarUrl
              ? <img src={partner.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <span>{(me.user.firstName ?? '?').slice(0,1).toUpperCase()}{(me.user.lastName ?? '?').slice(0,1).toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.avatar.label')}</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.avatar.help')}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = '' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--brand-500)', color: '#fff', opacity: uploadingAvatar ? 0.5 : 1 }}
            >
              {uploadingAvatar
                ? t('partnerProfile.avatar.uploading')
                : partner.avatarUrl
                  ? t('partnerProfile.avatar.replace')
                  : t('partnerProfile.avatar.upload')}
            </button>
            {avatarError && <p className="text-xs mt-2" style={{ color: 'oklch(60% 0.2 30)' }}>{avatarError}</p>}
          </div>
        </div>

        {/* Display name */}
        <Field
          label={t('partnerProfile.displayName.label')}
          help={t('partnerProfile.displayName.help')}
          value={displayName}
          onChange={setDisplayName}
          placeholder={[me.user.firstName, me.user.lastName].filter(Boolean).join(' ')}
        />

        {/* Business name */}
        <Field
          label={t('partnerProfile.businessName.label')}
          help={t('partnerProfile.businessName.help')}
          value={businessName}
          onChange={setBusinessName}
          placeholder={t('partnerProfile.businessName.placeholder')}
        />

        {/* Partner phone */}
        <Field
          label={t('partnerProfile.partnerPhone.label')}
          help={t('partnerProfile.partnerPhone.help')}
          value={partnerPhone}
          onChange={setPartnerPhone}
          placeholder="+1 (555) 123-4567"
        />

        {/* Bio */}
        <FieldArea
          label={t('partnerProfile.bio.label')}
          help={t('partnerProfile.bio.help')}
          value={bio}
          onChange={setBio}
          rows={3}
          placeholder={t('partnerProfile.bio.placeholder')}
        />

        {/* ── Email setup (inside marketing block) ─────────────────────────── */}
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.emailHeading')}</p>

          <div className="mb-4">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.partnerEmail.label')}</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.partnerEmail.help')}</p>
            <div
              className="w-full rounded-lg px-3 py-2 text-sm font-mono"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {partner.partnerEmail ?? '—'}
            </div>
          </div>

          <FieldArea
            label={t('partnerProfile.emailSignature.label')}
            help={t('partnerProfile.emailSignature.help')}
            value={emailSignature}
            onChange={setEmailSignature}
            rows={4}
            placeholder={t('partnerProfile.emailSignature.placeholder')}
            mono
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forwardPlatformEmails}
              onChange={e => setForwardPlatformEmails(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{t('partnerProfile.forwardEmails.label')}</span>
              <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('partnerProfile.forwardEmails.help', { email: me.user.email })}
              </span>
            </span>
          </label>
        </div>

        {/* ── Calendar (inside marketing block) ────────────────────────────── */}
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.calendarHeading')}</p>
          <Field
            label={t('partnerProfile.calendarId.label')}
            help={t('partnerProfile.calendarId.help')}
            value={calendarId}
            onChange={setCalendarId}
            placeholder={t('partnerProfile.calendarId.placeholder')}
            mono
          />
        </div>

        {/* Save Marketing button */}
        <button
          onClick={saveMarketing}
          disabled={savingMarketing}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold mt-4"
          style={{ background: savedMarketing ? 'oklch(55% 0.18 145)' : 'var(--brand-500)', color: '#fff' }}
        >
          {savingMarketing
            ? t('partnerProfile.savingMarketing')
            : savedMarketing
              ? t('partnerProfile.saved')
              : t('partnerProfile.saveMarketing')}
        </button>
      </div>

      {/* ── Time zone (auto-save on change) ─────────────────────────────────── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('timezone.sectionTitle')}</p>
          {tzSaved && <span className="text-xs" style={{ color: 'oklch(55% 0.18 145)' }}>✓ {t('timezone.saved')}</span>}
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('timezone.sectionDesc')}</p>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('timezone.fieldLabel')}</label>
        <TimezoneSelect value={timezone} onChange={saveTimezone} />
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {tzSaving
            ? t('timezone.saving')
            : timezone
              ? t('timezone.usingExplicit').replace('{tz}', timezone)
              : t('timezone.usingAuto').replace('{tz}', getBrowserTimezone())}
        </p>
        {tzError && <p className="text-xs mt-2" style={{ color: 'oklch(60% 0.2 30)' }}>{tzError}</p>}
      </div>

      {/* ── Payout (legacy) ─────────────────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.payoutHeading')}</p>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.payoutMethod')}</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <option value="">{t('partnerProfile.selectMethod')}</option>
          {PAYOUT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.paymentDetails')}</label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.paymentDetailsHelp')}</p>
        <textarea
          rows={3}
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder={t('partnerProfile.paymentDetailsPlaceholder')}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 resize-none"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />

        <button
          onClick={savePayout}
          disabled={savingPayout}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: savedPayout ? 'oklch(55% 0.18 145)' : 'var(--brand-500)', color: '#fff' }}
        >
          {savingPayout ? t('partnerProfile.saving') : savedPayout ? t('partnerProfile.saved') : t('partnerProfile.savePreferences')}
        </button>
      </div>

      {/* ── Aggression tier (legacy, auto-save) ─────────────────────────────── */}
      <div className="rounded-xl p-5 mt-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.aggressionTier.heading')}</p>
          {tierSaved && <span className="text-xs" style={{ color: 'oklch(55% 0.18 145)' }}>✓ {t('partnerProfile.saved')}</span>}
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.aggressionTier.description')}</p>
        <AggressionTierSelector value={tier} onChange={saveTier} saving={tierSaving} />
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function Field({ label, help, value, onChange, placeholder, mono }: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {help && <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{help}</p>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}
      />
    </div>
  )
}

function FieldArea({ label, help, value, onChange, placeholder, rows, mono }: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {help && <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{help}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}
      />
    </div>
  )
}
