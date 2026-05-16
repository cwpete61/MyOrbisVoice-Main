'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { Tooltip } from '@/components/Tooltip'
import { BackToOnboarding } from '@/components/BackToOnboarding'

/* ───────────────────────────── types ──────────────────────────────────── */

type A2PStatus =
  | 'DRAFT' | 'VALIDATING' | 'VALIDATION_FAILED' | 'READY_TO_SUBMIT'
  | 'SUBMITTED' | 'PROFILE_PENDING' | 'BRAND_PENDING' | 'BRAND_FAILED'
  | 'BRAND_APPROVED' | 'CAMPAIGN_PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

interface GateFinding { ok: boolean | null; label: string; detail: string }
interface GateLayer { layer: number; name: string; passed: boolean | null; findings: GateFinding[] }
interface ValidationReport { passed: boolean; generatedAt: string; layers: GateLayer[] }

interface A2PApplication {
  id?:                   string
  legalName:             string
  ein:                   string
  businessType:          'SOLE_PROP' | 'LLC' | 'CORP' | 'NON_PROFIT' | 'PARTNERSHIP'
  vertical:              string
  websiteUrl:            string
  addressLine1:          string
  addressLine2:          string
  city:                  string
  region:                string
  postalCode:            string
  country:               string
  contactFirstName:      string
  contactLastName:       string
  contactEmail:          string
  contactPhone:          string
  useCase:               'marketing' | 'mixed' | 'customer_care' | '2fa' | 'utility'
  sampleMessagesJson:    string[]
  status?:               A2PStatus
  submissionMode?:       string
  rejectionReason?:      string | null
  validationReportJson?: ValidationReport | null
  validatedAt?:          string | null
  authorizedAt?:         string | null
  submittedAt?:          string | null
  approvedAt?:           string | null
  lastTwilioSyncAt?:     string | null
}

export interface A2PPrefill {
  legalName?: string; websiteUrl?: string; addressLine1?: string; city?: string
  region?: string; postalCode?: string; country?: string
  contactEmail?: string; contactPhone?: string
  contactFirstName?: string; contactLastName?: string
}

interface Props {
  apiBase: string                  // '/api/a2p' or '/api/partner/a2p'
  titleKey: string
  subtitleKey: string
  prefill?: A2PPrefill
  showBackToOnboarding?: boolean
}

/* ───────────────────────── constants ──────────────────────────────────── */

const EMPTY: A2PApplication = {
  legalName: '', ein: '', businessType: 'LLC', vertical: '', websiteUrl: '',
  addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'US',
  contactFirstName: '', contactLastName: '', contactEmail: '', contactPhone: '',
  useCase: 'customer_care', sampleMessagesJson: ['', '', '', '', ''],
}

const EDITABLE: A2PStatus[] = ['DRAFT', 'VALIDATION_FAILED', 'READY_TO_SUBMIT', 'REJECTED', 'BRAND_FAILED']
const PIPELINE: A2PStatus[] = ['SUBMITTED', 'PROFILE_PENDING', 'BRAND_PENDING', 'BRAND_APPROVED', 'CAMPAIGN_PENDING']

const STATUS_COLORS: Record<A2PStatus, { bg: string; fg: string }> = {
  DRAFT:             { bg: 'oklch(95% 0.02 270)', fg: 'oklch(35% 0.05 270)' },
  VALIDATING:        { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  VALIDATION_FAILED: { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
  READY_TO_SUBMIT:   { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)' },
  SUBMITTED:         { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  PROFILE_PENDING:   { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  BRAND_PENDING:     { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  BRAND_FAILED:      { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
  BRAND_APPROVED:    { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)' },
  CAMPAIGN_PENDING:  { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  APPROVED:          { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)' },
  REJECTED:          { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
  SUSPENDED:         { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
}

const STATUS_LABEL_KEY: Record<A2PStatus, string> = {
  DRAFT:             'tenantA2p.statusPill.draft',
  VALIDATING:        'tenantA2p.statusPill.validating',
  VALIDATION_FAILED: 'tenantA2p.statusPill.validationFailed',
  READY_TO_SUBMIT:   'tenantA2p.statusPill.readyToSubmit',
  SUBMITTED:         'tenantA2p.statusPill.submitted',
  PROFILE_PENDING:   'tenantA2p.statusPill.profilePending',
  BRAND_PENDING:     'tenantA2p.statusPill.brandPending',
  BRAND_FAILED:      'tenantA2p.statusPill.brandFailed',
  BRAND_APPROVED:    'tenantA2p.statusPill.brandApproved',
  CAMPAIGN_PENDING:  'tenantA2p.statusPill.campaignPending',
  APPROVED:          'tenantA2p.statusPill.approved',
  REJECTED:          'tenantA2p.statusPill.rejected',
  SUSPENDED:         'tenantA2p.statusPill.suspended',
}

/* ───────────────────────── component ──────────────────────────────────── */

export function A2PApplicationForm({ apiBase, titleKey, subtitleKey, prefill, showBackToOnboarding }: Props) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data: existing, loading, reload } = useApi<A2PApplication | null>(apiBase)

  const [form, setForm] = useState<A2PApplication>(EMPTY)
  const [seeded, setSeeded] = useState(false)
  const [busy, setBusy] = useState<null | 'save' | 'validate' | 'authorize' | 'submit' | 'sync'>(null)
  const [authConfirmed, setAuthConfirmed] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        ...EMPTY, ...existing,
        sampleMessagesJson: existing.sampleMessagesJson?.length ? existing.sampleMessagesJson : ['', '', '', '', ''],
      })
    }
  }, [existing])

  // First-time prefill from the supplied seed (tenant settings / partner profile).
  useEffect(() => {
    if (loading || existing || seeded || !prefill) return
    setForm(prev => ({
      ...prev,
      legalName:        prev.legalName        || prefill.legalName        || '',
      websiteUrl:       prev.websiteUrl       || prefill.websiteUrl       || '',
      addressLine1:     prev.addressLine1     || prefill.addressLine1     || '',
      city:             prev.city            || prefill.city             || '',
      region:           prev.region          || prefill.region           || '',
      postalCode:       prev.postalCode       || prefill.postalCode       || '',
      country:          prev.country          || prefill.country          || 'US',
      contactEmail:     prev.contactEmail     || prefill.contactEmail     || '',
      contactPhone:     prev.contactPhone     || prefill.contactPhone     || '',
      contactFirstName: prev.contactFirstName || prefill.contactFirstName || '',
      contactLastName:  prev.contactLastName  || prefill.contactLastName  || '',
    }))
    setSeeded(true)
  }, [loading, existing, seeded, prefill])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const status: A2PStatus = (existing?.status as A2PStatus) ?? 'DRAFT'
  const isLocked = !!existing && !EDITABLE.includes(status)
  const report = existing?.validationReportJson ?? null
  const inPipeline = PIPELINE.includes(status)

  function set<K extends keyof A2PApplication>(k: K, v: A2PApplication[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }
  function setSample(i: number, v: string) {
    setForm(p => ({ ...p, sampleMessagesJson: p.sampleMessagesJson.map((m, j) => j === i ? v : m) }))
  }

  async function save(): Promise<boolean> {
    setBusy('save')
    try {
      const payload: Record<string, unknown> = { ...form, sampleMessages: form.sampleMessagesJson.filter(m => m.trim().length > 0) }
      for (const k of ['sampleMessagesJson', 'id', 'status', 'submissionMode', 'rejectionReason',
        'validationReportJson', 'validatedAt', 'authorizedAt', 'submittedAt', 'approvedAt', 'lastTwilioSyncAt']) {
        delete payload[k]
      }
      await apiFetch(apiBase, { method: 'PUT', body: JSON.stringify(payload) })
      setToast({ type: 'success', text: t('tenantA2p.toast.savedDraft') })
      reload()
      return true
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.saveFailed') })
      return false
    } finally { setBusy(null) }
  }

  async function runValidation() {
    setBusy('validate')
    try {
      await apiFetch(apiBase, {
        method: 'PUT',
        body: JSON.stringify({ ...form, sampleMessages: form.sampleMessagesJson.filter(m => m.trim().length > 0) }),
      }).catch(() => null)
      const res = await apiFetch<A2PApplication>(`${apiBase}/validate`, { method: 'POST' })
      const passed = res?.validationReportJson?.passed
      setToast(passed
        ? { type: 'success', text: t('tenantA2p.toast.validatedPass') }
        : { type: 'error', text: t('tenantA2p.toast.validatedFail') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.validateFailed') })
    } finally { setBusy(null) }
  }

  async function authorize() {
    setBusy('authorize')
    try {
      await apiFetch(`${apiBase}/authorize`, { method: 'POST' })
      setToast({ type: 'success', text: t('tenantA2p.toast.authorized') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.authorizeFailed') })
    } finally { setBusy(null) }
  }

  async function submit() {
    if (!confirm(t('tenantA2p.confirm.submit'))) return
    setBusy('submit')
    try {
      await apiFetch(`${apiBase}/submit`, { method: 'POST' })
      setToast({ type: 'success', text: t('tenantA2p.toast.submitted') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.submitFailed') })
    } finally { setBusy(null) }
  }

  async function sync() {
    setBusy('sync')
    try {
      await apiFetch(`${apiBase}/sync`, { method: 'POST' })
      setToast({ type: 'success', text: t('tenantA2p.toast.synced') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.syncFailed') })
    } finally { setBusy(null) }
  }

  if (loading) return <div className="text-sm text-gray-500">{t('tenantA2p.loading')}</div>

  const labelCls = 'label'
  const inputCls = 'input'
  const anyBusy = busy !== null

  return (
    <div className="space-y-6 max-w-4xl">
      {showBackToOnboarding && <BackToOnboarding markStepKey="a2p" />}
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t(titleKey)}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t(subtitleKey)}</p>
      </div>

      {existing?.status && (
        <div className="rounded-xl px-5 py-4" style={{ background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].fg }}>
          <p className="text-sm font-semibold">{t(STATUS_LABEL_KEY[status])}</p>
          {(status === 'REJECTED' || status === 'BRAND_FAILED') && existing.rejectionReason && (
            <p className="text-xs mt-1">{existing.rejectionReason}</p>
          )}
          {existing.submittedAt && <p className="text-xs mt-1">{t('tenantA2p.statusMeta.submittedAt', { date: new Date(existing.submittedAt).toLocaleString(dateLocale) })}</p>}
          {existing.approvedAt && <p className="text-xs mt-1">{t('tenantA2p.statusMeta.approvedAt', { date: new Date(existing.approvedAt).toLocaleString(dateLocale) })}</p>}
        </div>
      )}

      {toast && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: toast.type === 'success' ? 'oklch(95% 0.05 160)' : 'oklch(95% 0.05 25)',
            color:      toast.type === 'success' ? 'oklch(35% 0.16 160)' : 'oklch(35% 0.16 25)',
            border:     toast.type === 'success' ? '1px solid oklch(80% 0.10 160)' : '1px solid oklch(80% 0.10 25)',
          }}>
          {toast.text}
        </div>
      )}

      <fieldset disabled={isLocked} className="space-y-6" style={{ opacity: isLocked ? 0.6 : 1 }}>

        {/* Business identity */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.identity.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                <Tooltip content={t('tenantA2p.tooltips.legalName')}>{t('tenantA2p.identity.legalName')}</Tooltip>
              </label>
              <input className={inputCls} value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder={t('tenantA2p.identity.legalNamePlaceholder')} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.identity.legalNameHelp')}</p>
            </div>
            <div>
              <label className={labelCls}>
                <Tooltip content={t('tenantA2p.tooltips.ein')}>
                  {t('tenantA2p.identity.einLabel')} <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.identity.einOptional')}</span>
                </Tooltip>
              </label>
              <input className={inputCls} value={form.ein} onChange={e => set('ein', e.target.value)} placeholder="12-3456789" />
            </div>
            <div>
              <label className={labelCls}>
                <Tooltip content={t('tenantA2p.tooltips.businessType')}>{t('tenantA2p.identity.businessType')}</Tooltip>
              </label>
              <select className={inputCls} value={form.businessType} onChange={e => set('businessType', e.target.value as A2PApplication['businessType'])}>
                <option value="SOLE_PROP">{t('tenantA2p.identity.businessTypeOptions.soleProp')}</option>
                <option value="LLC">{t('tenantA2p.identity.businessTypeOptions.llc')}</option>
                <option value="CORP">{t('tenantA2p.identity.businessTypeOptions.corp')}</option>
                <option value="NON_PROFIT">{t('tenantA2p.identity.businessTypeOptions.nonProfit')}</option>
                <option value="PARTNERSHIP">{t('tenantA2p.identity.businessTypeOptions.partnership')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <Tooltip content={t('tenantA2p.tooltips.vertical')}>{t('tenantA2p.identity.vertical')}</Tooltip>
              </label>
              <select className={inputCls} value={form.vertical} onChange={e => set('vertical', e.target.value)}>
                <option value="">{t('tenantA2p.identity.verticalOptions.choose')}</option>
                <option value="healthcare">{t('tenantA2p.identity.verticalOptions.healthcare')}</option>
                <option value="retail">{t('tenantA2p.identity.verticalOptions.retail')}</option>
                <option value="professional_services">{t('tenantA2p.identity.verticalOptions.professionalServices')}</option>
                <option value="real_estate">{t('tenantA2p.identity.verticalOptions.realEstate')}</option>
                <option value="financial">{t('tenantA2p.identity.verticalOptions.financial')}</option>
                <option value="education">{t('tenantA2p.identity.verticalOptions.education')}</option>
                <option value="hospitality">{t('tenantA2p.identity.verticalOptions.hospitality')}</option>
                <option value="auto">{t('tenantA2p.identity.verticalOptions.auto')}</option>
                <option value="technology">{t('tenantA2p.identity.verticalOptions.technology')}</option>
                <option value="other">{t('tenantA2p.identity.verticalOptions.other')}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>{t('tenantA2p.identity.websiteUrl')} <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.identity.websiteUrlOptional')}</span></label>
              <input className={inputCls} type="url" value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} placeholder="https://yourbusiness.com" />
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.address.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>{t('tenantA2p.address.line1')}</label>
              <input className={inputCls} value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} placeholder={t('tenantA2p.address.line1Placeholder')} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>{t('tenantA2p.address.line2')}</label>
              <input className={inputCls} value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} placeholder={t('tenantA2p.address.line2Placeholder')} />
            </div>
            <div><label className={labelCls}>{t('tenantA2p.address.city')}</label><input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className={labelCls}>{t('tenantA2p.address.region')}</label><input className={inputCls} value={form.region} onChange={e => set('region', e.target.value)} placeholder={t('tenantA2p.address.regionPlaceholder')} /></div>
            <div><label className={labelCls}>{t('tenantA2p.address.postalCode')}</label><input className={inputCls} value={form.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
            <div><label className={labelCls}>{t('tenantA2p.address.country')}</label><input className={inputCls} value={form.country} onChange={e => set('country', e.target.value)} placeholder="US" /></div>
          </div>
        </section>

        {/* Authorized contact */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.contact.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.contact.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>{t('tenantA2p.contact.firstName')}</label><input className={inputCls} value={form.contactFirstName} onChange={e => set('contactFirstName', e.target.value)} /></div>
            <div><label className={labelCls}>{t('tenantA2p.contact.lastName')}</label><input className={inputCls} value={form.contactLastName} onChange={e => set('contactLastName', e.target.value)} /></div>
            <div><label className={labelCls}>{t('tenantA2p.contact.email')}</label><input className={inputCls} type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
            <div><label className={labelCls}>{t('tenantA2p.contact.phone')}</label><input className={inputCls} type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+15551234567" /></div>
          </div>
        </section>

        {/* Use case + sample messages */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.useCase.title')}</h2>
          <div>
            <label className={labelCls}>
              <Tooltip content={t('tenantA2p.tooltips.useCase')}>{t('tenantA2p.useCase.useCaseLabel')}</Tooltip>
            </label>
            <select className={inputCls} value={form.useCase} onChange={e => set('useCase', e.target.value as A2PApplication['useCase'])}>
              <option value="customer_care">{t('tenantA2p.useCase.options.customerCare')}</option>
              <option value="mixed">{t('tenantA2p.useCase.options.mixed')}</option>
              <option value="utility">{t('tenantA2p.useCase.options.utility')}</option>
              <option value="2fa">{t('tenantA2p.useCase.options.twoFa')}</option>
              <option value="marketing">{t('tenantA2p.useCase.options.marketing')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              <Tooltip content={t('tenantA2p.tooltips.sampleMessages')}>
                {t('tenantA2p.useCase.sampleMessages')} <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.useCase.sampleMessagesCount')}</span>
              </Tooltip>
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.useCase.sampleMessagesHelp')}</p>
            <div className="space-y-2">
              {form.sampleMessagesJson.map((m, i) => (
                <textarea
                  key={i}
                  className={inputCls + ' font-mono text-xs'}
                  rows={2}
                  value={m}
                  onChange={e => setSample(i, e.target.value)}
                  placeholder={i === 0 ? t('tenantA2p.useCase.sampleFirstPlaceholder') : t('tenantA2p.useCase.sampleNthPlaceholder', { n: i + 1 })}
                />
              ))}
            </div>
          </div>
        </section>
      </fieldset>

      {/* Save draft */}
      {!isLocked && (
        <div className="flex items-center gap-3">
          <button onClick={() => void save()} disabled={anyBusy} className="btn-secondary text-sm">
            {busy === 'save' ? t('tenantA2p.actions.saving') : t('tenantA2p.actions.saveDraft')}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.actions.helper')}</p>
        </div>
      )}

      {/* ─── Validation gate ─────────────────────────────────────────────── */}
      {!isLocked && (
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.gate.title')}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.gate.subtitle')}</p>
          </div>

          {report && (
            <div className="space-y-3">
              <div className="text-xs px-3 py-2 rounded-lg" style={{
                background: report.passed ? 'oklch(95% 0.05 160)' : 'oklch(95% 0.05 25)',
                color:      report.passed ? 'oklch(35% 0.16 160)' : 'oklch(35% 0.18 25)',
              }}>
                {report.passed ? t('tenantA2p.gate.passedBanner') : t('tenantA2p.gate.failedBanner')}
                {existing?.validatedAt && (
                  <span className="opacity-70"> · {t('tenantA2p.gate.lastChecked', { date: new Date(existing.validatedAt).toLocaleString(dateLocale) })}</span>
                )}
              </div>
              {report.layers.map(layer => (
                <div key={layer.layer} className="rounded-lg p-3" style={{ border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {t('tenantA2p.gate.layer', { n: layer.layer })} — {layer.name}
                  </p>
                  <ul className="space-y-1">
                    {layer.findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{
                          color: f.ok === true ? 'oklch(55% 0.16 160)' : f.ok === false ? 'oklch(55% 0.18 25)' : 'oklch(65% 0.04 270)',
                          fontWeight: 700,
                        }}>
                          {f.ok === true ? '✓' : f.ok === false ? '✕' : '–'}
                        </span>
                        <span><strong>{f.label}:</strong> {f.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => void runValidation()} disabled={anyBusy} className="btn-secondary text-sm">
            {busy === 'validate'
              ? t('tenantA2p.gate.running')
              : report ? t('tenantA2p.gate.rerun') : t('tenantA2p.gate.run')}
          </button>
        </section>
      )}

      {/* ─── Authorize ───────────────────────────────────────────────────── */}
      {!isLocked && report?.passed && status !== 'READY_TO_SUBMIT' && (
        <section className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.authorize.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.authorize.subtitle')}</p>
          <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={authConfirmed} onChange={e => setAuthConfirmed(e.target.checked)} className="mt-0.5" />
            <span>{t('tenantA2p.authorize.checkbox')}</span>
          </label>
          <button onClick={() => void authorize()} disabled={anyBusy || !authConfirmed} className="btn-primary text-sm">
            {busy === 'authorize' ? t('tenantA2p.authorize.authorizing') : t('tenantA2p.authorize.button')}
          </button>
        </section>
      )}

      {/* ─── Submit ──────────────────────────────────────────────────────── */}
      {status === 'READY_TO_SUBMIT' && (
        <section className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.submitPanel.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.submitPanel.authorizedNote')}</p>
          {existing?.submissionMode !== 'live' && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'oklch(96% 0.05 75)', color: 'oklch(35% 0.16 75)' }}>
              {t('tenantA2p.submitPanel.mockNote')}
            </p>
          )}
          <button onClick={() => void submit()} disabled={anyBusy} className="btn-primary text-sm">
            {busy === 'submit' ? t('tenantA2p.submitPanel.submitting') : t('tenantA2p.submitPanel.button')}
          </button>
        </section>
      )}

      {/* ─── In-pipeline status / sync ───────────────────────────────────── */}
      {inPipeline && (
        <section className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.pipeline.title')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.pipeline.subtitle')}</p>
          {existing?.lastTwilioSyncAt && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantA2p.pipeline.lastSynced', { date: new Date(existing.lastTwilioSyncAt).toLocaleString(dateLocale) })}
            </p>
          )}
          <button onClick={() => void sync()} disabled={anyBusy} className="btn-secondary text-sm">
            {busy === 'sync' ? t('tenantA2p.pipeline.refreshing') : t('tenantA2p.pipeline.refresh')}
          </button>
        </section>
      )}
    </div>
  )
}
