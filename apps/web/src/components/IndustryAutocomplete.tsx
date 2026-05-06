'use client'

/**
 * IndustryAutocomplete — type-to-search combobox for the IndustryVertical
 * field. Replaces the previous static <select>. Backed by INDUSTRIES from
 * lib/industries.ts; filters on label + searchTerms; arrow keys + Enter
 * to pick; Esc to close. Always saves a valid enum code.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { INDUSTRIES, findIndustry, type Industry } from '@/lib/industries'

interface Props {
  /** If `byLabel` is false (default): treated as the enum code (e.g. "DENTAL").
   *  If `byLabel` is true: treated as the human label (e.g. "Dental offices")
   *  and onChange fires with the label too — used by free-form fields like
   *  Business DNA → Identity → Industry that store the label, not the code. */
  value:    string
  onChange: (next: string) => void
  locale:   'en' | 'es'
  placeholder?: string
  disabled?: boolean
  byLabel?: boolean
}

/** Find an industry by matching its code, EN label, or ES label
 *  (case-insensitive). Returns undefined for genuinely custom strings. */
function findIndustryByAny(needle: string): Industry | undefined {
  if (!needle) return undefined
  const n = needle.toLowerCase().trim()
  return INDUSTRIES.find(i =>
    i.code.toLowerCase() === n ||
    i.labelEn.toLowerCase() === n ||
    i.labelEs.toLowerCase() === n,
  )
}

function labelFor(ind: Industry, locale: 'en' | 'es'): string {
  return locale === 'es' ? ind.labelEs : ind.labelEn
}

function matchesQuery(ind: Industry, locale: 'en' | 'es', q: string): boolean {
  if (!q) return true
  // Strict prefix match against the displayed label only — type "c" and
  // see only industries whose label starts with C, just like jumping to
  // a letter in an alphabetized list.
  const label = (locale === 'es' ? ind.labelEs : ind.labelEn).toLowerCase()
  return label.startsWith(q.toLowerCase())
}

export function IndustryAutocomplete({ value, onChange, locale, placeholder, disabled, byLabel }: Props) {
  // In byLabel mode the incoming value is a label (or legacy free-form text).
  // We try to resolve it to a known industry; if it doesn't match anything
  // we still surface the raw text in the "Currently: …" indicator so users
  // see what's saved.
  const selected: Industry | undefined = byLabel
    ? findIndustryByAny(value)
    : findIndustry(value)
  // Search field starts empty regardless of saved value. The saved
  // industry is shown as a small "Currently: …" indicator below the
  // input so the user always knows what's stored.
  const [query, setQuery]   = useState<string>('')
  const [activeIdx, setIdx] = useState(0)
  // The dropdown only appears once the user has typed something. No
  // browse-by-default — keeps the UI clean and forces type-to-search.
  const open = query.trim().length > 0
  const wrapRef             = useRef<HTMLDivElement>(null)
  const listRef             = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click; clear any partial query so the
  // field returns to empty.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) {
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (q === '') return [] as Industry[]   // never show a list while empty
    return INDUSTRIES.filter(i => matchesQuery(i, locale, q))
  }, [query, locale])

  // Keep activeIdx in bounds when filter changes.
  useEffect(() => {
    if (activeIdx >= filtered.length) setIdx(0)
  }, [filtered, activeIdx])

  function pick(ind: Industry) {
    onChange(byLabel ? labelFor(ind, locale) : ind.code)
    setQuery('')
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return  // arrow keys do nothing while the dropdown is closed
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx(i => Math.min(filtered.length - 1, i + 1))
      scrollActiveIntoView(activeIdx + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx(i => Math.max(0, i - 1))
      scrollActiveIntoView(activeIdx - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const choice = filtered[activeIdx]
      if (choice) pick(choice)
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  function scrollActiveIntoView(idx: number) {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIdx(0) }}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        className="input"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full rounded-lg shadow-lg overflow-y-auto"
          style={{
            background: 'var(--surface-raised)',
            border:     '1px solid var(--border-subtle)',
            maxHeight:  '18rem',
          }}
        >
          {filtered.map((ind, i) => {
            const isActive = i === activeIdx
            const isSelected = ind.code === value
            return (
              <button
                key={ind.code}
                data-idx={i}
                role="option"
                aria-selected={isSelected}
                type="button"
                onMouseEnter={() => setIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(ind) }}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{
                  background: isActive ? 'var(--surface-overlay)' : 'transparent',
                  color:      'var(--text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {labelFor(ind, locale)}
              </button>
            )
          })}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div
          className="absolute z-30 mt-1 w-full rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'var(--surface-raised)',
            border:     '1px solid var(--border-subtle)',
            color:      'var(--text-tertiary)',
          }}
        >
          No matches. Try a broader term.
        </div>
      )}
      {/* Always show the currently saved industry below the input so the
          user knows what's stored even when the search field is empty.
          If byLabel mode resolved to a known industry, show its localized
          label; if it didn't resolve (custom legacy text), show the raw
          value verbatim so we never erase what the user typed before. */}
      {!open && (value || selected) && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {locale === 'es' ? 'Actualmente: ' : 'Currently: '}
          <strong style={{ color: 'var(--text-secondary)' }}>
            {selected ? labelFor(selected, locale) : value}
          </strong>
        </p>
      )}
    </div>
  )
}
