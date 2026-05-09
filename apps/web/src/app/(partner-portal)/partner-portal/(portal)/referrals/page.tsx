'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

type ReferralLink = {
  url: string
  code: string
}

type Click = {
  id: string
  clickedAt: string
  landingPath: string | null
  referrer: string | null
  convertedAt: string | null
}

type CustomLink = {
  id: string
  slug: string
  label: string
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  clicks: number
}

type Referral = {
  id: string
  occurredAt: string
  conversionType: string
  conversionValue: number | null
  tenant: { id: string; name: string; planCode: string; planName: string }
  commissionStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED' | 'HOLD'
  commissionCents: number
}

const APP_BASE = 'https://app.myorbisvoice.com'

export default function ReferralsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [link, setLink] = useState<ReferralLink | null>(null)
  const [clicks, setClicks] = useState<Click[]>([])
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  // Create-form state
  const [newSlug, setNewSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Auto-derive slug from label until the user types directly in the slug
  // field. Removes the most common form-stuck-at-disabled trap: filling in
  // label without realising slug is also required.
  function slugify(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
  }
  function onLabelChange(value: string) {
    // Only spaces between words: no leading whitespace, no double spaces.
    // (A single trailing space is preserved while typing so the user can
    // type the next word; createCustomLink trims on submit.)
    const cleaned = value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ')
    setNewLabel(cleaned)
    if (!slugTouched) setNewSlug(slugify(cleaned))
  }

  function loadCustomLinks() {
    return apiFetch<CustomLink[]>('/api/affiliate/custom-links').catch(() => [])
  }

  useEffect(() => {
    Promise.all([
      apiFetch<ReferralLink>('/api/affiliate/link').catch(() => null),
      apiFetch<Click[]>('/api/affiliate/clicks').catch(() => []),
      loadCustomLinks(),
      apiFetch<Referral[]>('/api/affiliate/referrals').catch(() => []),
    ]).then(([l, c, cl, r]) => {
      setLink(l)
      setClicks(c ?? [])
      setCustomLinks(cl ?? [])
      setReferrals(r ?? [])
      setLoading(false)
    })
  }, [])

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function createCustomLink(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateBusy(true)
    try {
      await apiFetch('/api/affiliate/custom-links', {
        method: 'POST',
        body: JSON.stringify({
          slug: newSlug.trim().toLowerCase(),
          label: newLabel.trim(),
          notes: newNotes.trim() || undefined,
        }),
      })
      setNewSlug('')
      setSlugTouched(false)
      setNewLabel('')
      setNewNotes('')
      const fresh = await loadCustomLinks()
      setCustomLinks(fresh ?? [])
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('partnerReferrals.createError'))
    } finally {
      setCreateBusy(false)
    }
  }

  async function toggleArchive(id: string, archived: boolean) {
    try {
      await apiFetch(`/api/affiliate/custom-links/${id}/${archived ? 'unarchive' : 'archive'}`, {
        method: 'POST',
      })
      const fresh = await loadCustomLinks()
      setCustomLinks(fresh ?? [])
    } catch { /* swallow — list reload will reflect any error */ }
  }

  async function removeLink(id: string) {
    if (!confirm(t('partnerReferrals.deleteConfirm'))) return
    try {
      await apiFetch(`/api/affiliate/custom-links/${id}`, { method: 'DELETE' })
      const fresh = await loadCustomLinks()
      setCustomLinks(fresh ?? [])
    } catch { /* same */ }
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('actions.loading')}</div>

  // Decide which hint to show beside the Create button
  const slugTrim = newSlug.trim()
  const labelTrim = newLabel.trim()
  const buttonHint = !labelTrim
    ? t('partnerReferrals.hintNeedLabel')
    : !slugTrim
      ? t('partnerReferrals.hintNeedSlug')
      : slugTrim.length < 3
        ? t('partnerReferrals.hintSlugTooShort')
        : null

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerReferrals.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerReferrals.subtitle')}</p>

      {link ? (
        <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.primaryLinkLabel')}</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link.url}
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={() => copy(link.url, 'primary')}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: copied === 'primary' ? 'oklch(55% 0.18 145)' : 'var(--brand-500)', color: '#fff', minWidth: 80 }}
            >
              {copied === 'primary' ? t('actions.copied') : t('actions.copy')}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralCode')} <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{link.code}</span></p>
        </div>
      ) : (
        <div className="rounded-xl p-5 mb-8 text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {t('partnerReferrals.notApprovedNotice')}
        </div>
      )}

      {/* ─── Custom links ─────────────────────────────────────────────── */}
      {link ? (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerReferrals.customLinks')}</h2>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.activeCount', { n: customLinks.filter(l => !l.archived).length })}</span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            {(() => {
              const tpl = t('partnerReferrals.customLinksDesc', { a: '__A__', b: '__B__' })
              const codeStyle = { background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: 3 }
              const aParts = tpl.split('__A__')
              if (aParts.length !== 2) return tpl
              const bParts = (aParts[1] ?? '').split('__B__')
              if (bParts.length !== 2) return tpl
              return (
                <>
                  {aParts[0]}
                  <code style={codeStyle}>sarahs-podcast</code>
                  {bParts[0]}
                  <code style={codeStyle}>fall-promo</code>
                  {bParts[1]}
                </>
              )
            })()}
          </p>

          {/* Create form */}
          <form onSubmit={createCustomLink} className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.label')} <span style={{ color: 'oklch(60% 0.20 25)' }}>*</span></label>
                <input
                  value={newLabel}
                  onChange={e => onLabelChange(e.target.value)}
                  placeholder={t('partnerReferrals.labelPlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  required
                  maxLength={100}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.labelHelp')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.slug')} <span style={{ color: 'oklch(60% 0.20 25)' }}>*</span> <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {t('partnerReferrals.slugAutofilled')}</span></label>
                <label
                  className="flex items-center rounded-lg cursor-text"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}
                >
                  <span className="pl-2 pr-0.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{APP_BASE.replace('https://', '')}/r/</span>
                  <input
                    value={newSlug}
                    onChange={e => { setSlugTouched(true); setNewSlug(e.target.value) }}
                    placeholder={t('partnerReferrals.slugPlaceholder')}
                    pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                    className="flex-1 pr-3 py-2 text-sm bg-transparent outline-none min-w-0"
                    style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}
                    required
                    minLength={3}
                    maxLength={50}
                  />
                </label>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.slugHelp')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.notesLabel')}</label>
                <input
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder={t('partnerReferrals.notesPlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  maxLength={200}
                />
              </div>
            </div>
            {createError && (
              <p className="text-xs mt-3" style={{ color: 'oklch(60% 0.20 25)' }}>{createError}</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {buttonHint
                  ? buttonHint
                  : <span style={{ color: 'var(--text-secondary)' }}>{t('partnerReferrals.hintReady')}</span>}
              </p>
              <button
                type="submit"
                disabled={createBusy || !slugTrim || !labelTrim || slugTrim.length < 3}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: createBusy ? 'var(--surface-app)' : 'var(--brand-500)',
                  color: '#fff',
                  opacity: createBusy || !slugTrim || !labelTrim || slugTrim.length < 3 ? 0.55 : 1,
                  cursor: createBusy || !slugTrim || !labelTrim || slugTrim.length < 3 ? 'not-allowed' : 'pointer',
                }}
              >
                {createBusy ? t('partnerReferrals.creating') : t('partnerReferrals.createButton')}
              </button>
            </div>
          </form>

          {customLinks.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.noCustomLinks')}</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.tableSlug')}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.tableLabel')}</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.tableClicks')}</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.tableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customLinks.map((cl, i) => {
                    const url = `${APP_BASE}/r/${cl.slug}`
                    const copyKey = `cl-${cl.id}`
                    return (
                      <tr key={cl.id} style={{
                        background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)',
                        borderBottom: '1px solid var(--border-subtle)',
                        opacity: cl.archived ? 0.55 : 1,
                      }}>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          /r/{cl.slug}
                          {cl.archived && <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.archivedBadge')}</span>}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {cl.label}
                          {cl.notes && <span className="block text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{cl.notes}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {cl.clicks}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => copy(url, copyKey)}
                              className="px-2.5 py-1 rounded text-[11px] font-medium"
                              style={{ background: copied === copyKey ? 'oklch(55% 0.18 145)' : 'var(--surface-raised)', color: copied === copyKey ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                            >
                              {copied === copyKey ? t('actions.copied') : t('partnerReferrals.copyUrl')}
                            </button>
                            <button
                              onClick={() => toggleArchive(cl.id, cl.archived)}
                              className="px-2.5 py-1 rounded text-[11px] font-medium"
                              style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                            >
                              {cl.archived ? t('partnerReferrals.unarchive') : t('partnerReferrals.archive')}
                            </button>
                            <button
                              onClick={() => removeLink(cl.id)}
                              className="px-2.5 py-1 rounded text-[11px] font-medium"
                              style={{ background: 'var(--surface-raised)', color: 'oklch(60% 0.20 25)', border: '1px solid var(--border-subtle)' }}
                            >
                              {t('partnerReferrals.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* ─── All referrals (paid + free) ──────────────────────────────────
          Every signup that came through this partner's link, regardless of
          whether it produced a commission. Free-tier signups show "Free —
          no commission yet"; paid plans show the commission status + amount. */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerReferrals.referralsTitle')}</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsSubtitle')}</p>
        {referrals.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.noReferrals')}</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsDate')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsBusiness')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsPlan')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsType')}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.referralsCommission')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r, i) => {
                  const typeLabel = r.conversionType === 'signup'
                    ? t('partnerReferrals.referralTypeSignup')
                    : r.conversionType === 'subscription'
                      ? t('partnerReferrals.referralTypeSubscription')
                      : r.conversionType === 'one_time'
                        ? t('partnerReferrals.referralTypeOneTime')
                        : r.conversionType
                  const hasCommission = r.commissionStatus !== 'NONE' && r.commissionCents > 0
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{new Date(r.occurredAt).toLocaleDateString(dateLocale)}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{r.tenant.name}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{r.tenant.planName}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{typeLabel}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: hasCommission ? 'var(--text-primary)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        {hasCommission
                          ? '$' + (r.commissionCents / 100).toFixed(2)
                          : t('partnerReferrals.noCommissionYet')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerReferrals.recentClicks')}</h2>
      {clicks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.noClicks')}</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.clicksDate')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.clicksLanding')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.clicksReferrer')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerReferrals.clicksConverted')}</th>
              </tr>
            </thead>
            <tbody>
              {clicks.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.clickedAt ? new Date(c.clickedAt).toLocaleDateString(dateLocale) : '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.landingPath ?? '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{c.referrer ? new URL(c.referrer).hostname : '—'}</td>
                  <td className="px-4 py-2.5">
                    {c.convertedAt
                      ? <span style={{ color: 'oklch(55% 0.18 145)' }}>✓ {new Date(c.convertedAt).toLocaleDateString(dateLocale)}</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
