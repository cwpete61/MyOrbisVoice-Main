'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface Contact {
  id: string; fullName: string | null; firstName: string | null; lastName: string | null
  email: string | null; phoneE164: string | null; source: string
  emailStatus: string | null; phoneStatus: string | null
  optedOutSms: boolean; optedOutSmsAt: string | null
  optedOutVoice: boolean; optedOutVoiceAt: string | null
  optedOutEmail: boolean; optedOutEmailAt: string | null
  createdAt: string
  // CRM relationship fields — collected during outbound campaigns. Date fields
  // are ISO strings or null when not set; JSON fields can be string or array
  // (we accept both shapes in the API, default to string in this UI).
  birthday:             string | null
  anniversary:          string | null
  spouseName:           string | null
  kidsInfoJson:         unknown
  petsInfoJson:         unknown
  importantDatesJson:   unknown
  hobbies:              string | null
  preferredContactTime: string | null
  customerSince:        string | null
  personalNotes:        string | null
}

interface VoiceItem {
  type: 'VOICE'
  at: string
  data: {
    id: string; channelType: string; direction: string; status: string
    startedAt: string; endedAt: string | null; summaryText: string | null
    recordingStatus: string | null; recordingDurationSecs: number | null
    outcomeCode: string | null
  }
}

interface SmsItem {
  type: 'SMS'
  at: string
  data: {
    id: string; direction: string; sender: string; recipient: string
    bodyText: string | null; deliveryStatus: string | null
    optOutDetected: boolean; sentAt: string | null; deliveredAt: string | null
    failedAt: string | null
  }
}

interface OptOutItem {
  type: 'OPT_OUT'
  at: string
  data: { id: string; channel: string; source: string; optedOut: boolean; createdAt: string }
}

type TimelineItem = VoiceItem | SmsItem | OptOutItem

interface TimelineData {
  contact: Contact
  items: TimelineItem[]
  total: number
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

export default function ContactTimelinePage() {
  const t = useT()
  const { contactId } = useParams<{ contactId: string }>()
  const { data, loading, error, reload } = useApi<TimelineData>(`/api/contacts/${contactId}/timeline`)
  const [optOutLoading, setOptOutLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function toggleOptOut(channel: 'SMS' | 'VOICE' | 'EMAIL', currentlyOptedOut: boolean) {
    setOptOutLoading(true)
    try {
      const endpoint = currentlyOptedOut ? 'opt-in' : 'opt-out'
      await apiFetch(`/api/contacts/${contactId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ channel }),
      })
      setMsg(`${channel} ${currentlyOptedOut ? 'opt-in' : 'opt-out'} saved.`)
      reload()
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed') }
    finally { setOptOutLoading(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (error)   return <div className="p-8 text-sm text-red-500">{error}</div>
  if (!data)   return null

  const { contact, items } = data
  const name = contact.fullName ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="text-sm text-gray-400 hover:text-gray-700">← Contacts</Link>
        <h1 className="text-xl font-semibold text-gray-900">{name}</h1>
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Contact info</h2>
          {[
            ['Email', contact.email ?? '—'],
            ['Phone', contact.phoneE164 ?? '—'],
            ['Source', contact.source],
            ['Added', new Date(contact.createdAt).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900">{v}</span>
            </div>
          ))}
          {contact.emailStatus && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email status</span>
              <StatusBadge
                label={contact.emailStatus}
                color={contact.emailStatus === 'valid' ? 'green' : contact.emailStatus === 'invalid' ? 'red' : 'yellow'}
              />
            </div>
          )}
        </div>

        {/* Opt-out controls */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Communication preferences</h2>
          {(['SMS', 'VOICE', 'EMAIL'] as const).map(ch => {
            const isOut = ch === 'SMS' ? contact.optedOutSms : ch === 'VOICE' ? contact.optedOutVoice : contact.optedOutEmail
            const at    = ch === 'SMS' ? contact.optedOutSmsAt : ch === 'VOICE' ? contact.optedOutVoiceAt : contact.optedOutEmailAt
            return (
              <div key={ch} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-700">{ch}</span>
                  {isOut && at && (
                    <p className="text-xs text-gray-400">Since {new Date(at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={isOut ? 'Opted out' : 'Active'} color={isOut ? 'red' : 'green'} />
                  <button
                    onClick={() => toggleOptOut(ch, isOut)}
                    disabled={optOutLoading}
                    className="text-xs text-gray-500 hover:text-gray-900 underline disabled:opacity-50"
                  >
                    {isOut ? 'Opt in' : 'Opt out'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Activity summary</h2>
          {[
            ['Total interactions', items.length],
            ['Voice calls', items.filter(i => i.type === 'VOICE').length],
            ['SMS messages', items.filter(i => i.type === 'SMS').length],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Personal details (CRM) */}
      <PersonalDetails contact={contact} contactId={contactId} onSaved={() => { reload(); setMsg(t('contactCrm.saved')) }} onError={(e) => setMsg(e)} t={t} />

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Interaction timeline</h2>

        {items.length === 0 && (
          <p className="text-sm text-gray-400">No interactions yet.</p>
        )}

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 text-sm">
              {/* Time column */}
              <div className="w-32 shrink-0 text-xs text-gray-400 pt-0.5">
                {new Date(item.at).toLocaleDateString()}<br />
                <span className="text-gray-300">{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Content */}
              <div className="flex-1 rounded-lg px-4 py-3 border border-gray-100" style={{ background: '#fafafa' }}>
                {item.type === 'VOICE' && (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">📞 Voice call</span>
                        <StatusBadge
                          label={item.data.direction}
                          color={item.data.direction === 'INBOUND' ? 'blue' : 'gray'}
                        />
                        <StatusBadge
                          label={item.data.status}
                          color={item.data.status === 'COMPLETED' ? 'green' : item.data.status === 'MISSED' ? 'red' : 'yellow'}
                        />
                        {item.data.recordingDurationSecs && (
                          <span className="text-xs text-gray-400">{fmtDur(item.data.recordingDurationSecs)}</span>
                        )}
                      </div>
                      {item.data.summaryText && (
                        <p className="text-sm text-gray-700 mt-1">{item.data.summaryText}</p>
                      )}
                      {item.data.outcomeCode && (
                        <p className="text-xs text-gray-400 mt-1">Outcome: {item.data.outcomeCode}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.data.recordingStatus === 'stored' && (
                        <Link href={`/conversations/${item.data.id}`} className="text-xs text-teal-600 hover:underline">Recording →</Link>
                      )}
                    </div>
                  </div>
                )}

                {item.type === 'SMS' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">💬 SMS</span>
                      <StatusBadge
                        label={item.data.direction}
                        color={item.data.direction === 'INBOUND' ? 'blue' : 'gray'}
                      />
                      {item.data.deliveryStatus && (
                        <StatusBadge
                          label={item.data.deliveryStatus}
                          color={item.data.deliveryStatus === 'delivered' ? 'green' : item.data.deliveryStatus === 'failed' ? 'red' : 'yellow'}
                        />
                      )}
                      {item.data.optOutDetected && (
                        <StatusBadge label="STOP received" color="red" />
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{item.data.bodyText ?? '(no body)'}</p>
                  </div>
                )}

                {item.type === 'OPT_OUT' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">⚠ Opt-out event</span>
                    <StatusBadge
                      label={item.data.optedOut ? `${item.data.channel} opted out` : `${item.data.channel} opted in`}
                      color={item.data.optedOut ? 'red' : 'green'}
                    />
                    <span className="text-xs text-gray-400">via {item.data.source.replace(/_/g, ' ').toLowerCase()}</span>
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

// ── Personal details editor (CRM) ───────────────────────────────────────────
// Collected during outbound campaigns (the inbound prompt explicitly avoids
// asking for these). Tenant admin can add/edit them here at any time. The
// JSON-typed fields (kids/pets/important-dates) accept either an array (when
// an outbound agent populates them via tool call) or a plain string (when a
// human types text in this form). We render both shapes as text and write
// back as a string, leaving structured arrays untouched if the user doesn't
// edit that field.
function PersonalDetails({
  contact, contactId, onSaved, onError, t,
}: {
  contact: Contact
  contactId: string
  onSaved: () => void
  onError: (msg: string) => void
  t: (k: string) => string
}) {
  const toIsoDate = (v: string | null) => v ? new Date(v).toISOString().slice(0, 10) : ''
  const jsonAsText = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    try { return JSON.stringify(v) } catch { return '' }
  }

  const [form, setForm] = useState({
    birthday:             toIsoDate(contact.birthday),
    anniversary:          toIsoDate(contact.anniversary),
    spouseName:           contact.spouseName ?? '',
    kidsInfoJson:         jsonAsText(contact.kidsInfoJson),
    petsInfoJson:         jsonAsText(contact.petsInfoJson),
    importantDatesJson:   jsonAsText(contact.importantDatesJson),
    hobbies:              contact.hobbies ?? '',
    preferredContactTime: contact.preferredContactTime ?? '',
    customerSince:        toIsoDate(contact.customerSince),
    personalNotes:        contact.personalNotes ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Reset form when the underlying contact changes (e.g. after reload()).
  useEffect(() => {
    setForm({
      birthday:             toIsoDate(contact.birthday),
      anniversary:          toIsoDate(contact.anniversary),
      spouseName:           contact.spouseName ?? '',
      kidsInfoJson:         jsonAsText(contact.kidsInfoJson),
      petsInfoJson:         jsonAsText(contact.petsInfoJson),
      importantDatesJson:   jsonAsText(contact.importantDatesJson),
      hobbies:              contact.hobbies ?? '',
      preferredContactTime: contact.preferredContactTime ?? '',
      customerSince:        toIsoDate(contact.customerSince),
      personalNotes:        contact.personalNotes ?? '',
    })
  }, [contact])

  // Reusable change handler factory. Defined as `function` rather than
  // arrow-generics to dodge the i18n scanner's false-positive match on the
  // closing `>` of the React.ChangeEvent generic.
  type AnyInput = HTMLInputElement | HTMLTextAreaElement
  function set(k: keyof typeof form) {
    return function onChange(e: React.ChangeEvent<AnyInput>) {
      setForm(p => ({ ...p, [k]: e.target.value }))
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Send all editable fields. Empty strings are converted to null on the
      // server. JSON fields go as plain strings (the API accepts unknown).
      await apiFetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : t('contactCrm.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-teal-500'

  return (
    <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">{t('contactCrm.sectionTitle')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('contactCrm.sectionSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>{t('contactCrm.birthday')}</label>
          <input type="date" className={inputCls} value={form.birthday} onChange={set('birthday')} />
        </div>
        <div>
          <label className={labelCls}>{t('contactCrm.anniversary')}</label>
          <input type="date" className={inputCls} value={form.anniversary} onChange={set('anniversary')} />
        </div>
        <div>
          <label className={labelCls}>{t('contactCrm.customerSince')}</label>
          <input type="date" className={inputCls} value={form.customerSince} onChange={set('customerSince')} />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>{t('contactCrm.spouseName')}</label>
          <input type="text" className={inputCls} value={form.spouseName} onChange={set('spouseName')} maxLength={200} />
        </div>
        <div>
          <label className={labelCls}>{t('contactCrm.preferredContactTime')}</label>
          <input type="text" className={inputCls} value={form.preferredContactTime} onChange={set('preferredContactTime')} placeholder={t('contactCrm.preferredContactTimePlaceholder')} maxLength={100} />
        </div>

        <div className="md:col-span-1">
          <label className={labelCls}>{t('contactCrm.kidsInfo')}</label>
          <input type="text" className={inputCls} value={form.kidsInfoJson} onChange={set('kidsInfoJson')} placeholder={t('contactCrm.kidsInfoPlaceholder')} />
        </div>
        <div className="md:col-span-1">
          <label className={labelCls}>{t('contactCrm.petsInfo')}</label>
          <input type="text" className={inputCls} value={form.petsInfoJson} onChange={set('petsInfoJson')} placeholder={t('contactCrm.petsInfoPlaceholder')} />
        </div>
        <div className="md:col-span-1">
          <label className={labelCls}>{t('contactCrm.hobbies')}</label>
          <input type="text" className={inputCls} value={form.hobbies} onChange={set('hobbies')} placeholder={t('contactCrm.hobbiesPlaceholder')} maxLength={500} />
        </div>

        <div className="md:col-span-3">
          <label className={labelCls}>{t('contactCrm.importantDates')}</label>
          <input type="text" className={inputCls} value={form.importantDatesJson} onChange={set('importantDatesJson')} placeholder={t('contactCrm.importantDatesPlaceholder')} />
        </div>

        <div className="md:col-span-3">
          <label className={labelCls}>{t('contactCrm.personalNotes')}</label>
          <textarea className={inputCls} rows={3} value={form.personalNotes} onChange={set('personalNotes')} placeholder={t('contactCrm.personalNotesPlaceholder')} maxLength={2000} />
        </div>
      </div>

      <div>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50">
          {saving ? t('contactCrm.saving') : t('contactCrm.save')}
        </button>
      </div>
    </form>
  )
}
