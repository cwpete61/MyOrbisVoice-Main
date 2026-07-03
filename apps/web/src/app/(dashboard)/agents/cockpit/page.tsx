'use client'

/**
 * MyOrbisAgents — RE agent cockpit (Step 4). Mobile-first landing that reuses
 * the engine's existing data: Orby setup status (/onboarding/status), recent
 * leads (/conversations), upcoming showings (/appointments), plus quick actions
 * into onboarding, listings, calendar. No new backend — pure aggregation.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface OnbStep { key: string; label: string; href: string; completed: boolean; optional?: boolean; locked?: boolean }
interface OnbStatus { steps: OnbStep[]; completedCount: number; totalCount: number; allComplete: boolean }
interface Lead {
  id: string; direction: string; status: string; startedAt: string | null; summaryText: string | null
  contact: { firstName: string | null; lastName: string | null; phoneE164: string | null } | null
}
interface Showing { id: string; appointmentType: string | null; status: string; startAt: string; location: string | null }
interface PhoneSession { number: string; numberDisplay: string; pin: string; expiresAt: string; telHref: string }

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CockpitPage() {
  const t = useT()
  const [onb, setOnb] = useState<OnbStatus | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [showings, setShowings] = useState<Showing[]>([])
  const [phone, setPhone] = useState<PhoneSession | null>(null)

  useEffect(() => {
    apiFetch<OnbStatus>('/api/onboarding/status').then(setOnb).catch(() => {})
    apiFetch<{ items: Lead[] }>('/api/conversations?limit=6&sortBy=startedAt&sortDir=desc').then((d) => setLeads(d.items ?? [])).catch(() => {})
    const from = new Date().toISOString()
    apiFetch<Showing[]>(`/api/appointments?from=${encodeURIComponent(from)}&limit=6`).then((d) => setShowings(Array.isArray(d) ? d : [])).catch(() => {})
    // Demo phone session — a per-browser token keeps each demo tab's PIN stable.
    // Returns null for non-demo tenants, so the card just doesn't render.
    let ref = ''
    try {
      ref = localStorage.getItem('moa_demo_ref') || ''
      if (!ref) { ref = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('moa_demo_ref', ref) }
    } catch { /* private mode — fall back to a volatile ref */ }
    apiFetch<PhoneSession | null>(`/api/demo/phone-session?ref=${encodeURIComponent(ref || 'default')}`).then(setPhone).catch(() => {})
  }, [])

  const card = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' } as const
  const incomplete = onb?.steps.filter((s) => !s.completed && !s.locked && !s.optional) ?? []

  const contactName = (l: Lead) => {
    const n = [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(' ').trim()
    return n || l.contact?.phoneE164 || t('tenantAgentCockpit.unknownContact')
  }

  const quick = [
    { href: '/agents/onboarding', label: t('tenantAgentCockpit.qSetup') },
    { href: '/agents/listings', label: t('tenantAgentCockpit.qListings') },
    { href: '/integrations', label: t('tenantAgentCockpit.qCalendar') },
    { href: '/conversations', label: t('tenantAgentCockpit.qLeads') },
    { href: '/appointments', label: t('tenantAgentCockpit.qShowings') },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentCockpit.title')}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentCockpit.subtitle')}</p>

      {/* Orby status */}
      <div className="mt-6 rounded-xl p-4" style={card}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentCockpit.statusTitle')}</div>
            <div className="text-base font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {onb?.allComplete
                ? `✅ ${t('tenantAgentCockpit.statusReady')}`
                : t('tenantAgentCockpit.statusIncomplete').replace('{done}', String(onb?.completedCount ?? 0)).replace('{total}', String(onb?.totalCount ?? 0))}
            </div>
          </div>
          {!onb?.allComplete && <Link href="/onboarding" className="text-sm font-semibold px-3 py-2 rounded-lg text-white" style={{ background: 'var(--accent, #0d9488)' }}>{t('tenantAgentCockpit.fix')}</Link>}
        </div>
        {incomplete.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {incomplete.map((s) => (
              <Link key={s.key} href={s.href} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{s.label}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Call Orby by phone — demo only (endpoint returns null otherwise) */}
      {phone && (
        <div className="mt-6 rounded-xl p-4" style={{ background: 'oklch(97% 0.03 193)', border: '1px solid oklch(85% 0.06 193)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentCockpit.phoneTitle')}</div>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentCockpit.phoneDesc')}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentCockpit.phoneNumberLabel')}</div>
              <a href={`tel:${phone.number}`} className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{phone.numberDisplay}</a>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentCockpit.phonePinLabel')}</div>
              <div className="text-lg font-bold tracking-widest" style={{ color: 'oklch(45% 0.13 193)' }}>{phone.pin}</div>
            </div>
          </div>

          {/* Mobile: one tap dials + auto-sends the PIN as DTMF */}
          <a
            href={phone.telHref}
            className="sm:hidden mt-4 block text-center rounded-lg px-4 py-3 text-sm font-semibold text-white"
            style={{ background: 'oklch(55% 0.11 193)' }}
          >
            {t('tenantAgentCockpit.phoneCallCta')}
          </a>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantAgentCockpit.phoneFallbackHint').replaceAll('{pin}', phone.pin)}
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-6">
        <div className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentCockpit.quickTitle')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="rounded-xl px-3 py-3 text-sm font-semibold text-center" style={{ ...card, color: 'var(--text-primary)' }}>{q.label}</Link>
          ))}
        </div>
      </div>

      {/* Recent leads */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentCockpit.leadsTitle')}</div>
          <Link href="/conversations" className="text-xs font-semibold" style={{ color: 'var(--accent, #0d9488)' }}>{t('tenantAgentCockpit.viewAll')}</Link>
        </div>
        {leads.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentCockpit.leadsEmpty')}</p> : (
          <div className="grid gap-2">
            {leads.map((l) => (
              <Link key={l.id} href={`/conversations?open=${l.id}`} className="rounded-xl p-3 block" style={card}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{contactName(l)}</div>
                  <div className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>{fmtWhen(l.startedAt)}</div>
                </div>
                {l.summaryText && <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{l.summaryText}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming showings */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentCockpit.showingsTitle')}</div>
          <Link href="/appointments" className="text-xs font-semibold" style={{ color: 'var(--accent, #0d9488)' }}>{t('tenantAgentCockpit.viewAll')}</Link>
        </div>
        {showings.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentCockpit.showingsEmpty')}</p> : (
          <div className="grid gap-2">
            {showings.map((s) => (
              <div key={s.id} className="rounded-xl p-3 flex items-center justify-between gap-3" style={card}>
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.appointmentType || 'Showing'}</div>
                  {s.location && <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{s.location}</div>}
                </div>
                <div className="text-xs shrink-0 text-right" style={{ color: 'var(--text-secondary)' }}>{fmtWhen(s.startAt)}<div style={{ color: 'var(--text-tertiary)' }}>{s.status}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
