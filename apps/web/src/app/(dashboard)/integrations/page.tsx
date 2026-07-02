'use client'

import { useEffect, useState } from 'react'
import { apiFetch, apiFetchRaw, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

interface GoogleStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR' | 'RECONNECT_REQUIRED' | 'DISABLED'
  email: string | null; lastVerifiedAt: string | null; calendarCount: number
}
interface TwilioStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED'
  accountSid: string | null; lastVerifiedAt: string | null
}
interface GeminiStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED'
  lastVerifiedAt: string | null
}
interface IntegrationsData {
  google: GoogleStatus
  twilio: TwilioStatus
  gemini: GeminiStatus
}

// Status colour palette only — the human label resolves through t() at render
// so it follows the active locale.
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  CONNECTED:          { bg: 'oklch(19% 0.04 193)',     text: 'oklch(72% 0.12 193)' },
  NOT_CONNECTED:      { bg: 'var(--surface-overlay)',  text: 'var(--text-secondary)' },
  ERROR:              { bg: 'oklch(13% 0.04 25)',      text: 'oklch(68% 0.20 25)' },
  RECONNECT_REQUIRED: { bg: 'oklch(14% 0.04 75)',      text: 'oklch(70% 0.16 75)' },
  DISABLED:           { bg: 'var(--surface-overlay)',  text: 'var(--text-tertiary)' },
}

const STATUS_LABEL_KEY: Record<string, string> = {
  CONNECTED:          'tenantIntegrations.statusPill.connected',
  NOT_CONNECTED:      'tenantIntegrations.statusPill.notConnected',
  ERROR:              'tenantIntegrations.statusPill.error',
  RECONNECT_REQUIRED: 'tenantIntegrations.statusPill.reconnectRequired',
  DISABLED:           'tenantIntegrations.statusPill.disabled',
}

const inp = 'input'

export default function IntegrationsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const { data, loading, error, reload } = useApi<IntegrationsData>('/api/integrations')
  const [connecting, setConnecting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // (Twilio + Gemini are platform-managed in the new model — no per-tenant form needed)

  // Gmail test send — defaults are translated, but user-edited values are kept
  const [gmailTest, setGmailTest] = useState({
    to: '',
    subject: t('tenantIntegrations.google.test.defaultSubject'),
    body: t('tenantIntegrations.google.test.defaultBody'),
  })
  const [gmailSending, setGmailSending] = useState(false)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google')
    const email  = params.get('email')
    const reason = params.get('reason')
    if (result === 'success' && email) {
      showToast('success', t('tenantIntegrations.toasts.googleConnected', { email }))
      reload()
      window.history.replaceState({}, '', '/integrations')
    } else if (result === 'error') {
      showToast('error', t('tenantIntegrations.toasts.googleConnectionFailed', {
        reason: reason ?? t('tenantIntegrations.toasts.googleConnectionFailedReasonUnknown'),
      }))
      window.history.replaceState({}, '', '/integrations')
    }
  }, [reload, t])

  async function startOAuth(endpoint: string) {
    setConnecting(true)
    try {
      const res  = await apiFetchRaw(endpoint, { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; errors?: { message: string }[] }
      if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? t('tenantIntegrations.toasts.failed')); return }
      window.location.href = json.data!.url
    } catch { showToast('error', t('tenantIntegrations.toasts.failedStartGoogle')) }
    finally { setConnecting(false) }
  }

  async function disconnectGoogle() {
    if (!confirm(t('tenantIntegrations.confirms.disconnectGoogle'))) return
    setConnecting(true)
    try {
      const res  = await apiFetchRaw('/api/integrations/google', { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as { errors?: { message: string }[] }
        showToast('error', json.errors?.[0]?.message ?? t('tenantIntegrations.toasts.failedDisconnect'))
        return
      }
      showToast('success', t('tenantIntegrations.toasts.googleDisconnected'))
      reload()
    } catch { showToast('error', t('tenantIntegrations.toasts.failedDisconnectGoogle')) }
    finally { setConnecting(false) }
  }

  // saveTwilio / disconnectTwilio removed — Twilio is platform-managed in the new model.
  // Numbers are requested via the Phone Numbers page; admins provision them.

  async function sendTestEmail() {
    if (!gmailTest.to || !gmailTest.subject || !gmailTest.body) return
    setGmailSending(true)
    try {
      await apiFetch('/api/integrations/google/send-email', {
        method: 'POST',
        body: JSON.stringify({ to: gmailTest.to, subject: gmailTest.subject, body: gmailTest.body }),
      })
      showToast('success', t('tenantIntegrations.toasts.testEmailSent', { to: gmailTest.to }))
    } catch (err) { showToast('error', err instanceof Error ? err.message : t('tenantIntegrations.toasts.failedSend')) }
    finally { setGmailSending(false) }
  }

  const google      = data?.google
  const twilio      = data?.twilio
  const googleStyle = STATUS_STYLES[google?.status ?? 'NOT_CONNECTED']!
  const twilioStyle = STATUS_STYLES[twilio?.status ?? 'NOT_CONNECTED']!
  const googleLabel = t(STATUS_LABEL_KEY[google?.status ?? 'NOT_CONNECTED']!)
  // Reference twilioStyle to keep parity with status-driven styling without
  // breaking the linter when the variable isn't yet read in JSX.
  void twilioStyle

  const calendarPlaceholders = [
    {
      name: t('tenantIntegrations.calendars.outlook.name'),
      desc: t('tenantIntegrations.calendars.outlook.desc'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" />
          <path d="M8 4v16M2 10h6M8 10h14" stroke="white" strokeWidth="1.5" />
          <rect x="10" y="12" width="4" height="4" fill="white" opacity="0.7" />
        </svg>
      ),
    },
    {
      name: t('tenantIntegrations.calendars.calendly.name'),
      desc: t('tenantIntegrations.calendars.calendly.desc'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#006BFF" />
          <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      name: t('tenantIntegrations.calendars.calcom.name'),
      desc: t('tenantIntegrations.calendars.calcom.desc'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="17" rx="2" fill="#111827" />
          <path d="M8 2v4M16 2v4M3 10h18" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="15" r="1.5" fill="#6EE7B7" />
          <circle cx="12" cy="15" r="1.5" fill="#6EE7B7" />
          <circle cx="16" cy="15" r="1.5" fill="#6EE7B7" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('tenantIntegrations.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantIntegrations.subtitle')}
        </p>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}
      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error   && <div className="alert-error">{t('tenantIntegrations.loadError')}</div>}

      {/* ── Google ─────────────────────────────────────────────────────── */}
      {!loading && google && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(19% 0.04 193)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.google.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.google.subtitle')}</p>
              </div>
            </div>
            <span className="badge" style={{ background: googleStyle.bg, color: googleStyle.text }}>{googleLabel}</span>
          </div>
          <div className="px-6 py-5">
            {google.status === 'CONNECTED' && (
              <dl className="space-y-2 mb-5">
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.google.labels.account')}</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-primary)' }}>{google.email}</dd>
                </div>
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.google.labels.calendars')}</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.google.calendarsFound', { n: google.calendarCount })}</dd>
                </div>
                {google.lastVerifiedAt && (
                  <div className="flex items-center gap-6">
                    <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.google.labels.lastVerified')}</dt>
                    <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(google.lastVerifiedAt).toLocaleString(dateLocale)}</dd>
                  </div>
                )}
              </dl>
            )}
            {google.status === 'NOT_CONNECTED' && <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('tenantIntegrations.google.notConnectedDesc')}</p>}
            {(google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && <p className="text-sm mb-5" style={{ color: 'var(--error-600)' }}>{t('tenantIntegrations.google.needsReauth')}</p>}
            <div className="flex flex-wrap gap-2.5">
              {google.status === 'NOT_CONNECTED' && (
                <button onClick={() => startOAuth('/api/integrations/google/start')} disabled={connecting} className="btn-primary">
                  {connecting ? t('tenantIntegrations.google.actions.redirecting') : t('tenantIntegrations.google.actions.connect')}
                </button>
              )}
              {(google.status === 'CONNECTED' || google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && (
                <>
                  <button onClick={() => startOAuth('/api/integrations/google/reconnect')} disabled={connecting} className="btn-ghost">
                    {connecting ? t('tenantIntegrations.google.actions.redirecting') : t('tenantIntegrations.google.actions.reconnect')}
                  </button>
                  <button onClick={disconnectGoogle} disabled={connecting} className="btn-danger">{t('tenantIntegrations.google.actions.disconnect')}</button>
                </>
              )}
            </div>
          </div>
          {/* Gmail test send — only when connected */}
          {google.status === 'CONNECTED' && (
            <div className="px-6 py-5 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.google.test.title')}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tenantIntegrations.google.test.desc')}</p>
              <div className="space-y-2">
                <input value={gmailTest.to} onChange={(e) => setGmailTest({ ...gmailTest, to: e.target.value })}
                  className={inp} type="email" placeholder={t('tenantIntegrations.google.test.placeholderTo')} />
                <input value={gmailTest.subject} onChange={(e) => setGmailTest({ ...gmailTest, subject: e.target.value })}
                  className={inp} placeholder={t('tenantIntegrations.google.test.placeholderSubject')} />
                <textarea value={gmailTest.body} onChange={(e) => setGmailTest({ ...gmailTest, body: e.target.value })}
                  className={inp} rows={3} placeholder={t('tenantIntegrations.google.test.placeholderBody')} />
              </div>
              <button onClick={sendTestEmail} disabled={gmailSending || !gmailTest.to} className="btn-secondary text-sm">
                {gmailSending ? t('tenantIntegrations.google.test.sending') : t('tenantIntegrations.google.test.send')}
              </button>
            </div>
          )}

          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.google.footer')}</p>
          </div>
        </div>
      )}

      {/* ── Twilio (managed by OrbisVoice — no tenant action required) ── */}
      {!loading && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f22f46' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5zm-2.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.twilio.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.twilio.subtitle')}</p>
              </div>
            </div>
            <span className="badge" style={{ background: 'oklch(95% 0.07 145 / 0.6)', color: 'oklch(40% 0.15 145)' }}>{t('tenantIntegrations.statusPill.managed')}</span>
          </div>

          <div className="px-6 py-5 space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('tenantIntegrations.twilio.intro')}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('tenantIntegrations.twilio.requestPrefix')}
              <a href="/phone-numbers" style={{ color: 'oklch(55% 0.11 193)', textDecoration: 'underline' }}>{t('tenantIntegrations.twilio.phoneNumbersLink')}</a>
              {t('tenantIntegrations.twilio.quotaMid')}
              <a href="/billing" style={{ color: 'oklch(55% 0.11 193)', textDecoration: 'underline' }}>{t('tenantIntegrations.twilio.billingLink')}</a>
              {t('tenantIntegrations.twilio.quotaSuffix')}
            </p>
          </div>

          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantIntegrations.twilio.footer')}
            </p>
          </div>
        </div>
      )}

      {/* ── Gemini Live (managed by OrbisVoice — included in plan) ────────── */}
      {!loading && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(19% 0.06 264)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L8.5 8.5 2 9.27l4.5 4.38L5.36 20 12 16.77 18.64 20l-1.14-6.35L22 9.27l-6.5-.77L12 2z" fill="oklch(72% 0.18 264)" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.gemini.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.gemini.subtitleManaged')}</p>
              </div>
            </div>
            <span className="badge" style={{ background: 'oklch(95% 0.07 145 / 0.6)', color: 'oklch(40% 0.15 145)' }}>{t('tenantIntegrations.statusPill.managed')}</span>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('tenantIntegrations.gemini.managedIntro')}
            </p>
          </div>

          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantIntegrations.gemini.managedFooter')}
            </p>
          </div>
        </div>
      )}

      {/* ── Coming Soon: Calendar Integrations ─────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>{t('tenantIntegrations.moreComingSoon')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {calendarPlaceholders.map((item) => (
            <div key={item.name} className="rounded-xl opacity-60" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-overlay)' }}>
                    {item.icon}
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                </div>
                <span className="badge" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.comingSoon')}</span>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── API Integration (Coming Soon) ───────────────────────────────── */}
      <div className="rounded-xl opacity-60" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-overlay)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M12 5v14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantIntegrations.restApi.title')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.restApi.subtitle')}</p>
            </div>
          </div>
          <span className="badge" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.comingSoon')}</span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantIntegrations.restApi.desc')}
          </p>
          <div className="mt-4 flex gap-2">
            <button disabled className="btn-primary opacity-40 cursor-not-allowed">{t('tenantIntegrations.restApi.actions.generate')}</button>
            <button disabled className="btn-ghost opacity-40 cursor-not-allowed">{t('tenantIntegrations.restApi.actions.viewDocs')}</button>
          </div>
        </div>
        <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantIntegrations.restApi.footer')}</p>
        </div>
      </div>
    </div>
  )
}
