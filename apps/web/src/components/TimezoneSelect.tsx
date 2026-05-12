'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'
import { getBrowserTimezone } from '@/lib/timezone'

/**
 * A dropdown of IANA time zones. Common US + Latin-American zones are pinned
 * at the top under an "Often used" optgroup; everything else from
 * Intl.supportedValuesOf('timeZone') lands in "All zones".
 *
 * `value === null` means "auto detect from browser". The first option's label
 * surfaces the detected zone so users know what auto resolves to.
 */
export function TimezoneSelect({
  value,
  onChange,
}: {
  value:    string | null
  onChange: (next: string | null) => void
}) {
  const t = useT()
  const browserTz = getBrowserTimezone()

  const allZones = useMemo<string[]>(() => {
    // Intl.supportedValuesOf is widely supported in modern browsers (Chrome 99+,
    // Safari 15.4+, Firefox 93+). Fall back to the curated list if missing.
    try {
      const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
      if (typeof fn === 'function') return fn.call(Intl, 'timeZone')
    } catch { /* fall through */ }
    return [...COMMON_ZONES]
  }, [])

  const otherZones = useMemo(() => allZones.filter(z => !COMMON_ZONES.includes(z)), [allZones])

  return (
    <select
      value={value ?? '__AUTO__'}
      onChange={e => {
        const v = e.target.value
        onChange(v === '__AUTO__' ? null : v)
      }}
      className="input"
    >
      <option value="__AUTO__">
        {t('timezone.autoDetect').replace('{tz}', browserTz)}
      </option>
      <optgroup label={t('timezone.commonGroup')}>
        {COMMON_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
      </optgroup>
      <optgroup label={t('timezone.allGroup')}>
        {otherZones.map(z => <option key={z} value={z}>{z}</option>)}
      </optgroup>
    </select>
  )
}

const COMMON_ZONES: string[] = [
  // US
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  // Latin America
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  // Europe
  'Europe/London',
  'Europe/Madrid',
  // Other
  'UTC',
]
