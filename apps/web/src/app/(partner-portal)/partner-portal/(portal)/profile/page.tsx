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

  // ─── Booking preferences (Phase E.3) ───────────────────────────────────────
  type DayHours = { open: string; close: string } | null
  type BookingHours = Partial<Record<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat', DayHours>>
  type BookingPrefs = {
    bookingHoursJson:       BookingHours | null
    bookingSlotDurationMin: number
    bookingMinNoticeMin:    number
    bookingMaxAdvanceDays:  number
    bookingBufferBeforeMin: number
    bookingBufferAfterMin:  number
    bookingTimezone:        string | null
  }
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const DEFAULT_DAY: DayHours = { open: '09:00', close: '17:00' }
  const [bookingHours, setBookingHours] = useState<BookingHours>({})
  const [slotDuration, setSlotDuration] = useState(30)
  const [minNotice, setMinNotice] = useState(60)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60)
  const [bufferBefore, setBufferBefore] = useState(0)
  const [bufferAfter, setBufferAfter] = useState(0)
  const [bookingTz, setBookingTz] = useState<string | null>(null)
  const [savingBooking, setSavingBooking] = useState(false)
  const [savedBooking, setSavedBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // ─── Google Calendar OAuth (Phase E.0) ─────────────────────────────────────
  type GoogleConn = { status: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'PENDING'; email: string | null; lastVerifiedAt: string | null; calendarIds: string[] }
  const [googleConn, setGoogleConn] = useState<GoogleConn | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleMsg, setGoogleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadGoogleConn() {
    try {
      const data = await apiFetch<GoogleConn>('/api/partner/integrations/google')
      setGoogleConn(data)
    } catch {
      setGoogleConn({ status: 'NOT_CONNECTED', email: null, lastVerifiedAt: null, calendarIds: [] })
    }
  }

  async function connectGoogle() {
    setGoogleBusy(true)
    setGoogleMsg(null)
    try {
      const { url } = await apiFetch<{ url: string }>('/api/partner/integrations/google/start', { method: 'POST' })
      window.location.assign(url)   // browser leaves for Google consent
    } catch (e: unknown) {
      setGoogleMsg({ type: 'error', text: (e as Error).message ?? t('partnerProfile.google.startFailed') })
      setGoogleBusy(false)
    }
  }

  async function disconnectGoogle() {
    if (!confirm(t('partnerProfile.google.confirmDisconnect'))) return
    setGoogleBusy(true)
    try {
      await apiFetch('/api/partner/integrations/google', { method: 'DELETE' })
      setGoogleMsg({ type: 'success', text: t('partnerProfile.google.disconnected') })
      await loadGoogleConn()
    } catch (e: unknown) {
      setGoogleMsg({ type: 'error', text: (e as Error).message ?? t('partnerProfile.google.disconnectFailed') })
    } finally {
      setGoogleBusy(false)
    }
  }

  // Read ?google=success&email=... / ?google=error&reason=... on mount
  // (set by the shared OAuth callback that bounced the browser back here).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const g = params.get('google')
    if (g === 'success') {
      const email = params.get('email') ?? ''
      setGoogleMsg({ type: 'success', text: t('partnerProfile.google.connectedAs').replace('{email}', email) })
      // Strip query so a reload doesn't re-fire the toast
      window.history.replaceState({}, '', window.location.pathname)
    } else if (g === 'error') {
      const reason = params.get('reason') ?? ''
      setGoogleMsg({ type: 'error', text: t('partnerProfile.google.oauthError').replace('{reason}', reason) })
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadGoogleConn()
  }, [])

  useEffect(() => {
    Promise.all([
      apiFetch<Me>('/api/partner/me').catch(() => null),
      apiFetch<Account>('/api/affiliate/account').catch(() => null),
      apiFetch<Settings>('/api/public/affiliate/settings').catch(() => null),
      apiFetch<BookingPrefs>('/api/partner/booking-preferences').catch(() => null),
    ]).then(([m, acc, sett, prefs]) => {
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
      if (prefs) {
        setBookingHours(prefs.bookingHoursJson ?? {})
        setSlotDuration(prefs.bookingSlotDurationMin)
        setMinNotice(prefs.bookingMinNoticeMin)
        setMaxAdvanceDays(prefs.bookingMaxAdvanceDays)
        setBufferBefore(prefs.bookingBufferBeforeMin)
        setBufferAfter(prefs.bookingBufferAfterMin)
        setBookingTz(prefs.bookingTimezone)
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

  async function saveBookingPrefs() {
    setSavingBooking(true)
    setBookingError(null)
    try {
      await apiFetch('/api/partner/booking-preferences', {
        method: 'PUT',
        body: JSON.stringify({
          bookingHoursJson:       bookingHours,
          bookingSlotDurationMin: slotDuration,
          bookingMinNoticeMin:    minNotice,
          bookingMaxAdvanceDays:  maxAdvanceDays,
          bookingBufferBeforeMin: bufferBefore,
          bookingBufferAfterMin:  bufferAfter,
          bookingTimezone:        bookingTz,
        }),
      })
      setSavedBooking(true)
      setTimeout(() => setSavedBooking(false), 2500)
    } catch (e: unknown) {
      setBookingError((e as Error).message ?? t('partnerProfile.booking.saveFailed'))
    } finally {
      setSavingBooking(false)
    }
  }

  function setDayOpen(day: typeof DAY_KEYS[number], open: boolean) {
    setBookingHours(prev => ({ ...prev, [day]: open ? (prev[day] ?? DEFAULT_DAY) : null }))
  }
  function setDayHours(day: typeof DAY_KEYS[number], part: 'open'|'close', value: string) {
    setBookingHours(prev => {
      const current = prev[day] ?? DEFAULT_DAY
      return { ...prev, [day]: { ...current, [part]: value } }
    })
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
    // Allowed image formats — PNG, JPEG, WebP only (project image rules).
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
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
              accept="image/png,image/jpeg,image/webp"
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

          {/* Google OAuth connect/disconnect (Phase E.0). When connected, the agent
              on this partner's landing page books to THIS partner's calendar (E.2),
              the partner sees their calendar in the back office (E.1), and the
              public booking page works (E.4). The free-text calendarId field
              below is an advanced override (pick a non-primary calendar). */}
          <div
            className="mb-4 rounded-lg p-4"
            style={{
              background: googleConn?.status === 'CONNECTED' ? 'oklch(55% 0.18 145 / 0.10)' : 'var(--surface-app)',
              border:     googleConn?.status === 'CONNECTED' ? '1px solid oklch(55% 0.18 145 / 0.40)' : '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {googleConn?.status === 'CONNECTED'
                    ? `✓ ${t('partnerProfile.google.connectedHeading')}`
                    : t('partnerProfile.google.notConnectedHeading')}
                </div>
                {googleConn?.status === 'CONNECTED' && googleConn.email && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {googleConn.email}
                    {googleConn.calendarIds.length > 0 && ` · ${googleConn.calendarIds.length} ${t('partnerProfile.google.calendarsLabel')}`}
                  </div>
                )}
                {googleConn?.status !== 'CONNECTED' && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {t('partnerProfile.google.notConnectedHelp')}
                  </div>
                )}
              </div>
              {googleConn?.status === 'CONNECTED' ? (
                <button
                  onClick={disconnectGoogle}
                  disabled={googleBusy}
                  className="px-3 py-1.5 rounded-md text-xs flex-shrink-0"
                  style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: googleBusy ? 0.5 : 1 }}
                >
                  {googleBusy ? t('partnerProfile.google.working') : t('partnerProfile.google.disconnectLabel')}
                </button>
              ) : (
                <button
                  onClick={connectGoogle}
                  disabled={googleBusy}
                  className="px-4 py-2 rounded-md text-xs font-semibold flex-shrink-0"
                  style={{ background: 'var(--brand-500)', color: '#fff', opacity: googleBusy ? 0.5 : 1 }}
                >
                  {googleBusy ? t('partnerProfile.google.working') : t('partnerProfile.google.connectLabel')}
                </button>
              )}
            </div>
            {googleMsg && (
              <div
                className="text-xs mt-2 px-2 py-1 rounded"
                style={{
                  background: googleMsg.type === 'success' ? 'oklch(55% 0.18 145 / 0.15)' : 'oklch(60% 0.2 30 / 0.15)',
                  color:      googleMsg.type === 'success' ? 'oklch(45% 0.18 145)' : 'oklch(55% 0.20 30)',
                }}
              >
                {googleMsg.text}
              </div>
            )}
          </div>

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

      {/* ── Booking preferences (Phase E.3) ─────────────────────────────────── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.booking.heading')}</p>
          {savedBooking && <span className="text-xs" style={{ color: 'oklch(55% 0.18 145)' }}>✓ {t('partnerProfile.saved')}</span>}
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.booking.description')}</p>

        {/* Working hours — one row per day, with "Open" checkbox + open/close time inputs. */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('partnerProfile.booking.hoursLabel')}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.booking.hoursHelp')}</p>
          <div className="space-y-2">
            {DAY_KEYS.map(day => {
              const dh = bookingHours[day]
              const isOpen = !!dh
              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-12 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    {t(`partnerProfile.booking.days.${day}`)}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer w-20">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={e => setDayOpen(day, e.target.checked)}
                    />
                    <span className="text-xs" style={{ color: isOpen ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {isOpen ? t('partnerProfile.booking.open') : t('partnerProfile.booking.closed')}
                    </span>
                  </label>
                  {isOpen && (
                    <>
                      <input
                        type="time"
                        value={dh!.open}
                        onChange={e => setDayHours(day, 'open', e.target.value)}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.booking.to')}</span>
                      <input
                        type="time"
                        value={dh!.close}
                        onChange={e => setDayHours(day, 'close', e.target.value)}
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

        {/* Numeric prefs — slot duration, min notice, max advance, buffers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <NumField
            label={t('partnerProfile.booking.slotDuration.label')}
            help={t('partnerProfile.booking.slotDuration.help')}
            value={slotDuration}
            min={5}
            max={480}
            onChange={setSlotDuration}
          />
          <NumField
            label={t('partnerProfile.booking.minNotice.label')}
            help={t('partnerProfile.booking.minNotice.help')}
            value={minNotice}
            min={0}
            max={60 * 24 * 7}
            onChange={setMinNotice}
          />
          <NumField
            label={t('partnerProfile.booking.maxAdvance.label')}
            help={t('partnerProfile.booking.maxAdvance.help')}
            value={maxAdvanceDays}
            min={1}
            max={365}
            onChange={setMaxAdvanceDays}
          />
          <NumField
            label={t('partnerProfile.booking.bufferBefore.label')}
            help={t('partnerProfile.booking.bufferBefore.help')}
            value={bufferBefore}
            min={0}
            max={240}
            onChange={setBufferBefore}
          />
          <NumField
            label={t('partnerProfile.booking.bufferAfter.label')}
            help={t('partnerProfile.booking.bufferAfter.help')}
            value={bufferAfter}
            min={0}
            max={240}
            onChange={setBufferAfter}
          />
        </div>

        {/* Timezone — separate from User.preferredTimezone so the partner can
            run their booking calendar in a different zone from their dashboard. */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('partnerProfile.booking.timezone.label')}
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerProfile.booking.timezone.help')}</p>
          <TimezoneSelect value={bookingTz} onChange={setBookingTz} />
        </div>

        {bookingError && (
          <div className="text-xs mb-3 px-2 py-1 rounded" style={{ background: 'oklch(60% 0.2 30 / 0.15)', color: 'oklch(55% 0.20 30)' }}>
            {bookingError}
          </div>
        )}

        <button
          onClick={saveBookingPrefs}
          disabled={savingBooking}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: savedBooking ? 'oklch(55% 0.18 145)' : 'var(--brand-500)', color: '#fff', opacity: savingBooking ? 0.6 : 1 }}
        >
          {savingBooking
            ? t('partnerProfile.booking.saving')
            : savedBooking
              ? t('partnerProfile.saved')
              : t('partnerProfile.booking.savePreferences')}
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

function NumField({ label, help, value, min, max, onChange }: {
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
