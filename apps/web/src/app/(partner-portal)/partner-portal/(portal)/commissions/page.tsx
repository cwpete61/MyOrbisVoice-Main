'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

// Shape returned by GET /api/affiliate/commissions — see services/affiliate.service.ts:getCommissions
// Maps directly to the AffiliateCommission Prisma model with the joined affiliateConversion.
type Commission = {
  id: string
  amountMinor: number       // not "amountCents" — the schema uses generic 'minor units'
  currency: string
  status: string
  approvedAt: string | null
  paidAt: string | null
  reversedAt: string | null
  holdReason: string | null
  payoutRef: string | null
  eligibleAt: string         // when 30-day hold ends (or createdAt for renewals)
  scheduledPayoutDate: string | null  // next 1st-or-15th >= eligibleAt, biz-day-adjusted
  createdAt: string
  affiliateConversion: {
    conversionType: string
    conversionValue: number | null
    occurredAt: string
  } | null
}

type PagedResult = {
  items: Commission[]
  total: number
}

const STATUS_BG: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: 'oklch(65% 0.18 60 / 0.12)',  text: 'oklch(50% 0.15 60)' },
  APPROVED: { bg: 'oklch(55% 0.18 145 / 0.12)', text: 'oklch(45% 0.15 145)' },
  PAID:     { bg: 'oklch(55% 0.18 220 / 0.12)', text: 'oklch(45% 0.15 220)' },
  HELD:     { bg: 'oklch(65% 0.18 30 / 0.12)',  text: 'oklch(50% 0.15 30)' },
  REVERSED: { bg: 'oklch(55% 0.18 15 / 0.12)',  text: 'oklch(45% 0.15 15)' },
}

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2) }

export default function CommissionsPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [result, setResult] = useState<PagedResult | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const STATUS_LABEL: Record<string, string> = {
    PENDING:  t('partnerCommissions.statusPill.pending'),
    APPROVED: t('partnerCommissions.statusPill.approved'),
    PAID:     t('partnerCommissions.statusPill.paid'),
    HELD:     t('partnerCommissions.statusPill.hold'),
    REVERSED: t('partnerCommissions.statusPill.reversed'),
  }

  useEffect(() => {
    setLoading(true)
    apiFetch<PagedResult>(`/api/affiliate/commissions?page=${page}&limit=20`)
      .then(r => { setResult(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page])

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pages = Math.ceil(total / 20)

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerCommissions.subtitle')}</p>

      {/* How payment works — explains the holdback + Stripe fee model.
          Always visible so partners understand why their net differs from gross. */}
      <PaymentExplainer />

      {loading ? (
        <div className="text-sm pt-4" style={{ color: 'var(--text-tertiary)' }}>{t('actions.loading')}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
          {t('partnerCommissions.noCommissions')}
        </div>
      ) : (
        <>
          <div className="rounded-xl overflow-x-auto mb-4" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tableDate')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tableDescription')}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tableAmount')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tableStatus')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tablePaysOn')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.tablePaid')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, i) => {
                  const bg = STATUS_BG[c.status] ?? STATUS_BG['PENDING']!
                  const label = STATUS_LABEL[c.status] ?? STATUS_LABEL['PENDING']!
                  // "Pays on" only shows if not yet paid. Once paid, the Paid column tells the story.
                  const showsPaysOn = c.status !== 'PAID' && c.status !== 'REVERSED' && c.scheduledPayoutDate
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{formatInTimezone(c.createdAt, { tz, locale: dateLocale, dateStyle: 'short' })}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.affiliateConversion?.conversionType ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(c.amountMinor ?? 0)}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: bg.bg, color: bg.text }}>{label}</span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
                        {showsPaysOn ? formatInTimezone(c.scheduledPayoutDate!, { tz, locale: dateLocale, month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
                        {c.paidAt ? formatInTimezone(c.paidAt, { tz, locale: dateLocale, dateStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: page === 1 ? 0.4 : 1 }}>{t('partnerCommissions.prev')}</button>
              <span style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.pageOf', { page, total: pages })}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: page === pages ? 0.4 : 1 }}>{t('partnerCommissions.next')}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Payment explainer ────────────────────────────────────────────────────────
// Tells the partner exactly how/when commissions become real money in their
// bank, and why the net amount differs from the gross commission. Visible on
// every commissions page load so it's always one click away when a partner
// has a question.
const TEAL = 'oklch(55% 0.11 193)'
const TEAL_TINT = 'oklch(55% 0.11 193 / 0.08)'

/** Render a translation that contains **bold** markdown segments. Returns a
 *  React fragment with <strong> wrapping each bolded chunk. Keeps strings
 *  translatable in one piece while preserving inline emphasis. */
function bold(template: string): React.ReactNode {
  const parts = template.split(/\*\*([^*]+)\*\*/g)
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))
}

function PaymentExplainer() {
  const t = useT()
  const [open, setOpen] = useState(true)
  return (
    <div
      className="rounded-xl mb-6 overflow-hidden"
      style={{ background: TEAL_TINT, border: '1px solid oklch(55% 0.11 193 / 0.25)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="text-sm font-semibold">{t('partnerCommissions.explainer.title')}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', color: 'var(--text-tertiary)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm space-y-3" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.section1Title')}</p>
            <p className="text-xs leading-relaxed">{t('partnerCommissions.explainer.section1')}</p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.section2Title')}</p>
            <p className="text-xs leading-relaxed">{t('partnerCommissions.explainer.section2')}</p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.section3Title')}</p>
            <p className="text-xs leading-relaxed">{t('partnerCommissions.explainer.section3Intro')}</p>
            <ul className="text-xs leading-relaxed mt-1.5 ml-4 list-disc space-y-0.5">
              <li>{bold(t('partnerCommissions.explainer.section3Bullet1'))}</li>
              <li>{bold(t('partnerCommissions.explainer.section3Bullet2'))}</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.exampleTitle')}</p>
            <table className="text-xs w-full max-w-md">
              <tbody>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.explainer.exampleEarned')}</td><td className="text-right tabular-nums">$100.00</td></tr>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.explainer.exampleStripeFee')}</td><td className="text-right tabular-nums" style={{ color: 'oklch(55% 0.18 25)' }}>− $2.00</td></tr>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.explainer.exampleAchFee')}</td><td className="text-right tabular-nums" style={{ color: 'oklch(55% 0.18 25)' }}>− $0.00</td></tr>
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="py-1 font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.exampleNet')}</td>
                  <td className="text-right py-1 font-semibold tabular-nums" style={{ color: TEAL }}>$98.00</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerCommissions.explainer.exampleNote')}</p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerCommissions.explainer.minTitle')}</p>
            <p className="text-xs leading-relaxed">{bold(t('partnerCommissions.explainer.minBody'))}</p>
          </div>
        </div>
      )}
    </div>
  )
}
