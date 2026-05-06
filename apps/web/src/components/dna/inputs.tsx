'use client'

/**
 * Reusable form primitives for the Business DNA editor.
 *
 * These wrap the existing `.input` / `.label` Tailwind component classes used
 * across the dashboard so the DNA editor matches every other form in the app.
 * No external form library — `useState` in the parent is sufficient at this
 * volume.
 */

import type { ReactNode } from 'react'

/* ─────────────────────────────────────────────────────────────────────────
 * Shared label + description helper
 * ──────────────────────────────────────────────────────────────────────── */

function FieldLabel({
  label,
  description,
  htmlFor,
  trailing,
}: {
  label: string
  description?: string
  htmlFor?: string
  trailing?: ReactNode
}) {
  return (
    <div className="mb-1 flex items-end justify-between gap-3">
      <div>
        <label htmlFor={htmlFor} className="label" style={{ marginBottom: 0 }}>{label}</label>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * TextField
 * ──────────────────────────────────────────────────────────────────────── */

export function TextField({
  label,
  value,
  onChange,
  description,
  placeholder,
  type = 'text',
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  description?: string
  placeholder?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * TextArea
 * ──────────────────────────────────────────────────────────────────────── */

export function TextArea({
  label,
  value,
  onChange,
  description,
  rows = 3,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  description?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input resize-y"
        style={{ minHeight: `${rows * 1.5 + 1}rem` }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Select
 * ──────────────────────────────────────────────────────────────────────── */

export function Select({
  label,
  value,
  options,
  onChange,
  description,
  disabled,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string; hint?: string }>
  onChange: (v: string) => void
  description?: string
  disabled?: boolean
}) {
  const active = options.find((o) => o.value === value)
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {active?.hint && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{active.hint}</p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * NumberField
 * ──────────────────────────────────────────────────────────────────────── */

export function NumberField({
  label,
  value,
  onChange,
  description,
  unit,
  min,
  disabled,
}: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
  description?: string
  unit?: string
  min?: number
  disabled?: boolean
}) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) ? n : 0)
          }}
          disabled={disabled}
          className="input"
          style={{ maxWidth: '12rem' }}
        />
        {unit && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * StringList — array of strings, one per row, with add/remove
 * ──────────────────────────────────────────────────────────────────────── */

export function StringList({
  label,
  values,
  onChange,
  description,
  placeholder,
  emptyText,
  disabled,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  description?: string
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}) {
  function update(idx: number, val: string) {
    const next = values.slice()
    next[idx] = val
    onChange(next)
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([...values, ''])
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      {values.length === 0 ? (
        <div
          className="text-xs px-3 py-3 rounded-lg mb-2"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)', border: '1px dashed var(--border-subtle)' }}
        >
          {emptyText ?? 'No items yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {values.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={v}
                placeholder={placeholder}
                onChange={(e) => update(idx, e.target.value)}
                disabled={disabled}
                className="input"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0"
                style={{
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                }}
                aria-label={`Remove item ${idx + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="mt-2 text-xs px-3 py-1.5 rounded-lg"
        style={{
          color: 'var(--text-secondary)',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        + Add {label.toLowerCase()}
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * ObjectList — array of objects with a small schema, rendered as cards
 *
 * Each schema entry tells us how to render a sub-field. Keeps it generic
 * without bringing in a form library.
 * ──────────────────────────────────────────────────────────────────────── */

export type ObjectFieldSchema =
  | { key: string; label: string; type: 'text';     placeholder?: string; description?: string }
  | { key: string; label: string; type: 'textarea'; placeholder?: string; description?: string; rows?: number }
  | { key: string; label: string; type: 'number';   unit?: string; description?: string }
  | { key: string; label: string; type: 'strings';  placeholder?: string; description?: string; emptyText?: string }

type ObjectListItem = Record<string, unknown>

export function ObjectList({
  label,
  values,
  schema,
  onChange,
  description,
  itemLabel,
  emptyText,
  disabled,
}: {
  label: string
  values: ObjectListItem[]
  schema: ObjectFieldSchema[]
  onChange: (next: ObjectListItem[]) => void
  description?: string
  itemLabel?: (item: ObjectListItem, idx: number) => string
  emptyText?: string
  disabled?: boolean
}) {
  function update(idx: number, key: string, val: unknown) {
    const next = values.slice()
    next[idx] = { ...next[idx], [key]: val }
    onChange(next)
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }
  function add() {
    const blank: ObjectListItem = {}
    for (const f of schema) {
      if (f.type === 'number') blank[f.key] = 0
      else if (f.type === 'strings') blank[f.key] = []
      else blank[f.key] = ''
    }
    onChange([...values, blank])
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      {values.length === 0 ? (
        <div
          className="text-xs px-3 py-3 rounded-lg mb-2"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)', border: '1px dashed var(--border-subtle)' }}
        >
          {emptyText ?? `No ${label.toLowerCase()} yet.`}
        </div>
      ) : (
        <div className="space-y-3">
          {values.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 space-y-3"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  {itemLabel ? itemLabel(item, idx) : `Item ${idx + 1}`}
                </p>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                  }}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {schema.map((f) => {
                  const raw = item[f.key]
                  if (f.type === 'number') {
                    return (
                      <NumberField
                        key={f.key}
                        label={f.label}
                        value={typeof raw === 'number' ? raw : 0}
                        unit={f.unit}
                        description={f.description}
                        onChange={(v) => update(idx, f.key, v)}
                        disabled={disabled}
                      />
                    )
                  }
                  if (f.type === 'textarea') {
                    return (
                      <TextArea
                        key={f.key}
                        label={f.label}
                        value={typeof raw === 'string' ? raw : ''}
                        rows={f.rows ?? 3}
                        placeholder={f.placeholder}
                        description={f.description}
                        onChange={(v) => update(idx, f.key, v)}
                        disabled={disabled}
                      />
                    )
                  }
                  if (f.type === 'strings') {
                    return (
                      <StringList
                        key={f.key}
                        label={f.label}
                        values={Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : String(x))) : []}
                        onChange={(v) => update(idx, f.key, v)}
                        description={f.description}
                        placeholder={f.placeholder}
                        emptyText={f.emptyText}
                        disabled={disabled}
                      />
                    )
                  }
                  return (
                    <TextField
                      key={f.key}
                      label={f.label}
                      value={typeof raw === 'string' ? raw : ''}
                      placeholder={f.placeholder}
                      description={f.description}
                      onChange={(v) => update(idx, f.key, v)}
                      disabled={disabled}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="mt-3 text-xs px-3 py-1.5 rounded-lg"
        style={{
          color: 'var(--text-secondary)',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        + Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * HoursGrid — 7-row grid for businessHours, each row is one weekday
 *
 * Stored shape: `{ monday: "09:00-18:00", tuesday: "closed", ... }` per the
 * canonical seeded data. We accept a few legacy shapes too:
 *   - `"09:00-17:00"` (string)
 *   - `{ open: "09:00", close: "17:00", closed: false }` (object)
 *   - `"closed"` or empty string
 * On output we always write the canonical string form.
 * ──────────────────────────────────────────────────────────────────────── */

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_LABELS: Record<typeof DAY_KEYS[number], string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

interface DayHours { closed: boolean; open: string; close: string }

function parseDayHours(raw: unknown): DayHours {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    return {
      closed: r['closed'] === true,
      open:   typeof r['open']  === 'string' ? r['open']  : '09:00',
      close:  typeof r['close'] === 'string' ? r['close'] : '17:00',
    }
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed || trimmed === 'closed') return { closed: true, open: '09:00', close: '17:00' }
    const m = trimmed.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (m) return { closed: false, open: m[1]!, close: m[2]! }
  }
  return { closed: true, open: '09:00', close: '17:00' }
}

function serializeDayHours(d: DayHours): string {
  if (d.closed) return 'closed'
  return `${d.open}-${d.close}`
}

export function HoursGrid({
  value,
  onChange,
  description,
  disabled,
}: {
  value: Record<string, unknown>
  onChange: (next: Record<string, string>) => void
  description?: string
  disabled?: boolean
}) {
  function update(day: typeof DAY_KEYS[number], next: DayHours) {
    const out: Record<string, string> = {}
    for (const k of DAY_KEYS) {
      const cur = k === day ? next : parseDayHours(value[k])
      out[k] = serializeDayHours(cur)
    }
    onChange(out)
  }

  return (
    <div>
      <FieldLabel label="Business hours" description={description} />
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
      >
        {DAY_KEYS.map((day, i) => {
          const d = parseDayHours(value[day])
          return (
            <div
              key={day}
              className="flex items-center gap-3 px-3 py-2"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}
            >
              <span className="text-xs font-medium w-10 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {DAY_LABELS[day]}
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => update(day, { ...d, closed: e.target.checked })}
                  disabled={disabled}
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Closed</span>
              </label>
              <input
                type="time"
                value={d.open}
                onChange={(e) => update(day, { ...d, open: e.target.value })}
                disabled={disabled || d.closed}
                className="input"
                style={{ maxWidth: '7rem', opacity: d.closed ? 0.45 : 1 }}
              />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
              <input
                type="time"
                value={d.close}
                onChange={(e) => update(day, { ...d, close: e.target.value })}
                disabled={disabled || d.closed}
                className="input"
                style={{ maxWidth: '7rem', opacity: d.closed ? 0.45 : 1 }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * KeyValueMap — `{ [key: string]: string }` rendered as a list of
 * (key, longText) pairs with add/remove. Used for objection-handling type
 * data where each key is short and each value is a paragraph.
 * ──────────────────────────────────────────────────────────────────────── */

export function KeyValueMap({
  label,
  value,
  onChange,
  description,
  keyLabel = 'Key',
  valueLabel = 'Response',
  keyPlaceholder,
  valuePlaceholder,
  emptyText,
  disabled,
}: {
  label: string
  value: Record<string, unknown>
  onChange: (next: Record<string, string>) => void
  description?: string
  keyLabel?: string
  valueLabel?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
  emptyText?: string
  disabled?: boolean
}) {
  // Normalize incoming map to ordered [key, value] pairs to keep UX stable.
  const entries = Object.entries(value ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as [string, string])

  function emit(next: Array<[string, string]>) {
    const out: Record<string, string> = {}
    for (const [k, v] of next) {
      const trimmed = k.trim()
      if (!trimmed) continue
      out[trimmed] = v
    }
    // Preserve duplicate-key behaviour: last one wins, which matches Object.fromEntries.
    onChange(out)
  }

  function updateKey(idx: number, newKey: string) {
    const next = entries.slice()
    next[idx] = [newKey, next[idx]?.[1] ?? '']
    emit(next)
  }
  function updateVal(idx: number, newVal: string) {
    const next = entries.slice()
    next[idx] = [next[idx]?.[0] ?? '', newVal]
    emit(next)
  }
  function remove(idx: number) {
    emit(entries.filter((_, i) => i !== idx))
  }
  function add() {
    emit([...entries, ['', '']])
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      {entries.length === 0 ? (
        <div
          className="text-xs px-3 py-3 rounded-lg mb-2"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)', border: '1px dashed var(--border-subtle)' }}
        >
          {emptyText ?? 'No entries yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([k, v], idx) => (
            <div
              key={idx}
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={k}
                  placeholder={keyPlaceholder ?? keyLabel}
                  onChange={(e) => updateKey(idx, e.target.value)}
                  disabled={disabled}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0"
                  style={{
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                  }}
                >
                  Remove
                </button>
              </div>
              <textarea
                value={v}
                rows={3}
                placeholder={valuePlaceholder ?? valueLabel}
                onChange={(e) => updateVal(idx, e.target.value)}
                disabled={disabled}
                className="input resize-y"
                style={{ minHeight: '4.5rem' }}
              />
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="mt-2 text-xs px-3 py-1.5 rounded-lg"
        style={{
          color: 'var(--text-secondary)',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        + Add entry
      </button>
    </div>
  )
}

