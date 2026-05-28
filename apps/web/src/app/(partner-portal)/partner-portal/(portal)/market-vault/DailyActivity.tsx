'use client'

/**
 * Daily Activity tab (lives inside Market Vault).
 *
 * Sections from the API tree have:
 *   - tier (CRITICAL / HIGH / STANDARD / OPTIONAL) → border + badge color
 *   - subsections with items (checkboxes)
 *
 * Ticking writes through to the API immediately. Checked items get
 * strikethrough + a "done HH:MM AM/PM" badge at end of line. Unticking
 * reverts.
 */

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

interface ActivityItem {
  key: string
  label: string
  hint?: string
  completedAt: string | null
}
interface Subsection {
  key: string
  label: string
  durationMin?: number
  items: ActivityItem[]
}
interface Section {
  key: string
  label: string
  tier: 'CRITICAL' | 'HIGH' | 'STANDARD' | 'OPTIONAL'
  durationMin: number
  rationale: string
  subsections: Subsection[]
  completed: number
  total: number
}
interface Tree {
  dayKey: string
  sections: Section[]
  completed: number
  total: number
}

const TIER_COLORS: Record<Section['tier'], { bg: string; fg: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.15)',  fg: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  HIGH:     { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  STANDARD: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', border: 'rgba(16,185,129,0.25)' },
  OPTIONAL: { bg: 'rgba(14,165,233,0.15)', fg: '#0ea5e9', border: 'rgba(14,165,233,0.25)' },
}

const TIER_LABEL: Record<Section['tier'], string> = {
  CRITICAL: 'Critical',
  HIGH:     'High',
  STANDARD: 'Standard',
  OPTIONAL: 'Optional',
}

export default function DailyActivity() {
  const [tree, setTree] = useState<Tree | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
    // Detect midnight roll-over while the tab is open — re-fetch when the
    // local day changes. Polling once a minute is cheap + low-friction.
    const stamp = todayLocalKey()
    const t = setInterval(() => {
      if (todayLocalKey() !== stamp) void load()
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    try {
      const res = await apiFetch<Tree>('/api/partner/daily-activity')
      setTree(res)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  async function toggle(item: ActivityItem) {
    if (!tree) return
    const isChecked = !!item.completedAt
    // Optimistic update
    const optimistic: Tree = {
      ...tree,
      sections: tree.sections.map((s) => ({
        ...s,
        subsections: s.subsections.map((sub) => ({
          ...sub,
          items: sub.items.map((i) =>
            i.key === item.key
              ? { ...i, completedAt: isChecked ? null : new Date().toISOString() }
              : i,
          ),
        })),
      })),
    }
    optimistic.completed = countCompleted(optimistic)
    optimistic.sections = optimistic.sections.map(recountSection)
    setTree(optimistic)
    try {
      if (isChecked) {
        await apiFetch(`/api/partner/daily-activity/${encodeURIComponent(item.key)}/check`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/partner/daily-activity/${encodeURIComponent(item.key)}/check`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
      }
      // Refresh from server to lock in canonical completedAt.
      await load()
    } catch (err) {
      // Roll back optimistic update on failure.
      setError(err instanceof Error ? err.message : 'Save failed')
      void load()
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
  }
  if (error) {
    return <p style={{ color: '#ef4444' }}>Error: {error}</p>
  }
  if (!tree) return null

  const overall = tree.total === 0 ? 0 : Math.round((tree.completed / tree.total) * 100)

  return (
    <div>
      {/* Day banner + overall progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Today · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {tree.completed} / {tree.total} activities done ({overall}%)
          </div>
        </div>
        <ProgressRing percent={overall} />
      </div>

      {/* Sections */}
      <div style={{ display: 'grid', gap: 14 }}>
        {tree.sections.map((s) => (
          <SectionCard key={s.key} section={s} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}

function SectionCard({ section, onToggle }: { section: Section; onToggle: (item: ActivityItem) => void }) {
  const colors = TIER_COLORS[section.tier]
  const pct = section.total === 0 ? 0 : Math.round((section.completed / section.total) * 100)
  return (
    <section
      style={{
        background: 'var(--surface-raised)',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{section.label}</h2>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: colors.bg,
              color: colors.fg,
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {TIER_LABEL[section.tier]} · ~{section.durationMin} min
          </span>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.fg }}>
          {section.completed} / {section.total} · {pct}%
        </span>
      </div>
      <p style={{ margin: 0, marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {section.rationale}
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        {section.subsections.map((sub) => (
          <div key={sub.key}>
            {section.subsections.length > 1 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {sub.label}
                {sub.durationMin && <span style={{ marginLeft: 8 }}>· ~{sub.durationMin} min</span>}
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              {sub.items.map((item) => (
                <li key={item.key}>
                  <ActivityRow item={item} onToggle={onToggle} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActivityRow({ item, onToggle }: { item: ActivityItem; onToggle: (i: ActivityItem) => void }) {
  const done = !!item.completedAt
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 6px',
        borderRadius: 6,
        cursor: 'pointer',
        opacity: done ? 0.55 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(item)}
        style={{ marginTop: 2, accentColor: 'oklch(55% 0.11 193)', cursor: 'pointer' }}
      />
      <span style={{ flex: 1, fontSize: '0.92rem', color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
        {item.label}
        {item.hint && !done && (
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {item.hint}
          </span>
        )}
        {done && (
          <span style={{ marginLeft: 10, fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textDecoration: 'none' }}>
            · done {formatTime(item.completedAt!)}
          </span>
        )}
      </span>
    </label>
  )
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const dash = (percent / 100) * c
  return (
    <svg width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
      <circle
        cx="25"
        cy="25"
        r={r}
        fill="none"
        stroke="oklch(55% 0.11 193)"
        strokeWidth="4"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 25 25)"
      />
      <text x="25" y="29" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">
        {percent}%
      </text>
    </svg>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function countCompleted(tree: Tree): number {
  let n = 0
  for (const s of tree.sections) {
    for (const sub of s.subsections) for (const i of sub.items) if (i.completedAt) n++
  }
  return n
}

function recountSection(s: Section): Section {
  let completed = 0
  let total = 0
  for (const sub of s.subsections) {
    for (const i of sub.items) {
      total++
      if (i.completedAt) completed++
    }
  }
  return { ...s, completed, total }
}

function todayLocalKey(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
