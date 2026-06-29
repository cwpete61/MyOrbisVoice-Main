'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'
import { LeadScoreBadge, LEAD_CATS, gradeFor } from '@/components/LeadScoreBadge'

interface PipelineStageRef { id: string; name: string; color: string | null; sortOrder: number }

interface EvalMeta {
  leadCaptureScore?: number | null; leadCaptureGrade?: string | null
  evalScores?: Record<string, number> | null
  niche?: string | null; contactName?: string | null; businessName?: string | null; personalPhone?: string | null
}

interface Contact {
  id: string
  fullName: string | null; firstName: string | null; lastName: string | null
  email: string | null; phoneE164: string | null; source: string
  emailStatus: string | null; phoneStatus: string | null
  optedOutSms: boolean; optedOutSmsAt: string | null
  optedOutVoice: boolean; optedOutVoiceAt: string | null
  optedOutEmail: boolean; optedOutEmailAt: string | null
  createdAt: string
  metadataJson: EvalMeta | null
  pipelineStageId: string | null
  pipelineStage:   PipelineStageRef | null
  stageUpdatedAt:  string | null
}

interface VoiceItem { type: 'VOICE'; at: string; data: {
  id: string; channelType: string; direction: string; status: string
  startedAt: string; endedAt: string | null; summaryText: string | null
  recordingStatus: string | null; recordingDurationSecs: number | null
  outcomeCode: string | null
} }
interface SmsItem   { type: 'SMS'; at: string; data: {
  id: string; channel: string; direction: string; sender: string; recipient: string
  subject: string | null; bodyText: string | null; deliveryStatus: string | null
  optOutDetected: boolean; sentAt: string | null; deliveredAt: string | null; failedAt: string | null
} }
interface EmailItem { type: 'EMAIL'; at: string; data: {
  id: string; channel: string; direction: string; sender: string; recipient: string
  subject: string | null; bodyText: string | null; deliveryStatus: string | null
  sentAt: string | null; deliveredAt: string | null; failedAt: string | null
} }
interface NoteItem  { type: 'NOTE'; at: string; data: {
  id: string; body: string; createdAt: string
  author: { id: string; firstName: string | null; lastName: string | null; email: string } | null
} }
interface AppointmentItem { type: 'APPOINTMENT'; at: string; data: {
  id: string; status: string; appointmentType: string | null
  startAt: string; endAt: string | null; notes: string | null
} }

type TimelineItem = VoiceItem | SmsItem | EmailItem | NoteItem | AppointmentItem

interface TimelineData {
  contact: Contact
  items:   TimelineItem[]
  total:   number
}

function fmtDur(secs: number | null) {
  if (!secs) return null
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-100 text-red-700',
    gray:   'bg-gray-100 text-gray-600',
    blue:   'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  }
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[color] ?? colors['gray']}`}>{label}</span>
}

export default function PartnerContactTimelinePage() {
  const t = useT()
  const tz = useUserTimezone()
  const { contactId } = useParams<{ contactId: string }>()
  const { data, loading, error, reload } = useApi<TimelineData>(`/api/partner/crm/contacts/${contactId}/timeline`)
  const [msg, setMsg] = useState('')
  const { locale } = useLocale()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.loading')}</div>
  if (error)   return <div className="p-8 text-sm" style={{ color: 'var(--error-600)' }}>{error}</div>
  if (!data)   return null

  const { contact, items } = data
  const name = contact.fullName ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || t('partnerContactDetail.unknown'))

  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const meta = contact.metadataJson ?? {}
  const hasEval = typeof meta.leadCaptureScore === 'number'
  async function makeInvite() {
    try {
      const r = await apiFetch<{ url: string }>(`/api/partner/crm/contacts/${contactId}/invite`, { method: 'POST' })
      setInviteUrl(r.url)
    } catch { /* surfaced via the button staying available */ }
  }
  function copyInvite() {
    if (inviteUrl) navigator.clipboard?.writeText(inviteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/partner-portal/contacts" className="text-sm hover:underline" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.backLink')}</Link>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h1>
      </div>

      {msg && <div className="alert-success p-3 rounded-lg text-sm">{msg}</div>}

      <PartnerStageChip contact={contact} onChanged={reload} t={t} />

      {/* Lead Capture Evaluation report — re-openable any time, with the signup link */}
      {hasEval && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{L === 'es' ? 'Evaluación de captura de leads' : 'Lead Capture Evaluation'}</h2>
              <LeadScoreBadge score={meta.leadCaptureScore as number} grade={meta.leadCaptureGrade} />
            </div>
            {!inviteUrl ? (
              <button onClick={makeInvite} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>{L === 'es' ? 'Obtener enlace del reporte' : 'Get report link'}</button>
            ) : (
              <div className="flex items-center gap-2 min-w-[240px]">
                <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 text-xs bg-transparent outline-none rounded-lg px-2 py-1.5" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }} />
                <button onClick={copyInvite} className="text-xs px-2.5 py-1.5 rounded-lg shrink-0" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>{copied ? (L === 'es' ? 'Copiado' : 'Copied') : (L === 'es' ? 'Copiar' : 'Copy')}</button>
              </div>
            )}
          </div>
          {meta.evalScores && (
            <div className="grid gap-2 sm:grid-cols-2">
              {LEAD_CATS.map((cat) => {
                const pts = meta.evalScores?.[cat.key]
                return (
                  <div key={cat.key} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-overlay)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{L === 'es' ? cat.es : cat.en}</span>
                    <span className="tabular-nums font-semibold" style={{ color: typeof pts === 'number' ? gradeFor(meta.leadCaptureScore as number).color : 'var(--text-tertiary)' }}>{typeof pts === 'number' ? `${pts} / ${cat.max}` : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
          {meta.niche && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(L === 'es' ? 'Nicho: ' : 'Niche: ') + meta.niche}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContactInfoCard contact={contact} t={t} tz={tz} onSaved={reload} />

        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('partnerContactDetail.commsPrefs')}</h2>
          {(['SMS', 'VOICE', 'EMAIL'] as const).map(ch => {
            const isOut = ch === 'SMS' ? contact.optedOutSms : ch === 'VOICE' ? contact.optedOutVoice : contact.optedOutEmail
            const at    = ch === 'SMS' ? contact.optedOutSmsAt : ch === 'VOICE' ? contact.optedOutVoiceAt : contact.optedOutEmailAt
            return (
              <div key={ch} className="flex items-center justify-between text-sm">
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>{ch}</span>
                  {isOut && at && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.since')} {formatInTimezone(at, { tz, dateStyle: 'medium' })}</p>
                  )}
                </div>
                <StatusBadge label={isOut ? t('partnerContactDetail.optedOut') : t('partnerContactDetail.active')} color={isOut ? 'red' : 'green'} />
              </div>
            )
          })}
        </div>

        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('partnerContactDetail.activitySummary')}</h2>
          {[
            [t('partnerContactDetail.totalInteractions'), items.length],
            [t('partnerContactDetail.voiceCalls'),  items.filter(i => i.type === 'VOICE').length],
            [t('partnerContactDetail.smsMessages'), items.filter(i => i.type === 'SMS').length],
            [t('partnerContactDetail.emails'),      items.filter(i => i.type === 'EMAIL').length],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <PartnerComposeButtons contact={contact} contactId={contactId} onSent={(label) => { setMsg(label); reload() }} t={t} />
      <PartnerNotesThread contactId={contactId} t={t} />

      <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>{t('partnerContactDetail.timelineTitle')}</h2>

        {items.length === 0 && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.timelineEmpty')}</p>}

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 text-sm">
              <div className="w-32 shrink-0 text-xs pt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {formatInTimezone(item.at, { tz, dateStyle: 'medium' })}<br />
                <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>{formatInTimezone(item.at, { tz, hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="flex-1 rounded-lg px-4 py-3" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                {item.type === 'VOICE' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>📞 {t('partnerContactDetail.voiceCallLabel')}</span>
                      <StatusBadge label={item.data.direction} color={item.data.direction === 'INBOUND' ? 'blue' : 'gray'} />
                      <StatusBadge label={item.data.status} color={item.data.status === 'COMPLETED' ? 'green' : item.data.status === 'MISSED' ? 'red' : 'yellow'} />
                      {item.data.recordingDurationSecs && (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtDur(item.data.recordingDurationSecs)}</span>
                      )}
                    </div>
                    {item.data.summaryText && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{item.data.summaryText}</p>}
                  </div>
                )}

                {item.type === 'SMS' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>💬 {t('partnerContactDetail.smsLabel')}</span>
                      <StatusBadge label={item.data.direction} color={item.data.direction === 'INBOUND' ? 'blue' : 'gray'} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.data.bodyText ?? ''}</p>
                  </div>
                )}

                {item.type === 'EMAIL' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>📧 {t('partnerContactDetail.emailLabel')}</span>
                      <StatusBadge label={item.data.direction} color={item.data.direction === 'INBOUND' ? 'blue' : 'gray'} />
                    </div>
                    {item.data.subject && <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{item.data.subject}</p>}
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{item.data.bodyText ?? ''}</p>
                  </div>
                )}

                {item.type === 'NOTE' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>📝 {t('partnerContactDetail.noteLabel')}</span>
                      {item.data.author ? (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {[item.data.author.firstName, item.data.author.lastName].filter(Boolean).join(' ') || item.data.author.email}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.systemAuthor')}</span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{item.data.body}</p>
                  </div>
                )}

                {item.type === 'APPOINTMENT' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>📅 {t('partnerContactDetail.appointmentLabel')}</span>
                      <StatusBadge label={item.data.status} color={item.data.status === 'BOOKED' ? 'green' : item.data.status === 'CANCELED' ? 'red' : 'yellow'} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatInTimezone(item.data.startAt, { tz, dateStyle: 'medium', timeStyle: 'short' })}
                      {item.data.endAt && ` – ${formatInTimezone(item.data.endAt, { tz, timeStyle: 'short' })}`}
                    </p>
                    {item.data.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{item.data.notes}</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PartnerStageChip({
  contact, onChanged, t,
}: { contact: Contact; onChanged: () => void; t: (k: string) => string }) {
  const { data: stages } = useApi<Array<{ id: string; name: string; color: string | null; sortOrder: number }>>('/api/partner/crm/pipeline-stages')
  const [moving, setMoving] = useState(false)

  async function setStage(stageId: string) {
    if (stageId === contact.pipelineStageId) return
    setMoving(true)
    try {
      await apiFetch(`/api/partner/crm/contacts/${contact.id}/stage`, {
        method: 'PATCH',
        body:   JSON.stringify({ stageId }),
      })
      onChanged()
    } finally { setMoving(false) }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('partnerContactDetail.stageLabel')}</span>
      {contact.pipelineStage ? (
        <span
          className="text-sm font-medium px-2 py-0.5 rounded"
          style={{ background: contact.pipelineStage.color ?? 'var(--surface-overlay)', color: '#333' }}
        >
          {contact.pipelineStage.name}
        </span>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.stageUnset')}</span>
      )}
      <select
        value={contact.pipelineStageId ?? ''}
        onChange={(e) => setStage(e.target.value)}
        disabled={moving}
        className="text-sm rounded-md px-2 py-1 ml-auto"
        style={{ background: 'var(--surface-app)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        aria-label={t('partnerContactDetail.stageLabel')}
      >
        <option value="" disabled>{t('partnerContactDetail.stageSelectPlaceholder')}</option>
        {(stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  )
}

// Contact info card with inline edit (name / email / phone). Partners can fix
// or fill in details — directory leads start sparse (no email/phone).
function ContactInfoCard({ contact, t, tz, onSaved }: {
  contact: Contact; t: (k: string) => string; tz: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(contact.fullName ?? '')
  const [contactName, setContactName] = useState(contact.firstName ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phoneE164 ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    try {
      await apiFetch(`/api/partner/crm/contacts/${contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName: fullName || null, firstName: contactName || null, email: email || null, phoneE164: phone || null }),
      })
      setEditing(false); onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('partnerContactDetail.sendFailed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('partnerContactDetail.contactInfo')}</h2>
        {!editing && <button onClick={() => setEditing(true)} className="text-xs btn-ghost">{t('partnerContactDetail.edit')}</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('partnerContactDetail.namePlaceholder')} className="input w-full text-sm" maxLength={200} />
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t('partnerContactDetail.contactNamePlaceholder')} className="input w-full text-sm" maxLength={120} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('partnerContactDetail.addEmailPlaceholder')} className="input w-full text-sm" maxLength={200} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('partnerContactDetail.phonePlaceholder')} className="input w-full text-sm" maxLength={40} />
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-xs">{saving ? t('partnerContactDetail.sending') : t('partnerContactDetail.save')}</button>
            <button onClick={() => { setEditing(false); setFullName(contact.fullName ?? ''); setContactName(contact.firstName ?? ''); setEmail(contact.email ?? ''); setPhone(contact.phoneE164 ?? '') }} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.cancel')}</button>
            {err && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{err}</span>}
          </div>
        </div>
      ) : (
        <>
          {[
            [t('partnerContactDetail.contactName'), contact.firstName ?? '—'],
            [t('partnerContactDetail.email'),  contact.email ?? '—'],
            [t('partnerContactDetail.phone'),  contact.phoneE164 ?? '—'],
            [t('partnerContactDetail.source'), contact.source],
            [t('partnerContactDetail.added'),  formatInTimezone(contact.createdAt, { tz, dateStyle: 'medium' })],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span style={{ color: 'var(--text-primary)' }}>{v}</span>
            </div>
          ))}
          {contact.emailStatus && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{t('partnerContactDetail.emailStatus')}</span>
              <StatusBadge label={contact.emailStatus} color={contact.emailStatus === 'valid' ? 'green' : contact.emailStatus === 'invalid' ? 'red' : 'yellow'} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PartnerComposeButtons({
  contact, contactId, onSent, t,
}: { contact: Contact; contactId: string; onSent: (msg: string) => void; t: (k: string) => string }) {
  const [mode, setMode] = useState<null | 'email' | 'sms'>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [inboxMode, setInboxMode] = useState(true)  // plain = lands in Primary; off = branded (logo+avatar+button)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  // Add-email (directory leads start with no email; partner adds the owner's
  // after the call, which un-grays the Email compose).
  const [emailInput, setEmailInput] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Open the email composer pre-filled with the claim invite. Uses the staged
  // subject/body if present, else builds it from the business name + tagged
  // claim link in metadata (so it works for directory leads created before
  // staging existed too). Non-directory contacts (no claimLink) open blank.
  function openEmail() {
    setErr('')
    const meta = (contact.metadataJson as unknown as Record<string, unknown>) ?? {}
    const business = (typeof meta['businessName'] === 'string' && meta['businessName']) || contact.fullName || ''
    const link = typeof meta['claimLink'] === 'string' ? (meta['claimLink'] as string) : ''
    // Greeting name: the contact's person name (first name), else default to the
    // business name. Always rebuild from the current template so the greeting picks
    // up the latest name and the removed "claim it here" URL line never lingers on
    // older staged bodies. The button carries the link.
    const metaName = typeof meta['contactName'] === 'string' ? (meta['contactName'] as string) : ''
    const name = (contact.firstName?.trim() || metaName.trim() || business)
    const fill = (tpl: string) => tpl.replaceAll('{business}', business).replaceAll('{link}', link).replaceAll('{name}', name)
    if (link) {
      setSubject(fill(t('partnerDirectory.emailSubject')))
      setBody(fill(t('partnerDirectory.emailBody')))
    }
    setMode('email')
  }

  async function saveEmail() {
    if (!emailInput.trim()) return
    setSavingEmail(true); setErr('')
    try {
      await apiFetch(`/api/partner/crm/contacts/${contactId}`, {
        method: 'PATCH', body: JSON.stringify({ email: emailInput.trim() }),
      })
      onSent(t('partnerContactDetail.emailAdded'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('partnerContactDetail.sendFailed'))
    } finally { setSavingEmail(false) }
  }

  async function send() {
    setSending(true); setErr('')
    try {
      if (mode === 'email') {
        await apiFetch(`/api/partner/crm/contacts/${contactId}/email`, {
          method: 'POST',
          body:   JSON.stringify({ subject, body, plain: inboxMode }),
        })
        onSent(t('partnerContactDetail.emailSentConfirm'))
      } else if (mode === 'sms') {
        await apiFetch(`/api/partner/crm/contacts/${contactId}/sms`, {
          method: 'POST',
          body:   JSON.stringify({ body }),
        })
        onSent(t('partnerContactDetail.smsSentConfirm'))
      }
      setMode(null); setSubject(''); setBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('partnerContactDetail.sendFailed'))
    } finally { setSending(false) }
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      {/* No email yet — let the partner add the owner's address (post-call). */}
      {!contact.email && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={t('partnerContactDetail.addEmailPlaceholder')}
            className="input flex-1 text-sm"
          />
          <button onClick={saveEmail} disabled={savingEmail || !emailInput.trim()} className="btn-primary text-xs">
            {savingEmail ? t('partnerContactDetail.sending') : t('partnerContactDetail.addEmail')}
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={openEmail}
          disabled={!contact.email || contact.optedOutEmail}
          className="text-xs btn-ghost disabled:opacity-40"
        >
          {t('partnerContactDetail.composeEmail')}
        </button>
        <button
          onClick={() => { setMode('sms'); setErr('') }}
          disabled={!contact.phoneE164 || contact.optedOutSms}
          className="text-xs btn-ghost disabled:opacity-40"
        >
          {t('partnerContactDetail.composeSms')}
        </button>
        {mode && <button onClick={() => setMode(null)} className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.cancel')}</button>}
      </div>

      {mode && (
        <div className="mt-3 space-y-2">
          {mode === 'email' && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('partnerContactDetail.emailSubjectPlaceholder')}
              className="input w-full"
              maxLength={200}
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={mode === 'email' ? t('partnerContactDetail.emailBodyPlaceholder') : t('partnerContactDetail.smsBodyPlaceholder')}
            className="input w-full"
            rows={mode === 'email' ? 6 : 3}
            maxLength={mode === 'email' ? 50000 : 1600}
          />
          {mode === 'email' && (
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={inboxMode} onChange={(e) => setInboxMode(e.target.checked)} />
              {t('partnerContactDetail.inboxMode')}
            </label>
          )}
          <div className="flex items-center gap-2">
            <button onClick={send} disabled={sending || !body.trim() || (mode === 'email' && !subject.trim())} className="btn-primary text-xs">
              {sending ? t('partnerContactDetail.sending') : t('partnerContactDetail.send')}
            </button>
            {err && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function PartnerNotesThread({ contactId, t }: { contactId: string; t: (k: string) => string }) {
  interface Note {
    id: string; body: string; createdAt: string
    author: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  }
  const { data, reload } = useApi<Note[]>(`/api/partner/crm/contacts/${contactId}/notes`)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/api/partner/crm/contacts/${contactId}/notes`, {
        method: 'POST',
        body:   JSON.stringify({ body: draft }),
      })
      setDraft('')
      reload()
    } finally { setSaving(false) }
  }

  const notes = data ?? []
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('partnerContactDetail.notesTitle')}</h2>

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('partnerContactDetail.noteDraftPlaceholder')}
          rows={2}
          maxLength={4000}
          className="input flex-1"
        />
        <button onClick={addNote} disabled={saving || !draft.trim()} className="btn-primary text-xs self-start">
          {saving ? t('partnerContactDetail.savingNote') : t('partnerContactDetail.addNote')}
        </button>
      </div>

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContactDetail.notesEmpty')}</p>}
        {notes.map(n => (
          <div key={n.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
              <span>
                {n.author
                  ? ([n.author.firstName, n.author.lastName].filter(Boolean).join(' ') || n.author.email)
                  : t('partnerContactDetail.systemAuthor')}
              </span>
              <span>{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
