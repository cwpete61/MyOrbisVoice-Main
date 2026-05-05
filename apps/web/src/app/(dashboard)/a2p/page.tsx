'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

interface A2PApplication {
  id?:                string
  legalName:          string
  ein:                string
  businessType:       'SOLE_PROP' | 'LLC' | 'CORP' | 'NON_PROFIT' | 'PARTNERSHIP'
  vertical:           string
  websiteUrl:         string
  addressLine1:       string
  addressLine2:       string
  city:               string
  region:             string
  postalCode:         string
  country:            string
  contactFirstName:   string
  contactLastName:    string
  contactEmail:       string
  contactPhone:       string
  useCase:            'marketing' | 'mixed' | 'customer_care' | '2fa' | 'utility'
  sampleMessagesJson: string[]
  status?:            'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  rejectionReason?:   string | null
  submittedAt?:       string | null
  approvedAt?:        string | null
}

const EMPTY: A2PApplication = {
  legalName: '', ein: '', businessType: 'LLC', vertical: '', websiteUrl: '',
  addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'US',
  contactFirstName: '', contactLastName: '', contactEmail: '', contactPhone: '',
  useCase: 'customer_care', sampleMessagesJson: ['', '', '', '', ''],
}

const STATUS_PILL_COLORS: Record<NonNullable<A2PApplication['status']>, { bg: string; fg: string }> = {
  DRAFT:     { bg: 'oklch(95% 0.02 270)', fg: 'oklch(35% 0.05 270)' },
  SUBMITTED: { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  APPROVED:  { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)' },
  REJECTED:  { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
}

const STATUS_LABEL_KEY: Record<NonNullable<A2PApplication['status']>, string> = {
  DRAFT:     'tenantA2p.statusPill.draft',
  SUBMITTED: 'tenantA2p.statusPill.submitted',
  APPROVED:  'tenantA2p.statusPill.approved',
  REJECTED:  'tenantA2p.statusPill.rejected',
}

export default function A2PPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data: existing, loading, reload } = useApi<A2PApplication | null>('/api/a2p')
  const [form, setForm] = useState<A2PApplication>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (existing) setForm({ ...EMPTY, ...existing, sampleMessagesJson: existing.sampleMessagesJson?.length ? existing.sampleMessagesJson : ['', '', '', '', ''] })
  }, [existing])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const isLocked = existing?.status === 'SUBMITTED' || existing?.status === 'APPROVED'

  function set<K extends keyof A2PApplication>(k: K, v: A2PApplication[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }
  function setSample(i: number, v: string) {
    setForm(p => ({ ...p, sampleMessagesJson: p.sampleMessagesJson.map((m, j) => j === i ? v : m) }))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...form, sampleMessages: form.sampleMessagesJson.filter(m => m.trim().length > 0) }
      delete (payload as any).sampleMessagesJson
      delete (payload as any).id
      delete (payload as any).status
      delete (payload as any).rejectionReason
      delete (payload as any).submittedAt
      delete (payload as any).approvedAt
      await apiFetch('/api/a2p', { method: 'PUT', body: JSON.stringify(payload) })
      setToast({ type: 'success', text: t('tenantA2p.toast.savedDraft') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.saveFailed') })
    } finally { setSaving(false) }
  }

  async function submit() {
    if (!confirm(t('tenantA2p.confirm.submit'))) return
    setSubmitting(true)
    try {
      await save()
      await apiFetch('/api/a2p/submit', { method: 'POST' })
      setToast({ type: 'success', text: t('tenantA2p.toast.submitted') })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : t('tenantA2p.toast.submitFailed') })
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">{t('tenantA2p.loading')}</div>

  const labelCls = 'label'
  const inputCls = 'input'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantA2p.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantA2p.subtitle')}
        </p>
      </div>

      {existing?.status && (
        <div className="rounded-xl px-5 py-4" style={{ background: STATUS_PILL_COLORS[existing.status].bg, color: STATUS_PILL_COLORS[existing.status].fg }}>
          <p className="text-sm font-semibold">{t(STATUS_LABEL_KEY[existing.status])}</p>
          {existing.status === 'REJECTED' && existing.rejectionReason && (
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
              <label className={labelCls}>{t('tenantA2p.identity.legalName')}</label>
              <input className={inputCls} value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder={t('tenantA2p.identity.legalNamePlaceholder')} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.identity.legalNameHelp')}</p>
            </div>
            <div>
              <label className={labelCls}>{t('tenantA2p.identity.einLabel')} <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.identity.einOptional')}</span></label>
              <input className={inputCls} value={form.ein} onChange={e => set('ein', e.target.value)} placeholder="12-3456789" />
            </div>
            <div>
              <label className={labelCls}>{t('tenantA2p.identity.businessType')}</label>
              <select className={inputCls} value={form.businessType} onChange={e => set('businessType', e.target.value as A2PApplication['businessType'])}>
                <option value="SOLE_PROP">{t('tenantA2p.identity.businessTypeOptions.soleProp')}</option>
                <option value="LLC">{t('tenantA2p.identity.businessTypeOptions.llc')}</option>
                <option value="CORP">{t('tenantA2p.identity.businessTypeOptions.corp')}</option>
                <option value="NON_PROFIT">{t('tenantA2p.identity.businessTypeOptions.nonProfit')}</option>
                <option value="PARTNERSHIP">{t('tenantA2p.identity.businessTypeOptions.partnership')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('tenantA2p.identity.vertical')}</label>
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
            <label className={labelCls}>{t('tenantA2p.useCase.useCaseLabel')}</label>
            <select className={inputCls} value={form.useCase} onChange={e => set('useCase', e.target.value as A2PApplication['useCase'])}>
              <option value="customer_care">{t('tenantA2p.useCase.options.customerCare')}</option>
              <option value="mixed">{t('tenantA2p.useCase.options.mixed')}</option>
              <option value="utility">{t('tenantA2p.useCase.options.utility')}</option>
              <option value="2fa">{t('tenantA2p.useCase.options.twoFa')}</option>
              <option value="marketing">{t('tenantA2p.useCase.options.marketing')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('tenantA2p.useCase.sampleMessages')} <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantA2p.useCase.sampleMessagesCount')}</span></label>
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

      {!isLocked && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || submitting} className="btn-secondary text-sm">
            {saving ? t('tenantA2p.actions.saving') : t('tenantA2p.actions.saveDraft')}
          </button>
          <button onClick={submit} disabled={saving || submitting} className="btn-primary text-sm">
            {submitting ? t('tenantA2p.actions.submitting') : t('tenantA2p.actions.submit')}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantA2p.actions.helper')}
          </p>
        </div>
      )}
    </div>
  )
}
