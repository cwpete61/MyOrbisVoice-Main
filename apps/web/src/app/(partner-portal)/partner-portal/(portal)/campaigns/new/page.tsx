'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

export default function NewCampaignPage() {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')  // local datetime string
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    try {
      const result = await apiFetch<{ id: string }>('/api/partner/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          subject,
          bodyText,
          scheduledAt: scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      })
      router.push(`/partner-portal/campaigns/${result.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('partnerCampaignNew.saveFailed'))
    } finally { setSaving(false) }
  }

  const canSave = name.trim() && subject.trim() && bodyText.trim() && (!scheduled || scheduledAt)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/partner-portal/campaigns" className="text-sm hover:underline" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerCampaignNew.backLink')}
        </Link>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerCampaignNew.title')}</h1>
      </div>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <Field label={t('partnerCampaignNew.nameLabel')} hint={t('partnerCampaignNew.nameHint')}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" maxLength={120} />
        </Field>

        <Field label={t('partnerCampaignNew.subjectLabel')} hint={t('partnerCampaignNew.subjectHint')}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input w-full" maxLength={200} />
        </Field>

        <Field label={t('partnerCampaignNew.bodyLabel')} hint={t('partnerCampaignNew.bodyHint')}>
          <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} className="input w-full" rows={12} maxLength={50000} />
        </Field>

        <div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />
            {t('partnerCampaignNew.scheduleLabel')}
          </label>
          {scheduled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input mt-2"
              style={{ maxWidth: 280 }}
            />
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerCampaignNew.scheduleHint')}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={save} disabled={saving || !canSave} className="btn-primary">
            {saving ? t('partnerCampaignNew.saving') : t('partnerCampaignNew.createDraft')}
          </button>
          <Link href="/partner-portal/campaigns" className="btn-ghost">{t('partnerCampaignNew.cancel')}</Link>
          {err && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{err}</span>}
        </div>

        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerCampaignNew.nextStepNote')}
        </p>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  )
}
