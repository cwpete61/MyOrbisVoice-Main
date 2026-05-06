'use client'

/**
 * Admin A2P 10DLC dashboard.
 *
 * Shows every A2P application across the platform — the one platform-scope
 * row (MyOrbisVoice's own master-account registration) and every
 * tenant-scope row. Admin can:
 *
 *   - View any submitted application's full data, formatted for copy-paste
 *     into Twilio Trust Hub Console (manual-submission helper)
 *   - Edit + submit the platform-scope application
 *   - Mark any submitted application as APPROVED (with Twilio SIDs) or
 *     REJECTED (with reason) once the human-driven Trust Hub submission
 *     has its outcome
 *   - Add operator notes to any application — friction log that becomes
 *     the design input for the future self-service A2P wizard
 *
 * Until the full Trust Hub API automation lands (~5-7 days, deferred per
 * backlog #20), this is the operational surface that turns A2P from a
 * "tenant fills form, ops manually does Console work" to a structured
 * pipeline with full visibility.
 */

import { useEffect, useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

type AppStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
type NoteCategory = 'CLARIFICATION_NEEDED' | 'DATA_GAP' | 'FORMAT_ERROR' | 'USE_CASE_MISMATCH' | 'COMPLIANCE_CONCERN' | 'OTHER'

interface A2PApp {
  id:                    string
  tenantId:              string | null
  legalName:             string
  ein:                   string | null
  businessType:          string
  vertical:              string
  websiteUrl:            string | null
  addressLine1:          string
  addressLine2:          string | null
  city:                  string
  region:                string
  postalCode:            string
  country:               string
  contactFirstName:      string
  contactLastName:       string
  contactEmail:          string
  contactPhone:          string
  useCase:               string
  sampleMessagesJson:    string[]
  twilioCustomerProfileSid: string | null
  twilioBrandSid:        string | null
  twilioCampaignSid:     string | null
  status:                AppStatus
  rejectionReason:       string | null
  submittedAt:           string | null
  approvedAt:            string | null
  createdAt:             string
  updatedAt:             string
  tenant:                { id: string; displayName: string } | null
}

interface OperatorNote {
  id:            string
  applicationId: string
  byUserId:      string
  category:      NoteCategory
  note:          string
  createdAt:     string
  byUser:        { id: string; email: string; firstName: string | null; lastName: string | null }
}

interface AdminA2PResponse {
  platform: A2PApp | null
  tenants:  A2PApp[]
}

const STATUS_STYLES: Record<AppStatus, { bg: string; fg: string }> = {
  DRAFT:     { bg: 'oklch(95% 0.02 270)', fg: 'oklch(35% 0.05 270)' },
  SUBMITTED: { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  APPROVED:  { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)' },
  REJECTED:  { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
}

function StatusPill({ status }: { status: AppStatus }) {
  const t = useT()
  const s = STATUS_STYLES[status]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {t(`adminA2P.status.${status.toLowerCase()}`)}
    </span>
  )
}

function CopyableField({ label, value }: { label: string; value: string | null | undefined }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  if (!value) return null
  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="col-span-2 text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <span className="font-mono break-all">{value}</span>
        <button onClick={copy} className="text-xs px-2 py-0.5 rounded ml-auto flex-shrink-0" style={{ background: copied ? 'oklch(85% 0.10 145)' : 'var(--surface-overlay)', color: copied ? 'oklch(35% 0.16 145)' : 'var(--text-secondary)' }}>
          {copied ? t('adminA2P.copied') : t('adminA2P.copy')}
        </button>
      </span>
    </div>
  )
}

function userDisplayName(u: OperatorNote['byUser']): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || u.email
}

function NotesPanel({ applicationId }: { applicationId: string }) {
  const t = useT()
  const [notes, setNotes] = useState<OperatorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<NoteCategory>('DATA_GAP')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const list = await apiFetch<OperatorNote[]>(`/api/admin/a2p/${applicationId}/notes`)
      setNotes(list ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [applicationId])

  async function submit() {
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/a2p/${applicationId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ category, note: text.trim() }),
      })
      setText('')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const categories: NoteCategory[] = [
    'CLARIFICATION_NEEDED', 'DATA_GAP', 'FORMAT_ERROR',
    'USE_CASE_MISMATCH', 'COMPLIANCE_CONCERN', 'OTHER',
  ]

  return (
    <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {t('adminA2P.notes.title')}
      </p>
      <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {t('adminA2P.notes.subtitle')}
      </p>

      {loading ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('adminA2P.loading')}</p>
      ) : notes.length === 0 ? (
        <p className="text-xs italic mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('adminA2P.notes.empty')}</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {notes.map(n => (
            <li
              key={n.id}
              className="rounded-lg p-3 text-sm"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: 'oklch(95% 0.04 230)', color: 'oklch(35% 0.14 230)' }}
                >
                  {t(`adminA2P.notes.category.${n.category}`)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('adminA2P.notes.byLabel')} {userDisplayName(n.byUser)} · {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{n.note}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg p-3" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('adminA2P.notes.addTitle')}</p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label className="text-xs flex-shrink-0 self-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('adminA2P.notes.categoryLabel')}
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as NoteCategory)}
              disabled={submitting}
              className="px-2 py-1 rounded text-sm flex-1"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{t(`adminA2P.notes.category.${c}`)}</option>
              ))}
            </select>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={submitting}
            placeholder={t('adminA2P.notes.notePlaceholder')}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
          {error && (
            <p className="text-xs" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</p>
          )}
          <button
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold self-start"
            style={{
              background: 'oklch(55% 0.11 193)',
              color: 'white',
              opacity: (submitting || !text.trim()) ? 0.5 : 1,
              cursor:  (submitting || !text.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? t('adminA2P.notes.submitting') : t('adminA2P.notes.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApplicationDetail({ app, onAction }: { app: A2PApp; onAction: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [showSids, setShowSids] = useState(false)
  const [brandSid, setBrandSid] = useState('')
  const [campaignSid, setCampaignSid] = useState('')
  const [customerProfileSid, setCustomerProfileSid] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  async function markApproved() {
    setBusy(true)
    try {
      await apiFetch(`/api/admin/a2p/${app.id}/mark-approved`, {
        method: 'POST',
        body: JSON.stringify({ brandSid, campaignSid, customerProfileSid }),
      })
      onAction()
    } catch (e) {
      alert((e as Error).message)
    } finally { setBusy(false) }
  }

  async function markRejected() {
    if (!rejectionReason.trim()) { alert(t('adminA2P.actions.rejectionReasonRequired')); return }
    setBusy(true)
    try {
      await apiFetch(`/api/admin/a2p/${app.id}/mark-rejected`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      })
      onAction()
    } catch (e) {
      alert((e as Error).message)
    } finally { setBusy(false) }
  }

  const fullAddress = [app.addressLine1, app.addressLine2, `${app.city}, ${app.region} ${app.postalCode}`, app.country].filter(Boolean).join(', ')

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {app.tenant ? app.tenant.displayName : t('adminA2P.platformLabel')}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {app.tenant
              ? t('adminA2P.tenantIdLabel', { id: app.tenant.id.slice(0, 8) })
              : t('adminA2P.platformIdLabel')}
          </p>
        </div>
        <StatusPill status={app.status} />
      </div>

      {app.rejectionReason && (
        <div className="rounded p-3 mb-4 text-sm" style={{ background: 'oklch(96% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>
          <strong>{t('adminA2P.rejectionLabel')}</strong> {app.rejectionReason}
        </div>
      )}

      <div className="space-y-0">
        <CopyableField label={t('adminA2P.fields.legalName')}        value={app.legalName} />
        <CopyableField label={t('adminA2P.fields.ein')}               value={app.ein} />
        <CopyableField label={t('adminA2P.fields.businessType')}      value={app.businessType} />
        <CopyableField label={t('adminA2P.fields.vertical')}          value={app.vertical} />
        <CopyableField label={t('adminA2P.fields.website')}           value={app.websiteUrl} />
        <CopyableField label={t('adminA2P.fields.address')}           value={fullAddress} />
        <CopyableField label={t('adminA2P.fields.authRep')}           value={`${app.contactFirstName} ${app.contactLastName} <${app.contactEmail}> ${app.contactPhone}`} />
        <CopyableField label={t('adminA2P.fields.useCase')}           value={app.useCase} />
        {app.twilioBrandSid    && <CopyableField label={t('adminA2P.fields.twilioBrandSid')}    value={app.twilioBrandSid} />}
        {app.twilioCampaignSid && <CopyableField label={t('adminA2P.fields.twilioCampaignSid')} value={app.twilioCampaignSid} />}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('adminA2P.fields.sampleMessages')}
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {app.sampleMessagesJson.map((m, i) => <li key={i} className="leading-relaxed">{m}</li>)}
        </ol>
      </div>

      {app.status === 'SUBMITTED' && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>{t('adminA2P.actions.title')}</p>
          {!showSids ? (
            <div className="flex gap-2">
              <button onClick={() => setShowSids(true)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}>
                {t('adminA2P.actions.markApproved')}
              </button>
              <button onClick={() => setShowSids(false)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'oklch(45% 0.18 25)', border: '1px solid var(--border-subtle)' }}>
                {t('adminA2P.actions.markRejected')}
              </button>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder={t('adminA2P.actions.rejectionPlaceholder')}
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <button onClick={markRejected} disabled={busy || !rejectionReason.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'oklch(55% 0.18 25)', color: 'white' }}>
                {t('adminA2P.actions.confirmReject')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={customerProfileSid} onChange={e => setCustomerProfileSid(e.target.value)} placeholder={t('adminA2P.actions.customerProfileSidPlaceholder')} className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <input value={brandSid}           onChange={e => setBrandSid(e.target.value)}           placeholder={t('adminA2P.actions.brandSidPlaceholder')}           className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <input value={campaignSid}        onChange={e => setCampaignSid(e.target.value)}        placeholder={t('adminA2P.actions.campaignSidPlaceholder')}        className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <div className="flex gap-2">
                <button onClick={markApproved} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}>
                  {t('adminA2P.actions.confirmApprove')}
                </button>
                <button onClick={() => setShowSids(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {t('adminA2P.actions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <NotesPanel applicationId={app.id} />
    </div>
  )
}

export default function AdminA2PPage() {
  const t = useT()
  const { data, loading, error, reload } = useApi<AdminA2PResponse>('/api/admin/a2p')

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('adminA2P.loading')}</div>
  if (error)   return <div className="p-8 text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</div>
  if (!data)   return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('adminA2P.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('adminA2P.subtitlePrefix')}
          <a href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc" target="_blank" rel="noreferrer" className="underline" style={{ color: 'oklch(55% 0.11 193)' }}>
            {t('adminA2P.trustHubLink')}
          </a>
          {t('adminA2P.subtitleSuffix')}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {t('adminA2P.platformHeader')}
        </h2>
        {data.platform ? (
          <ApplicationDetail app={data.platform} onAction={reload} />
        ) : (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            {t('adminA2P.platformEmpty', {
              endpoint: 'PUT /api/admin/a2p/platform',
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {t('adminA2P.tenantHeader', { count: data.tenants.length })}
        </h2>
        {data.tenants.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            {t('adminA2P.tenantEmpty')}
          </div>
        ) : (
          <div className="space-y-4">
            {data.tenants.map(app => <ApplicationDetail key={app.id} app={app} onAction={reload} />)}
          </div>
        )}
      </div>
    </div>
  )
}
