'use client'

import { useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface SystemSettings {
  google: { clientId: string | null; clientSecret: boolean; redirectUri: string | null }
  stripe: { secretKey: boolean; webhookSecret: boolean }
  twilio: { accountSid: string | null; authToken: boolean; phoneNumber: string | null }
}

function StatusBadge({ set }: { set: boolean }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded flex-shrink-0"
      style={set
        ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
        : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
      }
    >
      {set ? 'Set' : 'Not set'}
    </span>
  )
}

function StatusRow({ label, value, isSecret }: { label: string; value: string | null | boolean; isSecret?: boolean }) {
  const isSet = isSecret ? !!value : !!value
  const display = isSecret ? (isSet ? '••••••••••••' : 'Not set') : (value as string | null) ?? 'Not set'
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{display}</p>
      </div>
      <StatusBadge set={isSet} />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2 py-1 rounded transition-colors flex-shrink-0"
      style={{ background: 'var(--surface-overlay)', color: copied ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CardHeader({ title, subtitle, configured }: { title: string; subtitle: string; configured: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
        style={configured
          ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
          : { background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }
        }
      >
        {configured ? 'Configured' : 'Missing'}
      </span>
    </div>
  )
}

export default function SystemSettingsPage() {
  const { data, loading, reload } = useApi<SystemSettings>('/api/admin/system-settings')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  async function saveSection(path: string, body: Record<string, string>, label: string) {
    const res = await apiFetchRaw(`/api/admin/system-settings/${path}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json() as { errors?: { message: string }[] }
    if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? `Failed to save ${label}`); return false }
    reload()
    showToast('success', `${label} settings saved.`)
    return true
  }

  // Google form state
  const [g, setG] = useState({ clientId: '', clientSecret: '', redirectUri: '' })
  const [gSaving, setGSaving] = useState(false)
  async function saveGoogle(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (g.clientId) body['clientId'] = g.clientId
    if (g.clientSecret) body['clientSecret'] = g.clientSecret
    if (g.redirectUri) body['redirectUri'] = g.redirectUri
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setGSaving(true)
    const ok = await saveSection('google', body, 'Google OAuth')
    if (ok) setG({ clientId: '', clientSecret: '', redirectUri: '' })
    setGSaving(false)
  }

  // Stripe form state
  const [s, setS] = useState({ secretKey: '', webhookSecret: '' })
  const [sSaving, setSSaving] = useState(false)
  async function saveStripe(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (s.secretKey) body['secretKey'] = s.secretKey
    if (s.webhookSecret) body['webhookSecret'] = s.webhookSecret
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setSSaving(true)
    const ok = await saveSection('stripe', body, 'Stripe')
    if (ok) setS({ secretKey: '', webhookSecret: '' })
    setSSaving(false)
  }

  // Twilio form state
  const [t, setT] = useState({ accountSid: '', authToken: '', phoneNumber: '' })
  const [tSaving, setTSaving] = useState(false)
  async function saveTwilio(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (t.accountSid) body['accountSid'] = t.accountSid
    if (t.authToken) body['authToken'] = t.authToken
    if (t.phoneNumber) body['phoneNumber'] = t.phoneNumber
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setTSaving(true)
    const ok = await saveSection('twilio', body, 'Twilio')
    if (ok) setT({ accountSid: '', authToken: '', phoneNumber: '' })
    setTSaving(false)
  }

  const google = data?.google
  const stripe = data?.stripe
  const twilio = data?.twilio
  const redirectUriDisplay = google?.redirectUri ?? 'https://api.myorbisvoice.com/api/integrations/google/callback'

  const inputCls = 'input font-mono text-sm'
  const labelCls = 'label'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>System Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Platform-level credentials stored encrypted in the database. Blank fields keep the current value.
        </p>
      </div>

      {loading && <div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />}

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>
      )}

      {!loading && (
        <>
          {/* ── Google OAuth ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Google OAuth"
              subtitle="Required for tenant Google account connections (agent mailbox, Calendar). Create a project at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID."
              configured={!!google?.clientSecret}
            />

            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="Client ID" value={google?.clientId ?? null} />
              <StatusRow label="Client Secret" value={!!google?.clientSecret} isSecret />
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Redirect URI <span className="font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>— whitelist this in Google Cloud Console</span>
                </p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                  <code className="text-xs flex-1 break-all" style={{ color: 'var(--text-secondary)' }}>{redirectUriDisplay}</code>
                  <CopyButton text={redirectUriDisplay} />
                </div>
              </div>
            </div>

            <form onSubmit={saveGoogle} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Leave a field blank to keep the current value. Secrets are never returned in API responses.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Client ID</label>
                  <input className={inputCls} value={g.clientId} onChange={e => setG(p => ({ ...p, clientId: e.target.value }))}
                    placeholder="123456789-abc.apps.googleusercontent.com" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Client Secret <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={g.clientSecret} onChange={e => setG(p => ({ ...p, clientSecret: e.target.value }))}
                    placeholder="Enter new secret to replace current" autoComplete="new-password" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Redirect URI override <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
                <input className={inputCls} value={g.redirectUri} onChange={e => setG(p => ({ ...p, redirectUri: e.target.value }))}
                  placeholder={redirectUriDisplay} autoComplete="off" />
              </div>
              <button type="submit" disabled={gSaving} className="btn-primary">
                {gSaving ? 'Saving…' : 'Save Google credentials'}
              </button>
            </form>
          </div>

          {/* ── Stripe ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Stripe"
              subtitle="Required for subscription billing, checkout sessions, and webhook lifecycle. Use test mode keys during development."
              configured={!!(stripe?.secretKey && stripe?.webhookSecret)}
            />

            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="Secret Key" value={!!stripe?.secretKey} isSecret />
              <StatusRow label="Webhook Secret" value={!!stripe?.webhookSecret} isSecret />
            </div>

            <form onSubmit={saveStripe} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Keys are encrypted at rest. Leave blank to keep the current value.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Secret Key <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={s.secretKey} onChange={e => setS(p => ({ ...p, secretKey: e.target.value }))}
                    placeholder="sk_live_… or sk_test_…" autoComplete="new-password" />
                </div>
                <div>
                  <label className={labelCls}>Webhook Secret <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={s.webhookSecret} onChange={e => setS(p => ({ ...p, webhookSecret: e.target.value }))}
                    placeholder="whsec_…" autoComplete="new-password" />
                </div>
              </div>
              <button type="submit" disabled={sSaving} className="btn-primary">
                {sSaving ? 'Saving…' : 'Save Stripe credentials'}
              </button>
            </form>
          </div>

          {/* ── Twilio ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Twilio"
              subtitle="Required for inbound and outbound voice calls and SMS. Not needed until Phase 6."
              configured={!!(twilio?.accountSid && twilio?.authToken)}
            />

            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="Account SID" value={twilio?.accountSid ?? null} />
              <StatusRow label="Auth Token" value={!!twilio?.authToken} isSecret />
              <StatusRow label="Phone Number" value={twilio?.phoneNumber ?? null} />
            </div>

            <form onSubmit={saveTwilio} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Leave blank to keep the current value. Auth Token is stored encrypted.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Account SID</label>
                  <input className={inputCls} value={t.accountSid} onChange={e => setT(p => ({ ...p, accountSid: e.target.value }))}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Auth Token <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={t.authToken} onChange={e => setT(p => ({ ...p, authToken: e.target.value }))}
                    placeholder="Enter auth token" autoComplete="new-password" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input className={inputCls} value={t.phoneNumber} onChange={e => setT(p => ({ ...p, phoneNumber: e.target.value }))}
                  placeholder="+15551234567" autoComplete="off" />
              </div>
              <button type="submit" disabled={tSaving} className="btn-primary">
                {tSaving ? 'Saving…' : 'Save Twilio credentials'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
