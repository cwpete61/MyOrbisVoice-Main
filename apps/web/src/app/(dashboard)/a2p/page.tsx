'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

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

const STATUS_PILL: Record<NonNullable<A2PApplication['status']>, { bg: string; fg: string; label: string }> = {
  DRAFT:     { bg: 'oklch(95% 0.02 270)', fg: 'oklch(35% 0.05 270)', label: 'Draft — fill in and submit' },
  SUBMITTED: { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)',  label: 'Submitted — Twilio is reviewing (1-3 business days)' },
  APPROVED:  { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)', label: 'Approved — your numbers can send SMS at full throughput' },
  REJECTED:  { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)',  label: 'Rejected — fix the issues below and resubmit' },
}

export default function A2PPage() {
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
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
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
      setToast({ type: 'success', text: 'Saved as draft.' })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' })
    } finally { setSaving(false) }
  }

  async function submit() {
    if (!confirm('Submit to Twilio for review? You won\'t be able to edit while it\'s in review.')) return
    setSubmitting(true)
    try {
      await save()
      await apiFetch('/api/a2p/submit', { method: 'POST' })
      setToast({ type: 'success', text: 'Submitted for review.' })
      reload()
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Submit failed.' })
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>

  const labelCls = 'label'
  const inputCls = 'input'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>SMS Compliance (A2P 10DLC)</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          US carriers require every business sending SMS to register their brand and use case.
          Fill this in once. We submit to Twilio on your behalf — typically approved within 1-3 business days.
        </p>
      </div>

      {existing?.status && (
        <div className="rounded-xl px-5 py-4" style={{ background: STATUS_PILL[existing.status].bg, color: STATUS_PILL[existing.status].fg }}>
          <p className="text-sm font-semibold">{STATUS_PILL[existing.status].label}</p>
          {existing.status === 'REJECTED' && existing.rejectionReason && (
            <p className="text-xs mt-1">{existing.rejectionReason}</p>
          )}
          {existing.submittedAt && <p className="text-xs mt-1">Submitted: {new Date(existing.submittedAt).toLocaleString()}</p>}
          {existing.approvedAt && <p className="text-xs mt-1">Approved: {new Date(existing.approvedAt).toLocaleString()}</p>}
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
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Business identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Legal business name *</label>
              <input className={inputCls} value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder="Acme Holdings, LLC" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Must match exactly what's on your EIN registration.</p>
            </div>
            <div>
              <label className={labelCls}>EIN <span style={{ color: 'var(--text-tertiary)' }}>(optional for sole prop)</span></label>
              <input className={inputCls} value={form.ein} onChange={e => set('ein', e.target.value)} placeholder="12-3456789" />
            </div>
            <div>
              <label className={labelCls}>Business type *</label>
              <select className={inputCls} value={form.businessType} onChange={e => set('businessType', e.target.value as A2PApplication['businessType'])}>
                <option value="SOLE_PROP">Sole Proprietorship</option>
                <option value="LLC">LLC</option>
                <option value="CORP">Corporation</option>
                <option value="NON_PROFIT">Non-Profit</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Vertical *</label>
              <select className={inputCls} value={form.vertical} onChange={e => set('vertical', e.target.value)}>
                <option value="">— Choose one —</option>
                <option value="healthcare">Healthcare</option>
                <option value="retail">Retail</option>
                <option value="professional_services">Professional Services</option>
                <option value="real_estate">Real Estate</option>
                <option value="financial">Financial</option>
                <option value="education">Education</option>
                <option value="hospitality">Hospitality</option>
                <option value="auto">Automotive</option>
                <option value="technology">Technology</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Website URL <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
              <input className={inputCls} type="url" value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} placeholder="https://yourbusiness.com" />
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Business address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Address line 1 *</label>
              <input className={inputCls} value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Address line 2</label>
              <input className={inputCls} value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} placeholder="Suite 200 (optional)" />
            </div>
            <div><label className={labelCls}>City *</label><input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className={labelCls}>State / Region *</label><input className={inputCls} value={form.region} onChange={e => set('region', e.target.value)} placeholder="CA" /></div>
            <div><label className={labelCls}>Postal code *</label><input className={inputCls} value={form.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
            <div><label className={labelCls}>Country</label><input className={inputCls} value={form.country} onChange={e => set('country', e.target.value)} placeholder="US" /></div>
          </div>
        </section>

        {/* Authorized contact */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Authorized contact</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>The person Twilio reaches out to if they have questions about the registration.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>First name *</label><input className={inputCls} value={form.contactFirstName} onChange={e => set('contactFirstName', e.target.value)} /></div>
            <div><label className={labelCls}>Last name *</label><input className={inputCls} value={form.contactLastName} onChange={e => set('contactLastName', e.target.value)} /></div>
            <div><label className={labelCls}>Email *</label><input className={inputCls} type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
            <div><label className={labelCls}>Phone *</label><input className={inputCls} type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+15551234567" /></div>
          </div>
        </section>

        {/* Use case + sample messages */}
        <section className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>How you'll use SMS</h2>
          <div>
            <label className={labelCls}>Use case *</label>
            <select className={inputCls} value={form.useCase} onChange={e => set('useCase', e.target.value as A2PApplication['useCase'])}>
              <option value="customer_care">Customer Care — replies, support, follow-ups</option>
              <option value="mixed">Mixed — appointment reminders + occasional promos</option>
              <option value="utility">Utility — confirmations, alerts, status updates</option>
              <option value="2fa">2FA — login codes only</option>
              <option value="marketing">Marketing — promotional content</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Sample messages * <span style={{ color: 'var(--text-tertiary)' }}>(at least 1, up to 5)</span></label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Real examples of messages your AI will send. Include opt-out language ("Reply STOP to unsubscribe") in at least one. Carriers reject vague samples.</p>
            <div className="space-y-2">
              {form.sampleMessagesJson.map((m, i) => (
                <textarea
                  key={i}
                  className={inputCls + ' font-mono text-xs'}
                  rows={2}
                  value={m}
                  onChange={e => setSample(i, e.target.value)}
                  placeholder={i === 0 ? 'Hi {{name}}, this is Acme confirming your appointment Tuesday at 2pm. Reply C to confirm, R to reschedule. Reply STOP to opt out.' : 'Sample message ' + (i + 1)}
                />
              ))}
            </div>
          </div>
        </section>
      </fieldset>

      {!isLocked && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || submitting} className="btn-secondary text-sm">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={submit} disabled={saving || submitting} className="btn-primary text-sm">
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            We'll save the draft, then submit to Twilio. You can come back here to track status.
          </p>
        </div>
      )}
    </div>
  )
}
