'use client'

import { useState, useEffect } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface SystemSettings {
  google: { clientId: string | null; clientSecret: boolean; redirectUri: string | null }
  stripe: { secretKey: boolean; publishableKey: string | null; webhookSecret: boolean }
  twilio: { accountSid: string | null; authToken: boolean; phoneNumber: string | null }
  reoon: { apiKey: boolean; mode: string }
  bunny: { apiKey: boolean; storageZone: string | null; cdnHostname: string | null; storageRegion: string; storagePassword: boolean }
  storage: { defaultQuotaGb: number; warningThresholdPct: number; retentionDays: number | null }
  openai: { apiKey: boolean; model: string }
  smtp: { host: string | null; port: number; user: string | null; password: boolean; from: string | null }
}

interface TierConfig {
  tier: string
  quotaBytes: number
  quotaGb: number
  retentionDays: number | null
  gracePeriodDays: number
}

interface AffiliateSettings {
  cookieDurationDays: number
  commissionRatePct: number
  commissionType: string
  minPayoutCents: number
  programName: string
  programDescription: string
  termsUrl: string | null
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
  const { data: affSettings, reload: reloadAff } = useApi<AffiliateSettings>('/api/admin/affiliate/settings')
  const { data: tierData, reload: reloadTiers } = useApi<TierConfig[]>('/api/admin/storage-tiers')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Affiliate settings form
  const [aff, setAff] = useState<Partial<AffiliateSettings>>({})
  const [affSaving, setAffSaving] = useState(false)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  async function saveAffiliate(e: React.FormEvent) {
    e.preventDefault()
    if (!Object.keys(aff).length) { showToast('error', 'No changes to save.'); return }
    setAffSaving(true)
    const res = await apiFetchRaw('/api/admin/affiliate/settings', {
      method: 'PATCH',
      body: JSON.stringify(aff),
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json() as { errors?: { message: string }[] }
    if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed to save affiliate settings'); setAffSaving(false); return }
    setAff({})
    reloadAff()
    showToast('success', 'Affiliate settings saved.')
    setAffSaving(false)
  }

  function affVal<K extends keyof AffiliateSettings>(key: K): AffiliateSettings[K] {
    return (aff[key] ?? affSettings?.[key]) as AffiliateSettings[K]
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
  const [s, setS] = useState({ secretKey: '', publishableKey: '', webhookSecret: '' })
  const [sSaving, setSSaving] = useState(false)
  async function saveStripe(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (s.secretKey) body['secretKey'] = s.secretKey
    if (s.publishableKey) body['publishableKey'] = s.publishableKey
    if (s.webhookSecret) body['webhookSecret'] = s.webhookSecret
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setSSaving(true)
    const ok = await saveSection('stripe', body, 'Stripe')
    if (ok) setS({ secretKey: '', publishableKey: '', webhookSecret: '' })
    setSSaving(false)
  }

  // Twilio form state
  const [t, setT] = useState({ accountSid: '', authToken: '', phoneNumber: '' })
  const [tSaving, setTSaving] = useState(false)

  // Bunny form state
  const [b, setB] = useState({ apiKey: '', storageZone: '', storagePassword: '', cdnHostname: '', storageRegion: 'ny' })
  const [bSaving, setBSaving] = useState(false)
  async function saveBunny(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (b.apiKey)          body['apiKey']          = b.apiKey
    if (b.storageZone)     body['storageZone']      = b.storageZone
    if (b.storagePassword) body['storagePassword']  = b.storagePassword
    if (b.cdnHostname)     body['cdnHostname']      = b.cdnHostname
    if (b.storageRegion)   body['storageRegion']    = b.storageRegion
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setBSaving(true)
    const ok = await saveSection('bunny', body, 'Bunny.net')
    if (ok) setB({ apiKey: '', storageZone: '', storagePassword: '', cdnHostname: '', storageRegion: 'ny' })
    setBSaving(false)
  }

  // Storage quota form state
  const [sq, setSq] = useState({ defaultQuotaGb: '', warningThresholdPct: '', retentionDays: '' })
  const [sqSaving, setSqSaving] = useState(false)
  async function saveStorage(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = {}
    if (sq.defaultQuotaGb)      body['defaultQuotaGb']      = parseInt(sq.defaultQuotaGb)
    if (sq.warningThresholdPct) body['warningThresholdPct'] = parseInt(sq.warningThresholdPct)
    if (sq.retentionDays !== '') body['retentionDays']       = sq.retentionDays ? parseInt(sq.retentionDays) : null
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setSqSaving(true)
    const res = await apiFetchRaw('/api/admin/system-settings/storage', {
      method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json() as { errors?: { message: string }[] }
    if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); setSqSaving(false); return }
    reload()
    showToast('success', 'Storage settings saved.')
    setSq({ defaultQuotaGb: '', warningThresholdPct: '', retentionDays: '' })
    setSqSaving(false)
  }

  // Storage tier editing state
  const [tierEdits, setTierEdits] = useState<Record<string, { quotaGb: string; retentionDays: string; gracePeriodDays: string }>>({})
  const [tierSaving, setTierSaving] = useState<string | null>(null)

  useEffect(() => {
    if (tierData) {
      const init: typeof tierEdits = {}
      for (const t of tierData) {
        init[t.tier] = {
          quotaGb:         String(t.quotaGb),
          retentionDays:   t.retentionDays ? String(t.retentionDays) : '',
          gracePeriodDays: String(t.gracePeriodDays),
        }
      }
      setTierEdits(init)
    }
  }, [tierData])

  async function saveTier(tier: string) {
    const edit = tierEdits[tier]
    if (!edit) return
    setTierSaving(tier)
    const body: Record<string, unknown> = {
      quotaGb:         parseFloat(edit.quotaGb) || 1,
      retentionDays:   edit.retentionDays ? parseInt(edit.retentionDays) : null,
      gracePeriodDays: parseInt(edit.gracePeriodDays) || 30,
    }
    const res = await apiFetchRaw(`/api/admin/storage-tiers/${tier}`, {
      method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json() as { errors?: { message: string }[] }
    if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); setTierSaving(null); return }
    reloadTiers()
    showToast('success', `${tier} tier saved.`)
    setTierSaving(null)
  }

  // OpenAI form state
  const [oa, setOa] = useState({ apiKey: '', model: '' })
  const [oaSaving, setOaSaving] = useState(false)
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', password: '', from: '' })
  const [smtpSaving, setSmtpSaving] = useState(false)
  async function saveOpenAi(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (oa.apiKey) body['apiKey'] = oa.apiKey
    if (oa.model)  body['model']  = oa.model
    if (!Object.keys(body).length) { showToast('error', 'Enter at least one field.'); return }
    setOaSaving(true)
    const ok = await saveSection('openai', body, 'OpenAI')
    if (ok) setOa({ apiKey: '', model: '' })
    setOaSaving(false)
  }

  // Reoon form state
  const [r, setR] = useState({ apiKey: '', mode: 'power' })
  const [rSaving, setRSaving] = useState(false)
  async function saveReoon(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, string> = {}
    if (r.apiKey) body['apiKey'] = r.apiKey
    if (r.mode) body['mode'] = r.mode
    if (!r.apiKey && !r.mode) { showToast('error', 'Enter at least one field.'); return }
    setRSaving(true)
    const ok = await saveSection('reoon', body, 'Reoon')
    if (ok) setR({ apiKey: '', mode: 'power' })
    setRSaving(false)
  }
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

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault()
    setSmtpSaving(true)
    const body: Record<string, string> = {}
    if (smtp.host)     body['host']     = smtp.host
    if (smtp.port)     body['port']     = smtp.port
    if (smtp.user)     body['user']     = smtp.user
    if (smtp.password) body['password'] = smtp.password
    if (smtp.from)     body['from']     = smtp.from
    await saveSection('smtp', body, 'SMTP')
    setSmtp({ host: '', port: '587', user: '', password: '', from: '' })
    setSmtpSaving(false)
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

          {/* ── OpenAI ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="OpenAI"
              subtitle="Platform-wide API key used for call summaries, transcription, agent reasoning, and all LLM-powered features across every tenant. Get your key at platform.openai.com → API keys."
              configured={!!data?.openai?.apiKey}
            />

            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="API Key" value={!!data?.openai?.apiKey} isSecret />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Active model</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {data?.openai?.model ?? 'gpt-4o-mini'}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                  {data?.openai?.model ?? 'gpt-4o-mini'}
                </span>
              </div>
              <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Used for</p>
                <ul className="space-y-0.5 list-disc list-inside" style={{ color: 'var(--text-tertiary)' }}>
                  <li>Post-call summary generation (inbound, outbound, widget)</li>
                  <li>Agent reasoning and orchestration</li>
                  <li>Email verification and contact enrichment</li>
                  <li>Campaign copy and outbound script assistance</li>
                </ul>
              </div>
            </div>

            <form onSubmit={saveOpenAi} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                API key is stored encrypted. Leave blank to keep the current value. All tenants share this key — usage is billed to this account.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>API Key <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={oa.apiKey}
                    onChange={e => setOa(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="sk-…" autoComplete="new-password" />
                </div>
                <div>
                  <label className={labelCls}>Model override <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
                  <select className={inputCls} value={oa.model} onChange={e => setOa(p => ({ ...p, model: e.target.value }))}>
                    <option value="">Keep current ({data?.openai?.model ?? 'gpt-4o-mini'})</option>
                    <option value="gpt-4o-mini">gpt-4o-mini — fast, cost-efficient (recommended)</option>
                    <option value="gpt-4o">gpt-4o — higher quality, higher cost</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={oaSaving} className="btn-primary">
                {oaSaving ? 'Saving…' : 'Save OpenAI credentials'}
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
              <StatusRow label="Publishable Key" value={stripe?.publishableKey ?? null} />
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
                  <label className={labelCls}>Publishable Key</label>
                  <input type="text" className={inputCls} value={s.publishableKey} onChange={e => setS(p => ({ ...p, publishableKey: e.target.value }))}
                    placeholder="pk_live_… or pk_test_…" autoComplete="off" />
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

          {/* ── Storage Tiers ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Recording Storage Tiers"
              subtitle="Set storage quota, retention period, and downgrade grace period per plan tier. Changes apply to new assignments. Existing tenants in grace period are protected until it expires."
              configured={!!tierData?.length}
            />
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                ⚠ Stripe-based automatic tier assignment is deferred — assign tiers manually from the tenant detail page until billing is finalized.
              </p>
              {(tierData ?? []).map(t => {
                const edit = tierEdits[t.tier] ?? { quotaGb: String(t.quotaGb), retentionDays: t.retentionDays ? String(t.retentionDays) : '', gracePeriodDays: String(t.gracePeriodDays) }
                const tierColors: Record<string, string> = {
                  LTD: 'oklch(55% 0.18 145)', BASIC: 'oklch(55% 0.11 193)',
                  ESSENTIALS: 'oklch(55% 0.14 250)', PREMIUM: 'oklch(55% 0.18 300)', ENTERPRISE: 'oklch(55% 0.18 25)',
                }
                return (
                  <div key={t.tier} className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: tierColors[t.tier] ?? 'gray', color: 'white' }}>
                        {t.tier}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Current: {t.quotaGb} GB · {t.retentionDays ? `${t.retentionDays}d retention` : 'Forever'} · {t.gracePeriodDays}d grace
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelCls}>Quota (GB)</label>
                        <input type="number" min="0.1" step="0.5" className={inputCls}
                          value={edit.quotaGb}
                          onChange={e => setTierEdits(p => ({ ...p, [t.tier]: { ...edit, quotaGb: e.target.value } }))} />
                      </div>
                      <div>
                        <label className={labelCls}>Retention (days) — blank = forever</label>
                        <input type="number" min="1" className={inputCls}
                          value={edit.retentionDays}
                          placeholder="Forever"
                          onChange={e => setTierEdits(p => ({ ...p, [t.tier]: { ...edit, retentionDays: e.target.value } }))} />
                      </div>
                      <div>
                        <label className={labelCls}>Downgrade grace period (days)</label>
                        <input type="number" min="1" max="365" className={inputCls}
                          value={edit.gracePeriodDays}
                          onChange={e => setTierEdits(p => ({ ...p, [t.tier]: { ...edit, gracePeriodDays: e.target.value } }))} />
                      </div>
                    </div>
                    <button onClick={() => saveTier(t.tier)} disabled={tierSaving === t.tier} className="btn-primary text-xs py-1.5">
                      {tierSaving === t.tier ? 'Saving…' : `Save ${t.tier}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Reoon Email Verifier ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Reoon Email Verifier"
              subtitle="Platform-wide email verification used across all tenants. Validates every contact email on save — catches invalid, disposable, and risky addresses before campaigns fire."
              configured={!!data?.reoon?.apiKey}
            />

            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="API Key" value={!!data?.reoon?.apiKey} isSecret />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Verification mode</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {data?.reoon?.mode ?? 'power'}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                  {data?.reoon?.mode === 'quick' ? 'Quick' : 'Power'}
                </span>
              </div>
            </div>

            <form onSubmit={saveReoon} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                API key is stored encrypted. Leave blank to keep the current value. Mode controls verification depth — Power is recommended.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>API Key <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={r.apiKey}
                    onChange={e => setR(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="Enter API key to replace current" autoComplete="new-password" />
                </div>
                <div>
                  <label className={labelCls}>Verification mode</label>
                  <select className={inputCls} value={r.mode} onChange={e => setR(p => ({ ...p, mode: e.target.value }))}>
                    <option value="power">Power — deep validation (recommended)</option>
                    <option value="quick">Quick — faster, less thorough</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={rSaving} className="btn-primary">
                {rSaving ? 'Saving…' : 'Save Reoon settings'}
              </button>
            </form>
          </div>

          {/* ── Bunny.net Storage ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Bunny.net Storage & Streaming"
              subtitle="Platform-wide object storage for voice recordings. All tenant recordings are stored in one Bunny zone, isolated by tenant folder. Tenants stream audio via the CDN — credentials never exposed to tenants."
              configured={!!(data?.bunny?.apiKey && data?.bunny?.storageZone && data?.bunny?.storagePassword && data?.bunny?.cdnHostname)}
            />
            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusRow label="API Key"          value={!!data?.bunny?.apiKey}          isSecret />
              <StatusRow label="Storage Zone"     value={data?.bunny?.storageZone ?? null} />
              <StatusRow label="Storage Password" value={!!data?.bunny?.storagePassword}  isSecret />
              <StatusRow label="CDN Hostname"     value={data?.bunny?.cdnHostname ?? null} />
              <StatusRow label="Storage Region"   value={data?.bunny?.storageRegion ?? 'ny'} />
            </div>
            <form onSubmit={saveBunny} className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                API key and storage password are stored encrypted. Leave any field blank to keep the current value.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>API Key <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={b.apiKey}
                    onChange={e => setB(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="Enter API key to replace current" autoComplete="new-password" />
                </div>
                <div>
                  <label className={labelCls}>Storage Zone Name</label>
                  <input className={inputCls} value={b.storageZone}
                    onChange={e => setB(p => ({ ...p, storageZone: e.target.value }))}
                    placeholder="myorbisvoice-recordings" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Storage Password <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
                  <input type="password" className={inputCls} value={b.storagePassword}
                    onChange={e => setB(p => ({ ...p, storagePassword: e.target.value }))}
                    placeholder="Enter storage zone password" autoComplete="new-password" />
                </div>
                <div>
                  <label className={labelCls}>CDN Hostname</label>
                  <input className={inputCls} value={b.cdnHostname}
                    onChange={e => setB(p => ({ ...p, cdnHostname: e.target.value }))}
                    placeholder="recordings.b-cdn.net" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Storage Region</label>
                  <select className={inputCls} value={b.storageRegion}
                    onChange={e => setB(p => ({ ...p, storageRegion: e.target.value }))}>
                    <option value="ny">New York (NY)</option>
                    <option value="la">Los Angeles (LA)</option>
                    <option value="sg">Singapore (SG)</option>
                    <option value="syd">Sydney (SYD)</option>
                    <option value="uk">London (UK)</option>
                    <option value="de">Frankfurt (DE)</option>
                    <option value="se">Stockholm (SE)</option>
                    <option value="br">São Paulo (BR)</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={bSaving} className="btn-primary">
                {bSaving ? 'Saving…' : 'Save Bunny.net credentials'}
              </button>
            </form>
          </div>

          {/* ── Recording Storage Limits ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Recording Storage Limits"
              subtitle="Default quota applied to all tenants. Individual tenants can be overridden from their detail page. Tenants are warned at 90% and recordings pause at 100%."
              configured={true}
            />
            <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Default quota',      value: `${data?.storage?.defaultQuotaGb ?? 1} GB` },
                  { label: 'Warning threshold',  value: `${data?.storage?.warningThresholdPct ?? 90}%` },
                  { label: 'Retention',          value: data?.storage?.retentionDays ? `${data.storage.retentionDays} days` : 'Forever' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs pt-1" style={{ color: 'var(--text-tertiary)' }}>
                ⚠ Stripe-based automatic quota assignment is deferred. Limits are set manually until billing tiers are finalized.
              </p>
            </div>
            <form onSubmit={saveStorage} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Default quota (GB)</label>
                  <input type="number" min="1" className={inputCls} value={sq.defaultQuotaGb}
                    onChange={e => setSq(p => ({ ...p, defaultQuotaGb: e.target.value }))}
                    placeholder={String(data?.storage?.defaultQuotaGb ?? 1)} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Applied to all tenants without an override</p>
                </div>
                <div>
                  <label className={labelCls}>Warning threshold (%)</label>
                  <input type="number" min="50" max="99" className={inputCls} value={sq.warningThresholdPct}
                    onChange={e => setSq(p => ({ ...p, warningThresholdPct: e.target.value }))}
                    placeholder={String(data?.storage?.warningThresholdPct ?? 90)} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Tenant gets a warning banner above this %</p>
                </div>
                <div>
                  <label className={labelCls}>Retention (days) <span style={{ color: 'var(--text-tertiary)' }}>— blank = forever</span></label>
                  <input type="number" min="1" className={inputCls} value={sq.retentionDays}
                    onChange={e => setSq(p => ({ ...p, retentionDays: e.target.value }))}
                    placeholder="e.g. 365 or leave blank" />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Recordings older than this are auto-deleted</p>
                </div>
              </div>
              <button type="submit" disabled={sqSaving} className="btn-primary">
                {sqSaving ? 'Saving…' : 'Save storage limits'}
              </button>
            </form>
          </div>

          {/* ── Affiliate Program ── */}
          <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <CardHeader
              title="Affiliate Program"
              subtitle="Controls commission rate, cookie tracking duration, and payout thresholds for the affiliate program."
              configured={!!affSettings}
            />

            {affSettings && (
              <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Commission rate', value: `${affSettings.commissionRatePct}%` },
                    { label: 'Cookie duration',  value: `${affSettings.cookieDurationDays} days` },
                    { label: 'Min payout',       value: `$${(affSettings.minPayoutCents / 100).toFixed(2)}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={saveAffiliate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Commission rate (%)</label>
                  <input type="number" min="0" max="100" step="0.1" className={inputCls}
                    value={affVal('commissionRatePct') ?? ''}
                    onChange={e => setAff(p => ({ ...p, commissionRatePct: parseFloat(e.target.value) || 0 }))}
                    placeholder="20" />
                </div>
                <div>
                  <label className={labelCls}>Cookie duration (days)</label>
                  <input type="number" min="1" max="365" className={inputCls}
                    value={affVal('cookieDurationDays') ?? ''}
                    onChange={e => setAff(p => ({ ...p, cookieDurationDays: parseInt(e.target.value) || 30 }))}
                    placeholder="30" />
                </div>
                <div>
                  <label className={labelCls}>Commission type</label>
                  <select className={inputCls}
                    value={affVal('commissionType') ?? 'PERCENTAGE'}
                    onChange={e => setAff(p => ({ ...p, commissionType: e.target.value }))}>
                    <option value="PERCENTAGE">Percentage of sale</option>
                    <option value="FLAT">Flat amount</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Minimum payout (cents)</label>
                  <input type="number" min="100" className={inputCls}
                    value={affVal('minPayoutCents') ?? ''}
                    onChange={e => setAff(p => ({ ...p, minPayoutCents: parseInt(e.target.value) || 5000 }))}
                    placeholder="5000" />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {affVal('minPayoutCents') ? `= $${((affVal('minPayoutCents') as number) / 100).toFixed(2)}` : '5000 = $50.00'}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Program name</label>
                  <input className={inputCls}
                    value={affVal('programName') ?? ''}
                    onChange={e => setAff(p => ({ ...p, programName: e.target.value }))}
                    placeholder="Affiliate Program" />
                </div>
                <div>
                  <label className={labelCls}>Terms URL <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
                  <input className={inputCls}
                    value={affVal('termsUrl') ?? ''}
                    onChange={e => setAff(p => ({ ...p, termsUrl: e.target.value || null }))}
                    placeholder="https://myorbisvoice.com/terms.html" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Program description</label>
                <input className={inputCls}
                  value={affVal('programDescription') ?? ''}
                  onChange={e => setAff(p => ({ ...p, programDescription: e.target.value }))}
                  placeholder="Earn commission by referring new customers." />
              </div>
              <button type="submit" disabled={affSaving} className="btn-primary">
                {affSaving ? 'Saving…' : 'Save affiliate settings'}
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

      {/* ── SMTP / Email ── */}
      <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <CardHeader
          title="SMTP / Transactional Email"
          subtitle="Sends call notification emails to tenants. Use a dedicated sending subdomain (e.g. notify.myorbisvoice.com). Compatible with SendGrid, Postmark, Mailgun, or any SMTP provider."
          configured={!!(data?.smtp?.host && data?.smtp?.user && data?.smtp?.password)}
        />
        <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <StatusRow label="Host"     value={data?.smtp?.host ?? null} />
          <StatusRow label="Port"     value={String(data?.smtp?.port ?? 587)} />
          <StatusRow label="User"     value={data?.smtp?.user ?? null} />
          <StatusRow label="Password" value={!!data?.smtp?.password} isSecret />
          <StatusRow label="From"     value={data?.smtp?.from ?? null} />
        </div>
        <form onSubmit={saveSmtp} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>SMTP Host</label>
              <input className={inputCls} value={smtp.host} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} placeholder="smtp.sendgrid.net" autoComplete="off" />
            </div>
            <div>
              <label className={labelCls}>Port</label>
              <input className={inputCls} value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: e.target.value }))} placeholder="587" autoComplete="off" />
            </div>
          </div>
          <div>
            <label className={labelCls}>SMTP Username</label>
            <input className={inputCls} value={smtp.user} onChange={e => setSmtp(p => ({ ...p, user: e.target.value }))} placeholder="apikey" autoComplete="off" />
          </div>
          <div>
            <label className={labelCls}>SMTP Password / API Key <span style={{ color: 'var(--text-tertiary)' }}>(write-only)</span></label>
            <input className={inputCls} type="password" value={smtp.password} onChange={e => setSmtp(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div>
            <label className={labelCls}>From Address</label>
            <input className={inputCls} type="email" value={smtp.from} onChange={e => setSmtp(p => ({ ...p, from: e.target.value }))} placeholder="notify@myorbisvoice.com" autoComplete="off" />
          </div>
          <button type="submit" disabled={smtpSaving} className="btn-primary">
            {smtpSaving ? 'Saving…' : 'Save SMTP settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
