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
 *
 * Until the full Trust Hub API automation lands (~5-7 days, deferred per
 * backlog #20), this is the operational surface that turns A2P from a
 * "tenant fills form, ops manually does Console work" to a structured
 * pipeline with full visibility.
 */

import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'

type AppStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

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

interface AdminA2PResponse {
  platform: A2PApp | null
  tenants:  A2PApp[]
}

const STATUS_STYLES: Record<AppStatus, { bg: string; fg: string; label: string }> = {
  DRAFT:     { bg: 'oklch(95% 0.02 270)', fg: 'oklch(35% 0.05 270)', label: 'Draft' },
  SUBMITTED: { bg: 'oklch(96% 0.05 75)',  fg: 'oklch(35% 0.16 75)',  label: 'Submitted' },
  APPROVED:  { bg: 'oklch(95% 0.05 160)', fg: 'oklch(35% 0.16 160)', label: 'Approved' },
  REJECTED:  { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)',  label: 'Rejected' },
}

function StatusPill({ status }: { status: AppStatus }) {
  const s = STATUS_STYLES[status]
  return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
}

function CopyableField({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="col-span-2 text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <span className="font-mono break-all">{value}</span>
        <button onClick={copy} className="text-xs px-2 py-0.5 rounded ml-auto flex-shrink-0" style={{ background: copied ? 'oklch(85% 0.10 145)' : 'var(--surface-overlay)', color: copied ? 'oklch(35% 0.16 145)' : 'var(--text-secondary)' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </span>
    </div>
  )
}

function ApplicationDetail({ app, onAction }: { app: A2PApp; onAction: () => void }) {
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
    if (!rejectionReason.trim()) { alert('Rejection reason required'); return }
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
            {app.tenant ? app.tenant.displayName : 'Platform (MyOrbisVoice)'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {app.tenant ? `Tenant ID: ${app.tenant.id.slice(0, 8)}…` : 'Platform-scope (master account)'}
          </p>
        </div>
        <StatusPill status={app.status} />
      </div>

      {app.rejectionReason && (
        <div className="rounded p-3 mb-4 text-sm" style={{ background: 'oklch(96% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>
          <strong>Rejection reason:</strong> {app.rejectionReason}
        </div>
      )}

      <div className="space-y-0">
        <CopyableField label="Legal name"      value={app.legalName} />
        <CopyableField label="EIN"             value={app.ein} />
        <CopyableField label="Business type"   value={app.businessType} />
        <CopyableField label="Vertical"        value={app.vertical} />
        <CopyableField label="Website"         value={app.websiteUrl} />
        <CopyableField label="Address"         value={fullAddress} />
        <CopyableField label="Auth rep"        value={`${app.contactFirstName} ${app.contactLastName} <${app.contactEmail}> ${app.contactPhone}`} />
        <CopyableField label="Use case"        value={app.useCase} />
        {app.twilioBrandSid    && <CopyableField label="Twilio Brand SID"    value={app.twilioBrandSid} />}
        {app.twilioCampaignSid && <CopyableField label="Twilio Campaign SID" value={app.twilioCampaignSid} />}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Sample messages</p>
        <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {app.sampleMessagesJson.map((m, i) => <li key={i} className="leading-relaxed">{m}</li>)}
        </ol>
      </div>

      {app.status === 'SUBMITTED' && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Mark as approved or rejected</p>
          {!showSids ? (
            <div className="flex gap-2">
              <button onClick={() => setShowSids(true)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}>
                Mark Approved
              </button>
              <button onClick={() => setShowSids(false)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'oklch(45% 0.18 25)', border: '1px solid var(--border-subtle)' }}>
                Mark Rejected
              </button>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Rejection reason (required if rejecting)"
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <button onClick={markRejected} disabled={busy || !rejectionReason.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'oklch(55% 0.18 25)', color: 'white' }}>
                Confirm Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={customerProfileSid} onChange={e => setCustomerProfileSid(e.target.value)} placeholder="Twilio Customer Profile SID (BU…)" className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <input value={brandSid}           onChange={e => setBrandSid(e.target.value)}           placeholder="Twilio Brand SID (BN…)"            className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <input value={campaignSid}        onChange={e => setCampaignSid(e.target.value)}        placeholder="Twilio Campaign SID (CMP…)"         className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <div className="flex gap-2">
                <button onClick={markApproved} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}>
                  Confirm Approve
                </button>
                <button onClick={() => setShowSids(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminA2PPage() {
  const { data, loading, error, reload } = useApi<AdminA2PResponse>('/api/admin/a2p')

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
  if (error)   return <div className="p-8 text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</div>
  if (!data)   return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>A2P 10DLC Applications</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Every A2P 10DLC registration across the platform. Use the copy buttons to grab field values for manual submission to{' '}
          <a href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc" target="_blank" rel="noreferrer" className="underline" style={{ color: 'oklch(55% 0.11 193)' }}>
            Twilio Trust Hub Console
          </a>
          {' '}until full API automation lands. Mark approved/rejected here when Twilio responds.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Platform-scope (MyOrbisVoice's own A2P)
        </h2>
        {data.platform ? (
          <ApplicationDetail app={data.platform} onAction={reload} />
        ) : (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            No platform-scope application yet. Use{' '}
            <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)' }}>
              PUT /api/admin/a2p/platform
            </code>
            {' '}with the same fields as the tenant /a2p form to create one. UI form coming when needed.
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Tenant applications ({data.tenants.length})
        </h2>
        {data.tenants.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            No tenant has submitted an A2P application yet.
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
