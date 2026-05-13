'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

interface Campaign {
  id: string
  name: string
  subject: string
  bodyText: string
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  pausedReason: string | null
  totalRecipients: number
  sentCount: number
  bouncedCount: number
  complainedCount: number
  skippedCount: number
  createdAt: string
}

interface CrmContact {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  pipelineStage: { id: string; name: string; color: string | null } | null
}

const STATUS_COLORS: Record<Campaign['status'], string> = {
  DRAFT:     'oklch(95% 0 0)',
  SCHEDULED: 'oklch(95% 0.04 250)',
  RUNNING:   'oklch(92% 0.10 145)',
  PAUSED:    'oklch(95% 0.08 80)',
  COMPLETED: 'oklch(95% 0.05 145)',
  FAILED:    'oklch(95% 0.05 25)',
  CANCELED:  'oklch(93% 0 0)',
}

export default function CampaignDetailPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { id } = useParams<{ id: string }>()

  const { data: camp, reload } = useApi<Campaign>(`/api/partner/campaigns/${id}`, [])
  const { data: contactList } = useApi<{ items: CrmContact[]; total: number }>('/api/partner/crm/contacts?limit=200', [])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  if (!camp) return <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.loading')}</div>

  const isEditable    = camp.status === 'DRAFT' || camp.status === 'SCHEDULED'
  const canStart      = (camp.status === 'DRAFT' || camp.status === 'SCHEDULED' || camp.status === 'PAUSED') && camp.totalRecipients > 0
  const canPause      = camp.status === 'RUNNING'
  const canResume     = camp.status === 'PAUSED'
  const canCancel     = camp.status !== 'COMPLETED' && camp.status !== 'CANCELED' && camp.status !== 'FAILED'

  async function addRecipients() {
    if (picked.size === 0) return
    setAdding(true); setMsg(''); setErr('')
    try {
      const r = await apiFetch<{ added: number; skipped: number; suppressed: number }>(
        `/api/partner/campaigns/${id}/recipients`,
        { method: 'POST', body: JSON.stringify({ contactIds: Array.from(picked) }) },
      )
      setMsg(t('partnerCampaignDetail.addedMsg', { added: r.added, suppressed: r.suppressed, skipped: r.skipped }))
      setPicked(new Set())
      reload()
    } catch (e) { setErr(e instanceof Error ? e.message : t('partnerCampaignDetail.addFailed')) }
    finally { setAdding(false) }
  }

  async function action(path: string, label: string) {
    setMsg(''); setErr('')
    try {
      await apiFetch(`/api/partner/campaigns/${id}/${path}`, { method: 'POST', body: '{}' })
      setMsg(label)
      reload()
    } catch (e) { setErr(e instanceof Error ? e.message : t('partnerCampaignDetail.actionFailed')) }
  }

  const contacts = contactList?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/partner-portal/campaigns" className="text-sm hover:underline" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerCampaignDetail.backLink')}
        </Link>
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{camp.name}</h1>
        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: STATUS_COLORS[camp.status], color: '#333' }}>
          {camp.status}
        </span>
      </div>

      {msg && <div className="alert-success p-3 rounded-lg text-sm">{msg}</div>}
      {err && <div className="alert-error p-3 rounded-lg text-sm">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject + body */}
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerCampaignDetail.contentHeading')}</h2>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.subjectLabel')}</div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{camp.subject}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.bodyLabel')}</div>
            <div className="text-sm mt-1 whitespace-pre-wrap p-3 rounded-lg" style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>{camp.bodyText}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerCampaignDetail.statsHeading')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label={t('partnerCampaignDetail.totalRecipients')} value={camp.totalRecipients} />
            <Stat label={t('partnerCampaignDetail.sent')}            value={camp.sentCount} />
            <Stat label={t('partnerCampaignDetail.bounced')}         value={camp.bouncedCount} highlight={camp.bouncedCount > 0} />
            <Stat label={t('partnerCampaignDetail.complained')}      value={camp.complainedCount} highlight={camp.complainedCount > 0} />
            <Stat label={t('partnerCampaignDetail.skipped')}         value={camp.skippedCount} />
            <Stat label={t('partnerCampaignDetail.created')}         value={new Date(camp.createdAt).toLocaleDateString(dateLocale)} />
            {camp.scheduledAt && <Stat label={t('partnerCampaignDetail.scheduledFor')} value={new Date(camp.scheduledAt).toLocaleString(dateLocale)} />}
            {camp.startedAt   && <Stat label={t('partnerCampaignDetail.startedAt')}    value={new Date(camp.startedAt).toLocaleString(dateLocale)} />}
            {camp.completedAt && <Stat label={t('partnerCampaignDetail.completedAt')}  value={new Date(camp.completedAt).toLocaleString(dateLocale)} />}
            {camp.pausedReason && <Stat label={t('partnerCampaignDetail.pausedReason')} value={camp.pausedReason} />}
          </div>
        </div>
      </div>

      {/* Recipient picker — only while editable */}
      {isEditable && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('partnerCampaignDetail.addRecipientsHeading')}
            </h2>
            <button onClick={addRecipients} disabled={adding || picked.size === 0} className="btn-primary text-xs">
              {adding ? t('partnerCampaignDetail.adding') : t('partnerCampaignDetail.addPickedCount', { n: picked.size })}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerCampaignDetail.recipientHint')}
          </p>
          <div className="rounded-lg overflow-hidden max-h-96 overflow-y-auto" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: 'var(--surface-overlay)' }}>
                <tr>
                  <th className="px-3 py-2 text-left" style={{ color: 'var(--text-tertiary)' }}>
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && picked.size === contacts.filter(c => c.email).length}
                      onChange={(e) => setPicked(e.target.checked ? new Set(contacts.filter(c => c.email).map(c => c.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-2 text-left" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.contactName')}</th>
                  <th className="px-3 py-2 text-left" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.contactEmail')}</th>
                  <th className="px-3 py-2 text-left" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCampaignDetail.contactStage')}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.filter(c => c.email).map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={picked.has(c.id)}
                        onChange={(e) => {
                          const next = new Set(picked)
                          if (e.target.checked) next.add(c.id); else next.delete(c.id)
                          setPicked(next)
                        }}
                      />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      {c.fullName ?? [c.firstName, c.lastName].filter(Boolean).join(' ') ?? '—'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{c.pipelineStage?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {canStart && (
          <button onClick={() => action('start', t('partnerCampaignDetail.startedMsg'))} className="btn-primary">
            {t('partnerCampaignDetail.startNow')}
          </button>
        )}
        {canPause  && <button onClick={() => action('pause',  t('partnerCampaignDetail.pausedMsg'))} className="btn-ghost">{t('partnerCampaignDetail.pauseRun')}</button>}
        {canResume && <button onClick={() => action('resume', t('partnerCampaignDetail.resumedMsg'))} className="btn-primary">{t('partnerCampaignDetail.resumeRun')}</button>}
        {canCancel && <button onClick={() => action('cancel', t('partnerCampaignDetail.canceledMsg'))} className="text-xs" style={{ color: 'var(--error-600)' }}>{t('partnerCampaignDetail.cancelRun')}</button>}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="font-semibold mt-0.5" style={{ color: highlight ? 'var(--error-600)' : 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
