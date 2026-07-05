'use client'

/**
 * Admin comp-code dashboard.
 *
 * Generates and tracks single-use 100%-off Stripe Promotion Codes scoped
 * to a specific plan tier (BASIC / PRO / PREMIER / ENTERPRISE — never LTD).
 * Stripe is the source of truth — no parallel DB. Each code is generated
 * via the API service against a tier-scoped Coupon configured in Stripe
 * Dashboard (see docs/runbook-comp-codes-setup.md).
 *
 * The recipient redeems the code at /billing checkout. Stripe enforces
 * tier scope (`applies_to.products`) and single-use limit; our existing
 * checkout.session.completed handler grants entitlements normally on the
 * resulting $0 subscription.
 */

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

type CompTier = 'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE' | 'SOLO_CAPTURE' | 'SOLO_POWER'
const VOICE_TIERS: readonly CompTier[] = ['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE']
const AGENT_TIERS: readonly CompTier[] = ['SOLO_CAPTURE', 'SOLO_POWER']
// MyOrbisAgents admin (app.myorbisagents.com) offers only the real-estate
// packages; the Voice admin offers the Voice tiers. Config-status returns all
// tiers server-side; the UI shows only the ones for its host.
function activeTiers(): readonly CompTier[] {
  return (typeof window !== 'undefined' && window.location.host === 'app.myorbisagents.com')
    ? AGENT_TIERS : VOICE_TIERS
}
// Display label for a tier code (SOLO_CAPTURE → "Solo Capture").
const TIER_LABEL: Record<CompTier, string> = {
  BASIC: 'Basic', PRO: 'Pro', PREMIER: 'Premier', ENTERPRISE: 'Enterprise',
  SOLO_CAPTURE: 'Solo Capture', SOLO_POWER: 'Solo Power',
}

interface CompCode {
  id:               string
  code:             string
  tier:             CompTier
  recipientName:    string
  recipientEmail:   string
  purpose:          string
  generatedBy:      string
  generatedAt:      string
  active:           boolean
  timesRedeemed:    number
  maxRedemptions:   number
  redeemed:         boolean
  checkoutUrl:      string | null
}

interface BuyLinkPlan {
  code:             string
  name:             string
  stripeBuyLinkUrl: string
  priceCents:       number
  interval:         'MONTHLY' | 'ONE_TIME'
}

type ConfigStatus = Record<CompTier, boolean>

const TIER_STYLES: Record<CompTier, { bg: string; fg: string }> = {
  BASIC:        { bg: 'oklch(95% 0.02 230)', fg: 'oklch(35% 0.10 230)' },
  PRO:          { bg: 'oklch(95% 0.06 270)', fg: 'oklch(35% 0.16 270)' },
  PREMIER:      { bg: 'oklch(95% 0.06 320)', fg: 'oklch(35% 0.18 320)' },
  ENTERPRISE:   { bg: 'oklch(95% 0.06 25)',  fg: 'oklch(35% 0.18 25)'  },
  SOLO_CAPTURE: { bg: 'oklch(95% 0.06 193)', fg: 'oklch(35% 0.14 193)' },
  SOLO_POWER:   { bg: 'oklch(95% 0.08 193)', fg: 'oklch(30% 0.16 193)' },
}

function TierPill({ tier }: { tier: CompTier }) {
  const s = TIER_STYLES[tier]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}

function StatusPill({ code }: { code: CompCode }) {
  const t = useT()
  let label: string, bg: string, fg: string
  if (code.redeemed) {
    label = t('adminCompCodes.status.redeemed')
    bg = 'oklch(95% 0.05 145)'; fg = 'oklch(35% 0.16 145)'
  } else if (!code.active) {
    label = t('adminCompCodes.status.disabled')
    bg = 'oklch(95% 0.02 270)'; fg = 'oklch(45% 0.05 270)'
  } else {
    label = t('adminCompCodes.status.active')
    bg = 'oklch(95% 0.05 75)'; fg = 'oklch(35% 0.16 75)'
  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  )
}

interface GeneratorState {
  recipientName:  string
  recipientEmail: string
  purpose:        string
  busy:           boolean
  error:          string | null
  lastCode:       string | null
  lastUrl:        string | null
  copiedField:    'code' | 'url' | 'bundle' | null
}

const INITIAL_GEN: GeneratorState = {
  recipientName: '', recipientEmail: '', purpose: '',
  busy: false, error: null, lastCode: null, lastUrl: null, copiedField: null,
}

function GeneratorCard({
  tier, configured, onGenerated,
}: {
  tier:        CompTier
  configured:  boolean
  onGenerated: () => void
}) {
  const t = useT()
  const [state, setState] = useState<GeneratorState>(INITIAL_GEN)

  function patch(partial: Partial<GeneratorState>) {
    setState(prev => ({ ...prev, ...partial }))
  }

  async function generate() {
    if (state.busy) return
    if (!state.recipientName.trim() || !state.recipientEmail.trim()) return
    patch({ busy: true, error: null })
    try {
      const created = await apiFetch<CompCode>('/api/admin/comp-codes', {
        method: 'POST',
        body: JSON.stringify({
          tier,
          recipientName:  state.recipientName.trim(),
          recipientEmail: state.recipientEmail.trim(),
          purpose:        state.purpose.trim(),
        }),
      })
      patch({
        busy: false,
        error: null,
        lastCode: created.code,
        lastUrl: created.checkoutUrl,
        copiedField: null,
        recipientName: '', recipientEmail: '', purpose: '',
      })
      onGenerated()
    } catch (e) {
      patch({ busy: false, error: (e as Error).message })
    }
  }

  async function copyText(text: string, field: 'code' | 'url' | 'bundle') {
    await navigator.clipboard.writeText(text)
    patch({ copiedField: field })
    setTimeout(() => patch({ copiedField: null }), 1500)
  }

  const disabled = !configured || state.busy
  const canSubmit = configured && !state.busy && !!state.recipientName.trim() && !!state.recipientEmail.trim()

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        opacity: configured ? 1 : 0.55,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <TierPill tier={tier} />
        {!configured && (
          <span className="text-xs italic" style={{ color: 'oklch(55% 0.18 25)' }}>
            {t('adminCompCodes.generators.disabledForTier')}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={state.recipientName}
          onChange={e => patch({ recipientName: e.target.value })}
          placeholder={t('adminCompCodes.generators.recipientNamePlaceholder')}
          aria-label={t('adminCompCodes.generators.recipientNameLabel')}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <input
          type="email"
          value={state.recipientEmail}
          onChange={e => patch({ recipientEmail: e.target.value })}
          placeholder={t('adminCompCodes.generators.recipientEmailPlaceholder')}
          aria-label={t('adminCompCodes.generators.recipientEmailLabel')}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <input
          type="text"
          value={state.purpose}
          onChange={e => patch({ purpose: e.target.value })}
          placeholder={t('adminCompCodes.generators.purposePlaceholder')}
          aria-label={t('adminCompCodes.generators.purposeLabel')}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={generate}
          disabled={!canSubmit}
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: 'oklch(55% 0.11 193)',
            color: 'white',
            opacity: canSubmit ? 1 : 0.45,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {state.busy ? t('adminCompCodes.generators.generating') : t('adminCompCodes.generators.generate')}
        </button>
      </div>

      {state.error && (
        <p className="mt-2 text-xs" style={{ color: 'oklch(55% 0.18 25)' }}>{state.error}</p>
      )}

      {state.lastCode && (
        <div className="mt-3 rounded-lg p-3 space-y-2.5" style={{ background: 'oklch(95% 0.05 145)', border: '1px solid oklch(80% 0.08 145)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold" style={{ color: 'oklch(35% 0.16 145)' }}>
              {t('adminCompCodes.generators.successPrefix')}
            </p>
            <button
              onClick={() => patch({ lastCode: null, lastUrl: null })}
              className="text-xs"
              style={{ color: 'oklch(45% 0.10 145)', background: 'transparent', border: 'none' }}
            >
              {t('adminCompCodes.generators.successDismiss')}
            </button>
          </div>

          {/* Comp code row */}
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'oklch(45% 0.10 145)' }}>
              {t('adminCompCodes.generators.successCodeLabel')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm font-semibold break-all" style={{ color: 'oklch(25% 0.16 145)' }}>
                {state.lastCode}
              </code>
              <button
                onClick={() => copyText(state.lastCode!, 'code')}
                className="px-2 py-1 rounded text-xs"
                style={{ background: state.copiedField === 'code' ? 'oklch(80% 0.10 145)' : 'white', color: 'oklch(35% 0.16 145)', border: '1px solid oklch(80% 0.08 145)' }}
              >
                {state.copiedField === 'code' ? t('adminCompCodes.generators.successCopied') : t('adminCompCodes.generators.successCopy')}
              </button>
            </div>
          </div>

          {/* Magic checkout URL row */}
          {state.lastUrl ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'oklch(45% 0.10 145)' }}>
                {t('adminCompCodes.generators.successUrlLabel')}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[11px] break-all" style={{ color: 'oklch(25% 0.16 145)' }}>
                  {state.lastUrl}
                </code>
                <button
                  onClick={() => copyText(state.lastUrl!, 'url')}
                  className="px-2 py-1 rounded text-xs whitespace-nowrap"
                  style={{ background: state.copiedField === 'url' ? 'oklch(80% 0.10 145)' : 'white', color: 'oklch(35% 0.16 145)', border: '1px solid oklch(80% 0.08 145)' }}
                >
                  {state.copiedField === 'url' ? t('adminCompCodes.generators.successCopied') : t('adminCompCodes.generators.successCopy')}
                </button>
              </div>
              <button
                onClick={() => copyText(
                  t('adminCompCodes.generators.successBundleTemplate', { code: state.lastCode!, url: state.lastUrl! }),
                  'bundle',
                )}
                className="mt-2 w-full px-2 py-1.5 rounded text-xs font-medium"
                style={{ background: state.copiedField === 'bundle' ? 'oklch(80% 0.10 145)' : 'oklch(55% 0.11 193)', color: 'white', border: 'none' }}
              >
                {state.copiedField === 'bundle' ? t('adminCompCodes.generators.successCopied') : t('adminCompCodes.generators.successCopyBundle')}
              </button>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: 'oklch(50% 0.05 75)' }}>
              {t('adminCompCodes.generators.successNoUrl')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Standalone "Direct Buy Link" generator. Picks any of the 5 tiers
 * (Basic / Pro / Premier / Enterprise / LTD) and an email; produces a
 * shareable Stripe checkout URL with the email pre-filled. No comp code
 * is involved — this is for sharing a paid-purchase link, including LTD
 * which is not on the comp-code grid.
 */
function DirectBuyLinkGenerator({ plans }: { plans: BuyLinkPlan[] }) {
  const t = useT()
  const [planCode, setPlanCode] = useState<string>(plans[0]?.code ?? '')
  const [email, setEmail] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedPlan = plans.find(p => p.code === planCode) ?? null
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  function generate() {
    if (!selectedPlan || !validEmail) return
    const params = new URLSearchParams({ prefilled_email: email.trim() })
    setGeneratedUrl(`${selectedPlan.stripeBuyLinkUrl}?${params.toString()}`)
    setCopied(false)
  }

  async function copy() {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (plans.length === 0) {
    return (
      <div
        className="rounded-xl p-5 text-sm"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        {t('adminCompCodes.directLink.noPlans')}
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('adminCompCodes.directLink.title')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t('adminCompCodes.directLink.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select
          value={planCode}
          onChange={e => { setPlanCode(e.target.value); setGeneratedUrl(null) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          aria-label={t('adminCompCodes.directLink.tierLabel')}
        >
          {plans.map(p => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setGeneratedUrl(null) }}
          placeholder={t('adminCompCodes.directLink.emailPlaceholder')}
          aria-label={t('adminCompCodes.directLink.emailLabel')}
          className="px-3 py-2 rounded-lg text-sm sm:col-span-1"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={generate}
          disabled={!validEmail || !selectedPlan}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: 'oklch(55% 0.11 193)',
            color: 'white',
            opacity: validEmail && selectedPlan ? 1 : 0.45,
            cursor: validEmail && selectedPlan ? 'pointer' : 'not-allowed',
          }}
        >
          {t('adminCompCodes.directLink.generate')}
        </button>
      </div>

      {generatedUrl && (
        <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[11px] break-all" style={{ color: 'var(--text-primary)' }}>
              {generatedUrl}
            </code>
            <button
              onClick={copy}
              className="px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                background: copied ? 'oklch(85% 0.10 145)' : 'oklch(55% 0.11 193)',
                color: copied ? 'oklch(30% 0.16 145)' : 'white',
                border: 'none',
              }}
            >
              {copied ? t('adminCompCodes.generators.successCopied') : t('adminCompCodes.directLink.copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminCompCodesPage() {
  const t = useT()
  const { locale } = useLocale()
  const [config, setConfig]     = useState<ConfigStatus | null>(null)
  const [codes, setCodes]       = useState<CompCode[] | null>(null)
  const [buyLinks, setBuyLinks] = useState<BuyLinkPlan[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [filter, setFilter]     = useState<CompTier | 'ALL'>('ALL')
  const [disabling, setDisabling] = useState<string | null>(null)
  const [toast, setToast]       = useState<string | null>(null)

  async function loadAll() {
    try {
      const [c, list, links] = await Promise.all([
        apiFetch<ConfigStatus>('/api/admin/comp-codes/config-status'),
        apiFetch<CompCode[]>('/api/admin/comp-codes'),
        apiFetch<BuyLinkPlan[]>('/api/admin/comp-codes/buy-links'),
      ])
      setConfig(c)
      setCodes(list)
      setBuyLinks(links)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => { loadAll() }, [])

  const missingTiers = useMemo(() => {
    if (!config) return [] as CompTier[]
    return activeTiers().filter(tier => !config[tier])
  }, [config])

  const visibleCodes = useMemo(() => {
    if (!codes) return []
    if (filter === 'ALL') return codes
    return codes.filter(c => c.tier === filter)
  }, [codes, filter])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function disable(code: CompCode) {
    if (disabling) return
    if (!confirm(t('adminCompCodes.actions.disableConfirm', { code: code.code }))) return
    setDisabling(code.id)
    try {
      await apiFetch(`/api/admin/comp-codes/${code.id}`, { method: 'DELETE' })
      showToast(t('adminCompCodes.actions.disableSuccess', { code: code.code }))
      await loadAll()
    } catch (e) {
      showToast(t('adminCompCodes.actions.disableFailed', { reason: (e as Error).message }))
    } finally {
      setDisabling(null)
    }
  }

  if (error && !config) {
    return <div className="p-8 text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</div>
  }
  if (!config || !codes) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.loading')}</div>
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-419' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('adminCompCodes.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('adminCompCodes.subtitle')}
        </p>
      </div>

      {missingTiers.length > 0 && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'oklch(96% 0.06 75)',
            border: '1px solid oklch(80% 0.10 75)',
            color: 'oklch(35% 0.16 75)',
          }}
        >
          <p className="font-semibold mb-1">⚠ {t('adminCompCodes.setupBanner.title')}</p>
          <p className="mb-1">
            {t('adminCompCodes.setupBanner.missingTiers', { tiers: missingTiers.join(', ') })}
          </p>
          <p className="mb-2">{t('adminCompCodes.setupBanner.instructionsLine')}</p>
          <details className="mt-1">
            <summary className="cursor-pointer underline" style={{ color: 'oklch(35% 0.16 230)' }}>
              {t('adminCompCodes.setupBanner.showSteps')}
            </summary>
            <div className="mt-3 space-y-3">
              {([1, 2, 3, 4] as const).map(n => (
                <div key={n}>
                  <p className="font-semibold">{t(`adminCompCodes.setupBanner.step${n}Title`)}</p>
                  <p className="mt-0.5">{t(`adminCompCodes.setupBanner.step${n}Body`)}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {toast && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {t('adminCompCodes.generators.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTiers().map(tier => (
            <GeneratorCard
              key={tier}
              tier={tier}
              configured={config[tier]}
              onGenerated={loadAll}
            />
          ))}
        </div>
      </div>

      {/* Standalone direct-buy-link generator — covers all 5 tiers including
          LTD, no comp code involved. Lives below the comp-code cards. */}
      <DirectBuyLinkGenerator plans={buyLinks} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            {t('adminCompCodes.table.filterTier')}
          </h2>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as CompTier | 'ALL')}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">{t('adminCompCodes.table.filterAll')}</option>
            {activeTiers().map(tier => <option key={tier} value={tier}>{TIER_LABEL[tier]}</option>)}
          </select>
        </div>

        {visibleCodes.length === 0 ? (
          <div
            className="rounded-xl p-5 text-sm text-center"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
          >
            {filter === 'ALL'
              ? t('adminCompCodes.table.empty')
              : t('adminCompCodes.table.emptyFiltered')}
          </div>
        ) : (
          <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.code')}</th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.tier')}</th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.recipient')}</th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.purpose')}</th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.status')}</th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.generatedAt')}</th>
                  <th className="text-right px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('adminCompCodes.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleCodes.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
                  >
                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{c.code}</td>
                    <td className="px-3 py-2"><TierPill tier={c.tier} /></td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      <div>{c.recipientName}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.recipientEmail}</div>
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.purpose || '—'}</td>
                    <td className="px-3 py-2"><StatusPill code={c} /></td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {dateFmt.format(new Date(c.generatedAt))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.active && !c.redeemed && (
                        <button
                          onClick={() => disable(c)}
                          disabled={disabling === c.id}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: 'transparent',
                            border: '1px solid oklch(70% 0.12 25)',
                            color: 'oklch(50% 0.18 25)',
                            opacity: disabling === c.id ? 0.5 : 1,
                          }}
                        >
                          {disabling === c.id ? t('adminCompCodes.actions.disabling') : t('adminCompCodes.actions.disable')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
