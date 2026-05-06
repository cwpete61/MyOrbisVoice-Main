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
  value:    string                    // current enum code (e.g. "DENTAL")
  onChange: (code: string) => void
  locale:   'en' | 'es'
  placeholder?: string
  disabled?: boolean
}

function labelFor(ind: Industry, locale: 'en' | 'es'): string {
  return locale === 'es' ? ind.labelEs : ind.labelEn
}

function matchesQuery(ind: Industry, locale: 'en' | 'es', q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [
    ind.labelEn.toLowerCase(),
    ind.labelEs.toLowerCase(),
    ind.code.toLowerCase().replace(/_/g, ' '),
    (ind.searchTerms ?? '').toLowerCase(),
  ].join(' ')
  return haystack.includes(needle)
}

export function IndustryAutocomplete({ value, onChange, locale, placeholder, disabled }: Props) {
  const selected = findIndustry(value)
  // Search field starts empty regardless of saved value. The saved
  // industry is shown as a small "Currently: …" indicator below the
  // input so the user always knows what's stored.
  const [query, setQuery]   = useState<string>('')
  const [open, setOpen]     = useState(false)
  const [activeIdx, setIdx] = useState(0)
  const wrapRef             = useRef<HTMLDivElement>(null)
  const listRef             = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click; clear any partial query so the
  // field returns to empty.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) {
        setQuery('')
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (q === '') return INDUSTRIES
    return INDUSTRIES.filter(i => matchesQuery(i, locale, q))
  }, [query, locale])

  // Keep activeIdx in bounds when filter changes.
  useEffect(() => {
    if (activeIdx >= filtered.length) setIdx(0)
  }, [filtered, activeIdx])

  function pick(ind: Industry) {
    onChange(ind.code)
    setQuery('')
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      e.preventDefault()
      return
    }
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
      setOpen(false)
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
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setIdx(0) }}
        onFocus={() => setOpen(true)}
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
          user knows what's stored even when the search field is empty. */}
      {!open && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {locale === 'es' ? 'Actualmente: ' : 'Currently: '}
          <strong style={{ color: 'var(--text-secondary)' }}>{labelFor(selected, locale)}</strong>
        </p>
      )}
    </div>
  )
}
