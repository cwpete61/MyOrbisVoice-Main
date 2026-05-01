'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { useApi, apiFetch } from '@/hooks/useApi'

interface Contact {
  id: string; fullName: string | null; firstName: string | null; lastName: string | null
  email: string | null; phoneE164: string | null; source: string
  emailStatus: string | null; phoneStatus: string | null
  optedOutSms: boolean; optedOutSmsAt: string | null
  optedOutVoice: boolean; optedOutVoiceAt: string | null
  optedOutEmail: boolean; optedOutEmailAt: string | null
  createdAt: string
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

      <div className="grid grid-cols-3 gap-6">
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
