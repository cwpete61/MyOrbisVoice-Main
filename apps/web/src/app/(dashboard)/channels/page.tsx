'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'

interface BusinessHours {
  [day: string]: { open: string; close: string; closed: boolean }
}

interface ChannelConfig {
  forwardingNumber?: string
  transferNumber?: string
  businessHours?: BusinessHours
  voiceName?: string
  agentSpeaksFirst?: boolean
}

const VOICE_OPTIONS = [
  { value: 'Zephyr',  label: 'Zephyr',  gender: 'Female', style: 'Bright & clear' },
  { value: 'Despina', label: 'Despina', gender: 'Female', style: 'Smooth & polished' },
  { value: 'Aoede',   label: 'Aoede',   gender: 'Female', style: 'Warm & breezy' },
  { value: 'Charon',  label: 'Charon',  gender: 'Male',   style: 'Deep & authoritative' },
  { value: 'Fenrir',  label: 'Fenrir',  gender: 'Male',   style: 'Warm & approachable' },
  { value: 'Puck',    label: 'Puck',    gender: 'Male',   style: 'Upbeat & conversational' },
  { value: 'Sulafat', label: 'Sulafat', gender: 'Neutral', style: 'Warm & even' },
]

interface Channel {
  id: string; channelType: string; isEnabled: boolean
  greetingMode: string | null; afterHoursMode: string | null; escalationMode: string | null
  configJson: ChannelConfig | null
  promptVersion: { id: string; name: string } | null
}

interface PhoneNumber {
  id: string; e164Number: string; displayLabel: string | null
  isInboundEnabled: boolean; isOutboundEnabled: boolean; isSmsEnabled: boolean
  forwardingTarget: string | null; twilioNumberSid: string | null
}

const CHANNEL_LABELS: Record<string, { label: string; description: string }> = {
  WIDGET:   { label: 'Website Widget',       description: 'Real-time browser voice agent' },
  INBOUND:  { label: 'Inbound Receptionist', description: 'Handles live phone calls' },
  OUTBOUND: { label: 'Outbound Caller',      description: 'Runs campaigns and follow-up calls' },
}

const AFTER_HOURS_OPTIONS = [
  { value: '',          label: 'Default (inform & hang up)' },
  { value: 'voicemail', label: 'Record voicemail' },
  { value: 'forward',   label: 'Forward to number' },
]

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }

const DEFAULT_HOURS: BusinessHours = {
  mon: { open: '09:00', close: '17:00', closed: false },
  tue: { open: '09:00', close: '17:00', closed: false },
  wed: { open: '09:00', close: '17:00', closed: false },
  thu: { open: '09:00', close: '17:00', closed: false },
  fri: { open: '09:00', close: '17:00', closed: false },
  sat: { open: '09:00', close: '13:00', closed: true  },
  sun: { open: '09:00', close: '13:00', closed: true  },
}

const inp  = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl  = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const mono = 'font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded'

interface ContactOption { id: string; fullName: string | null; phoneE164: string | null }

function ContactPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useApi<{ items: ContactOption[] }>('/api/contacts?limit=200')
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const contacts = (data?.items ?? []).filter(c => c.phoneE164)

  // Normalize typed input: strip non-digits, prefix +1
  function handleInput(raw: string) {
    if (raw === '' || raw === '+') { onChange('+1'); return }
    const digits = raw.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    // Always produce +1XXXXXXXXXX
    const national = digits.startsWith('1') ? digits.slice(1) : digits
    onChange(`+1${national}`)
  }

  // Suggestions: contacts whose number contains the typed digits
  const typedDigits = value.replace(/\D/g, '')
  const suggestions = typedDigits.length >= 2
    ? contacts.filter(c => (c.phoneE164 ?? '').replace(/\D/g, '').includes(typedDigits) && c.phoneE164 !== value)
    : []

  // Show name if value exactly matches a contact
  const matched = contacts.find(c => c.phoneE164 === value)

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { handleInput(e.target.value); setOpen(true) }}
        className={inp}
        placeholder="+1"
        autoComplete="off"
      />

      {/* Matched contact name tag */}
      {matched && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--text-tertiary)' }}>
            <path d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0" />
          </svg>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{matched.fullName ?? matched.phoneE164}</span>
        </div>
      )}

      {/* Dropdown: suggestions from contacts */}
      {open && (suggestions.length > 0 || contacts.length > 0) && (
        <div className="absolute z-20 mt-1 w-full rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="max-h-52 overflow-y-auto">
            {/* Filtered suggestions when typing */}
            {suggestions.length > 0 && suggestions.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onChange(c.phoneE164!); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.fullName ?? '—'}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.phoneE164}</span>
              </button>
            ))}
            {/* Full list when not filtering */}
            {suggestions.length === 0 && contacts.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onChange(c.phoneE164!); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ background: c.phoneE164 === value ? 'var(--surface-overlay)' : undefined }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.fullName ?? '—'}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.phoneE164}</span>
              </button>
            ))}
            {contacts.length === 0 && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                No contacts with phone numbers. Add them in Contacts first.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneNumbersPanel({ numbers }: { numbers: PhoneNumber[] }) {
  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phone Numbers</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Numbers Twilio routes to this receptionist</p>
        </div>
        <Link href="/phone-numbers"
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
          Manage in Phone Numbers →
        </Link>
      </div>

      {numbers.length === 0
        ? <p className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">No phone numbers yet — search and purchase one in <Link href="/phone-numbers" className="text-blue-600 hover:underline">Phone Numbers</Link>.</p>
        : (
          <div className="space-y-2">
            {numbers.map((n) => (
              <div key={n.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className={mono}>{n.e164Number}</span>
                  {n.displayLabel && <span className="ml-2 text-xs text-gray-500">{n.displayLabel}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function BusinessHoursEditor({ hours, onChange }: { hours: BusinessHours; onChange: (h: BusinessHours) => void }) {
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const entry = hours[day] ?? DEFAULT_HOURS[day]!
        return (
          <div key={day} className="flex items-center gap-3">
            <div className="w-8 text-xs font-medium text-gray-500 dark:text-gray-400">{DAY_LABELS[day]}</div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!entry.closed}
                onChange={(e) => onChange({ ...hours, [day]: { ...entry, closed: !e.target.checked } })}
                className="rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Open</span>
            </label>
            {!entry.closed && (
              <>
                <input type="time" value={entry.open}
                  onChange={(e) => onChange({ ...hours, [day]: { ...entry, open: e.target.value } })}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={entry.close}
                  onChange={(e) => onChange({ ...hours, [day]: { ...entry, close: e.target.value } })}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </>
            )}
            {entry.closed && <span className="text-xs text-gray-400 italic">Closed</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function ChannelsPage() {
  const { data: channels, loading, error, reload } = useApi<Channel[]>('/api/channels')
  const { data: phoneNumbers, reload: reloadNumbers } = useApi<PhoneNumber[]>('/api/phone-numbers')
  const [selected, setSelected] = useState<Channel | null>(null)
  const [saving, setSaving]     = useState(false)
  const [message, setMessage]   = useState('')

  function getConfig(ch: Channel): ChannelConfig {
    return (ch.configJson as ChannelConfig) ?? {}
  }

  function setConfig(key: keyof ChannelConfig, value: unknown) {
    if (!selected) return
    setSelected({ ...selected, configJson: { ...getConfig(selected), [key]: value } })
  }

  async function saveChannel() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiFetch<Channel>(`/api/channels/${selected.channelType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isEnabled:      selected.isEnabled,
          greetingMode:   selected.greetingMode,
          afterHoursMode: selected.afterHoursMode,
          escalationMode: selected.escalationMode,
          configJson:     selected.configJson,
        }),
      })
      setSelected(updated)
      await reload()
      setMessage('Channel saved.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (error)   return <div className="p-8 text-sm text-red-500">{error}</div>

  const cfg = selected ? getConfig(selected) : {}

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Channels</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enable and configure each voice channel</p>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(channels ?? []).map((c) => (
          <button key={c.id} onClick={() => { setSelected(prev => prev?.id === c.id ? null : c); setMessage('') }}
            className={`text-left p-5 rounded-xl border transition-all ${selected?.id === c.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{CHANNEL_LABELS[c.channelType]?.label}</span>
              <span className={`w-2 h-2 rounded-full ${c.isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{CHANNEL_LABELS[c.channelType]?.description}</p>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Backdrop — click outside panel to close */}
          <div className="fixed inset-0 z-10" onClick={() => setSelected(null)} />

          <div className="relative z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-w-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{CHANNEL_LABELS[selected.channelType]?.label}</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={selected.isEnabled}
                  onChange={(e) => setSelected({ ...selected, isEnabled: e.target.checked })} className="rounded" />
                Enabled
              </label>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          </div>

          {/* Voice selection */}
          <div>
            <label className={lbl}>Agent voice</label>
            <div className="grid grid-cols-1 gap-2">
              {VOICE_OPTIONS.map((v) => {
                const active = (cfg.voiceName ?? 'Fenrir') === v.value
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setConfig('voiceName', v.value)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: active ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)',
                      background:  active ? 'oklch(55% 0.11 193 / 0.08)' : 'var(--surface-raised)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: active ? 'oklch(45% 0.11 193)' : 'var(--text-primary)' }}>
                        {v.label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{v.style}</span>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: v.gender === 'Female' ? 'oklch(75% 0.08 340 / 0.15)' : v.gender === 'Male' ? 'oklch(60% 0.12 240 / 0.15)' : 'oklch(65% 0.05 180 / 0.15)',
                        color:      v.gender === 'Female' ? 'oklch(45% 0.1 340)' : v.gender === 'Male' ? 'oklch(40% 0.12 240)' : 'oklch(40% 0.07 180)',
                      }}
                    >
                      {v.gender}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Agent speaks first */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Agent speaks first</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Agent delivers the opening greeting immediately when the session starts, without waiting for the caller to speak.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.agentSpeaksFirst !== false}
              onClick={() => setConfig('agentSpeaksFirst', !(cfg.agentSpeaksFirst !== false))}
              className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ml-4"
              style={{ background: cfg.agentSpeaksFirst !== false ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)' }}
            >
              <span
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: cfg.agentSpeaksFirst !== false ? '22px' : '2px' }}
              />
            </button>
          </div>

          {/* Greeting mode */}
          <div>
            <label className={lbl}>Greeting mode</label>
            <input value={selected.greetingMode ?? ''} onChange={(e) => setSelected({ ...selected, greetingMode: e.target.value || null })}
              className={inp} placeholder="e.g. friendly, formal, professional" />
            <p className="mt-1 text-xs text-gray-400">Sets the tone of the agent's opening message</p>
          </div>

          {/* Escalation mode + transfer number */}
          <div>
            <label className={lbl}>Escalation mode</label>
            <input value={selected.escalationMode ?? ''} onChange={(e) => setSelected({ ...selected, escalationMode: e.target.value || null })}
              className={inp} placeholder="e.g. escalate-to-human" />
          </div>

          <div>
            <label className={lbl}>Transfer / escalation number</label>
            <ContactPicker
              value={cfg.transferNumber ?? ''}
              onChange={(v) => setConfig('transferNumber', v || undefined)}
            />
            <p className="mt-1 text-xs text-gray-400">The agent dials this number when escalating to a human</p>
          </div>

          {/* Inbound-specific fields */}
          {selected.channelType === 'INBOUND' && (
            <>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">After-hours</h3>

                <div>
                  <label className={lbl}>After-hours behaviour</label>
                  <select value={selected.afterHoursMode ?? ''}
                    onChange={(e) => setSelected({ ...selected, afterHoursMode: e.target.value || null })}
                    className={inp}>
                    {AFTER_HOURS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {selected.afterHoursMode === 'forward' && (
                  <div>
                    <label className={lbl}>Forward calls to</label>
                    <ContactPicker
                      value={cfg.forwardingNumber ?? ''}
                      onChange={(v) => setConfig('forwardingNumber', v || undefined)}
                    />
                    <p className="mt-1 text-xs text-gray-400">Calls outside business hours are forwarded here</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Business hours</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Calls outside these hours trigger the after-hours behaviour above</p>
                <BusinessHoursEditor
                  hours={cfg.businessHours ?? DEFAULT_HOURS}
                  onChange={(h) => setConfig('businessHours', h)} />
              </div>
            </>
          )}

          {selected.promptVersion && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Bound prompt: {selected.promptVersion.name}</p>
          )}

          <button onClick={saveChannel} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save channel'}
          </button>

          {selected.channelType === 'INBOUND' && (
            <PhoneNumbersPanel numbers={phoneNumbers ?? []} />
          )}
          </div>
        </>
      )}
    </div>
  )
}
