'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'
import { Tooltip } from '@/components/Tooltip'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { BackToOnboarding } from '@/components/BackToOnboarding'

type TFn = (key: string, vars?: Record<string, string | number>) => string

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

// Voice option `value` and `gender` are stable codes used by the agent runtime
// (passed to Gemini's prebuilt_voice_config) and the genderTag color map below.
// `label` is always the proper noun voice name (untranslated). Style + gender
// labels shown to the user are looked up via t() against the value.
const VOICE_OPTIONS: { value: string; label: string; gender: 'Female' | 'Male' | 'Neutral' }[] = [
  { value: 'Zephyr',  label: 'Zephyr',  gender: 'Female'  },
  { value: 'Despina', label: 'Despina', gender: 'Female'  },
  { value: 'Aoede',   label: 'Aoede',   gender: 'Female'  },
  { value: 'Charon',  label: 'Charon',  gender: 'Male'    },
  { value: 'Fenrir',  label: 'Fenrir',  gender: 'Male'    },
  { value: 'Puck',    label: 'Puck',    gender: 'Male'    },
  { value: 'Sulafat', label: 'Sulafat', gender: 'Neutral' },
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

const CHANNEL_KEYS: Record<string, { labelKey: string; descKey: string }> = {
  WIDGET:   { labelKey: 'tenantChannels.channels.widget.label',   descKey: 'tenantChannels.channels.widget.description'   },
  INBOUND:  { labelKey: 'tenantChannels.channels.inbound.label',  descKey: 'tenantChannels.channels.inbound.description'  },
  OUTBOUND: { labelKey: 'tenantChannels.channels.outbound.label', descKey: 'tenantChannels.channels.outbound.description' },
}

const AFTER_HOURS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: '',          labelKey: 'tenantChannels.afterHoursOptions.default'   },
  { value: 'voicemail', labelKey: 'tenantChannels.afterHoursOptions.voicemail' },
  { value: 'forward',   labelKey: 'tenantChannels.afterHoursOptions.forward'   },
]

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']

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

function ContactPicker({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: TFn }) {
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
  const noNamePlaceholder = t('tenantChannels.contactPicker.noContactName')

  return (
    <div ref={ref} className="relative">
      <BackToOnboarding />
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { handleInput(e.target.value); setOpen(true) }}
        className={inp}
        placeholder={t('tenantChannels.contactPicker.placeholder')}
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
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.fullName ?? noNamePlaceholder}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.phoneE164}</span>
              </button>
            ))}
            {/* Full list when not filtering */}
            {suggestions.length === 0 && contacts.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onChange(c.phoneE164!); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ background: c.phoneE164 === value ? 'var(--surface-overlay)' : undefined }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.fullName ?? noNamePlaceholder}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.phoneE164}</span>
              </button>
            ))}
            {contacts.length === 0 && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantChannels.contactPicker.emptyContacts')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneNumbersPanel({ numbers, t }: { numbers: PhoneNumber[]; t: TFn }) {
  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('tenantChannels.phoneNumbers.title')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('tenantChannels.phoneNumbers.subtitle')}</p>
        </div>
        <Link href="/phone-numbers"
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
          {t('tenantChannels.phoneNumbers.manageLink')}
        </Link>
      </div>

      {numbers.length === 0
        ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">
            {t('tenantChannels.phoneNumbers.emptyPrefix')}{' '}
            <Link href="/phone-numbers" className="text-blue-600 hover:underline">{t('tenantChannels.phoneNumbers.emptyLink')}</Link>
            {t('tenantChannels.phoneNumbers.emptySuffix')}
          </p>
        )
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

function BusinessHoursEditor({ hours, onChange, t }: { hours: BusinessHours; onChange: (h: BusinessHours) => void; t: TFn }) {
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const entry = hours[day] ?? DEFAULT_HOURS[day]!
        return (
          <div key={day} className="flex items-center gap-3">
            <div className="w-8 text-xs font-medium text-gray-500 dark:text-gray-400">{t(`tenantChannels.days.${day}`)}</div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!entry.closed}
                onChange={(e) => onChange({ ...hours, [day]: { ...entry, closed: !e.target.checked } })}
                className="rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{t('tenantChannels.businessHours.open')}</span>
            </label>
            {!entry.closed && (
              <>
                <input type="time" value={entry.open}
                  onChange={(e) => onChange({ ...hours, [day]: { ...entry, open: e.target.value } })}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="text-xs text-gray-400">{t('tenantChannels.businessHours.to')}</span>
                <input type="time" value={entry.close}
                  onChange={(e) => onChange({ ...hours, [day]: { ...entry, close: e.target.value } })}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </>
            )}
            {entry.closed && <span className="text-xs text-gray-400 italic">{t('tenantChannels.businessHours.closed')}</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function ChannelsPage() {
  const t = useT()
  const { locale } = useLocale()
  // Reserved for future date/time formatting on this page; kept for parity with
  // the dashboard reference pattern.
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  void dateLocale

  const { data: channels, loading, error, reload } = useApi<Channel[]>('/api/channels')
  const { data: phoneNumbers } = useApi<PhoneNumber[]>('/api/phone-numbers')
  const { data: entitlements } = useApi<Record<string, boolean | number | string | null>>('/api/entitlements')
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
      setMessage(t('tenantChannels.savedMessage'))
    } catch (err) { setMessage(err instanceof Error ? err.message : t('tenantChannels.saveFailed')) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">{t('tenantChannels.loading')}</div>
  if (error)   return <div className="p-8 text-sm text-red-500">{error}</div>

  const cfg = selected ? getConfig(selected) : {}

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('tenantChannels.title')}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('tenantChannels.subtitle')}</p>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(channels ?? []).map((c) => {
          const keys = CHANNEL_KEYS[c.channelType]
          // A channel is "locked" when the tenant's plan doesn't include it.
          // Entitlement keys: widget_enabled, inbound_enabled, outbound_enabled.
          // Default to true while entitlements are still loading so we don't
          // flash a locked card during initial render.
          const entKey =
            c.channelType === 'WIDGET'   ? 'widget_enabled'   :
            c.channelType === 'INBOUND'  ? 'inbound_enabled'  :
            c.channelType === 'OUTBOUND' ? 'outbound_enabled' : null
          const allowed = entitlements && entKey
            ? entitlements[entKey] !== false
            : true
          if (!allowed) {
            return (
              <div key={c.id}
                className="text-left p-5 rounded-xl border opacity-70"
                style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{keys ? t(keys.labelKey) : c.channelType}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'oklch(60% 0.16 75 / 0.15)', color: 'oklch(45% 0.16 75)' }}>
                    {t('tenantChannels.lockedBadge')}
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{keys ? t(keys.descKey) : ''}</p>
                <Link href="/billing" className="text-xs font-semibold underline" style={{ color: 'oklch(55% 0.11 193)' }}>
                  {t('tenantChannels.upgradeToUnlock')}
                </Link>
              </div>
            )
          }
          return (
            <button key={c.id} onClick={() => { setSelected(prev => prev?.id === c.id ? null : c); setMessage('') }}
              className={`text-left p-5 rounded-xl border transition-all ${selected?.id === c.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{keys ? t(keys.labelKey) : c.channelType}</span>
                <span className={`w-2 h-2 rounded-full ${c.isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{keys ? t(keys.descKey) : ''}</p>
            </button>
          )
        })}
      </div>

      {selected && (
        <>
          {/* Backdrop — click outside panel to close */}
          <div className="fixed inset-0 z-10" onClick={() => setSelected(null)} />

          <div className="relative z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-w-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{CHANNEL_KEYS[selected.channelType] ? t(CHANNEL_KEYS[selected.channelType]!.labelKey) : selected.channelType}</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={selected.isEnabled}
                  onChange={(e) => setSelected({ ...selected, isEnabled: e.target.checked })} className="rounded" />
                {t('tenantChannels.enabledLabel')}
              </label>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label={t('tenantChannels.closeLabel')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          </div>

          {/* Voice selection */}
          <div>
            <label className={lbl + ' flex items-center'}>
              <Tooltip content={t('tenantChannels.voicePicker.tooltip')}>{t('tenantChannels.voicePicker.label')}</Tooltip>
            </label>
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
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t(`tenantChannels.voicePicker.style.${v.value}`)}</span>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: v.gender === 'Female' ? 'oklch(75% 0.08 340 / 0.15)' : v.gender === 'Male' ? 'oklch(60% 0.12 240 / 0.15)' : 'oklch(65% 0.05 180 / 0.15)',
                        color:      v.gender === 'Female' ? 'oklch(45% 0.1 340)' : v.gender === 'Male' ? 'oklch(40% 0.12 240)' : 'oklch(40% 0.07 180)',
                      }}
                    >
                      {t(`tenantChannels.voicePicker.gender.${v.gender}`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Agent speaks first */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('tenantChannels.agentSpeaksFirst.label')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantChannels.agentSpeaksFirst.description')}</p>
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
            <label className={lbl + ' flex items-center'}>
              <Tooltip content={t('tenantChannels.greetingMode.tooltip')}>{t('tenantChannels.greetingMode.label')}</Tooltip>
            </label>
            <input value={selected.greetingMode ?? ''} onChange={(e) => setSelected({ ...selected, greetingMode: e.target.value || null })}
              className={inp} placeholder={t('tenantChannels.greetingMode.placeholder')} />
            <p className="mt-1 text-xs text-gray-400">{t('tenantChannels.greetingMode.help')}</p>
          </div>

          {/* Escalation mode + transfer number */}
          <div>
            <label className={lbl + ' flex items-center'}>
              <Tooltip content={t('tenantChannels.escalation.modeTooltip')}>{t('tenantChannels.escalation.modeLabel')}</Tooltip>
            </label>
            <input value={selected.escalationMode ?? ''} onChange={(e) => setSelected({ ...selected, escalationMode: e.target.value || null })}
              className={inp} placeholder={t('tenantChannels.escalation.modePlaceholder')} />
          </div>

          <div>
            <label className={lbl + ' flex items-center'}>
              <Tooltip content={t('tenantChannels.escalation.transferTooltip')}>{t('tenantChannels.escalation.transferLabel')}</Tooltip>
            </label>
            <ContactPicker
              value={cfg.transferNumber ?? ''}
              onChange={(v) => setConfig('transferNumber', v || undefined)}
              t={t}
            />
            <p className="mt-1 text-xs text-gray-400">{t('tenantChannels.escalation.transferHelp')}</p>
          </div>

          {/* Inbound-specific fields */}
          {selected.channelType === 'INBOUND' && (
            <>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('tenantChannels.afterHours.title')}</h3>

                <div>
                  <label className={lbl + ' flex items-center'}>
                    <Tooltip content={t('tenantChannels.afterHours.behaviourTooltip')}>{t('tenantChannels.afterHours.behaviourLabel')}</Tooltip>
                  </label>
                  <select value={selected.afterHoursMode ?? ''}
                    onChange={(e) => setSelected({ ...selected, afterHoursMode: e.target.value || null })}
                    className={inp}>
                    {AFTER_HOURS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                    ))}
                  </select>
                </div>

                {selected.afterHoursMode === 'forward' && (
                  <div>
                    <label className={lbl + ' flex items-center'}>
                      <Tooltip content={t('tenantChannels.afterHours.forwardTooltip')}>{t('tenantChannels.afterHours.forwardLabel')}</Tooltip>
                    </label>
                    <ContactPicker
                      value={cfg.forwardingNumber ?? ''}
                      onChange={(v) => setConfig('forwardingNumber', v || undefined)}
                      t={t}
                    />
                    <p className="mt-1 text-xs text-gray-400">{t('tenantChannels.afterHours.forwardHelp')}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('tenantChannels.businessHours.title')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('tenantChannels.businessHours.description')}</p>
                <BusinessHoursEditor
                  hours={cfg.businessHours ?? DEFAULT_HOURS}
                  onChange={(h) => setConfig('businessHours', h)}
                  t={t} />
              </div>
            </>
          )}

          {selected.promptVersion && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('tenantChannels.boundPrompt', { name: selected.promptVersion.name })}</p>
          )}

          <button onClick={saveChannel} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('tenantChannels.actions.saving') : t('tenantChannels.actions.save')}
          </button>

          {selected.channelType === 'INBOUND' && (
            <PhoneNumbersPanel numbers={phoneNumbers ?? []} t={t} />
          )}
          </div>
        </>
      )}
    </div>
  )
}
