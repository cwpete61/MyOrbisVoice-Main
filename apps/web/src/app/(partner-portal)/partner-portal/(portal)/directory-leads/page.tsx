'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import ScriptsPanel from '@/components/partner/ScriptsPanel'

const TEAL = 'oklch(55% 0.11 193)'

interface Gap { key: string; label: string }
interface Lead {
  id: string; name: string; slug: string; niche: string; city: string; state: string
  auditScore: number | null; hasWebsite: boolean; hasPhone: boolean; phoneE164: string | null; reviewCount: number
  gaps: Gap[]; moneyOnTable: number; listingHref: string
}
interface Claimed {
  businessId: string; name: string; slug: string; niche: string; city: string; state: string
  claimedAt: string | null; claimEmail: string | null; phoneE164: string | null
  partnerSlug: string | null; attributedAt: string | null; tier: string; hasDirectorySub: boolean
  listingHref: string; commissionCents: number; paidCents: number; purchaseCount: number; hasVoiceSub: boolean
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const dateFmt = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—')
const scoreColor = (s: number | null) =>
  s == null ? 'var(--text-tertiary)' : s < 40 ? 'oklch(60% 0.18 25)' : s < 70 ? 'oklch(70% 0.14 75)' : 'oklch(60% 0.15 145)'

// Dedup gaps by key (the audit can flag the same gap across services).
const dedupeGaps = (gaps: Gap[]) => {
  const seen = new Set<string>()
  return gaps.filter((g) => (seen.has(g.key) ? false : (seen.add(g.key), true)))
}

// Fill the bilingual claim-email template with the business name + tagged link.
function fill(tpl: string, business: string, link: string) {
  return tpl.replaceAll('{business}', business).replaceAll('{link}', link)
}

export default function DirectoryLeadsPage() {
  const t = useT()
  const [tab, setTab] = useState<'leads' | 'claimed' | 'scripts'>('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [city, setCity] = useState('')
  const [gap, setGap] = useState('')
  const [sort, setSort] = useState<'score' | 'az' | 'za'>('score')
  const [links, setLinks] = useState<Record<string, string>>({})
  const [contactIds, setContactIds] = useState<Record<string, string>>({})
  const [minting, setMinting] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<Claimed[]>([])
  const [claimedLoading, setClaimedLoading] = useState(false)
  const [claimedLoaded, setClaimedLoaded] = useState(false)

  const GAP_OPTIONS = [
    { key: '', label: t('partnerDirectory.gapAny') },
    { key: 'no_website', label: t('partnerDirectory.gapNoWebsite') },
    { key: 'phone_only', label: t('partnerDirectory.gapPhoneOnly') },
    { key: 'low_reviews', label: t('partnerDirectory.gapLowReviews') },
    { key: 'no_hours', label: t('partnerDirectory.gapNoHours') },
  ]

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams()
      if (city.trim()) qs.set('city', city.trim())
      if (gap) qs.set('gap', gap)
      qs.set('limit', '40')
      const data = await apiFetch<{ items: Lead[]; total: number }>(`/api/partner/directory/leads?${qs.toString()}`)
      setLeads(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerDirectory.error'))
    } finally { setLoading(false) }
  }, [city, gap, t])

  useEffect(() => { load() }, [load])

  const loadClaimed = useCallback(async () => {
    setClaimedLoading(true); setError('')
    try {
      const data = await apiFetch<{ items: Claimed[]; total: number }>('/api/partner/directory/claimed?limit=100')
      setClaimed(data.items ?? [])
      setClaimedLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerDirectory.error'))
    } finally { setClaimedLoading(false) }
  }, [t])

  // Lazy-load the Claimed tab the first time it's opened.
  useEffect(() => { if (tab === 'claimed' && !claimedLoaded) loadClaimed() }, [tab, claimedLoaded, loadClaimed])

  // Client-side sort over the loaded leads. 'score' keeps the server's
  // worst-score-first order (best pitch); az/za sort by business name.
  const sortedLeads = useMemo(() => {
    if (sort === 'score') return leads
    const arr = [...leads].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return sort === 'za' ? arr.reverse() : arr
  }, [leads, sort])

  async function getLink(lead: Lead) {
    setMinting(lead.id); setError('')
    try {
      const r = await apiFetch<{ url: string }>('/api/partner/directory/mint-link', {
        method: 'POST', body: JSON.stringify({ businessId: lead.id }),
      })
      setLinks((m) => ({ ...m, [lead.id]: r.url }))
      // Save the business to the partner's CRM as a lead AND stage the claim
      // email (subject + body, link baked in) on it — so the partner opens the
      // contact, adds the owner's email after the call, and the Email compose is
      // already pre-filled. Sending happens from the contact page.
      const subject = fill(t('partnerDirectory.emailSubject'), lead.name, r.url)
      const body    = fill(t('partnerDirectory.emailBody'),    lead.name, r.url)
      const save = await apiFetch<{ id: string }>('/api/partner/crm/contacts/from-directory-lead', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: lead.slug, businessName: lead.name, city: lead.city, niche: lead.niche,
          phone: lead.phoneE164 ?? undefined, listingHref: lead.listingHref, claimLink: r.url,
          gaps: dedupeGaps(lead.gaps).map((g) => g.key), auditScore: lead.auditScore ?? undefined,
          claimEmailSubject: subject, claimEmailBody: body,
        }),
      })
      setContactIds((m) => ({ ...m, [lead.id]: save.id }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerDirectory.error'))
    } finally { setMinting(null) }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{t('partnerDirectory.title')}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>{t('partnerDirectory.subtitle')}</p>

      {/* Tabs — Directory Leads | Claimed */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
        {([['leads', t('partnerDirectory.tabLeads')], ['claimed', t('partnerDirectory.tabClaimed')], ['scripts', t('partnerDirectory.tabScripts')]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as 'leads' | 'claimed' | 'scripts')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 14,
              fontWeight: 600, color: tab === k ? TEAL : 'var(--text-tertiary)',
              borderBottom: tab === k ? `2px solid ${TEAL}` : '2px solid transparent', marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {tab === 'leads' && (<>
      {/* Filters — minimal */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('partnerDirectory.cityPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: '1 1 160px', minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 }} />
        <select value={gap} onChange={(e) => setGap(e.target.value)}
          style={{ flex: '1 1 160px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 }}>
          {GAP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'score' | 'az' | 'za')} aria-label={t('partnerDirectory.sortLabel')}
          style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="score">{t('partnerDirectory.sortScore')}</option>
          <option value="az">{t('partnerDirectory.sortAz')}</option>
          <option value="za">{t('partnerDirectory.sortZa')}</option>
        </select>
        <button onClick={load} style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {t('partnerDirectory.search')}
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: 24 }}>{t('partnerDirectory.loading')}</p>
      ) : leads.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: 24 }}>{t('partnerDirectory.empty')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sortedLeads.map((lead) => (
            <div key={lead.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{lead.niche} · {lead.city}, {lead.state}</div>
                  {lead.phoneE164 && (
                    <a href={`tel:${lead.phoneE164}`} style={{ fontSize: 13, fontWeight: 600, color: TEAL, textDecoration: 'none', display: 'inline-block', marginTop: 2 }}>
                      📞 {lead.phoneE164}
                    </a>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(lead.auditScore) }}>{lead.auditScore ?? '—'}<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/100</span></div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TEAL }}>{money(lead.moneyOnTable)}/mo</div>
                </div>
              </div>

              {/* Gap chips — the pitch ammo */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {dedupeGaps(lead.gaps).map((g) => (
                  <span key={g.key} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 8px' }}>{g.label}</span>
                ))}
              </div>

              {/* Action — after the link is minted: call script + open the CRM
                  contact (where the partner adds the owner's email + sends the
                  pre-filled claim email). */}
              {links[lead.id] ? (
                <div style={{ marginTop: 12 }}>
                  {/* Claim-only call script — get them to claim, nothing more */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, marginBottom: 8, lineHeight: 1.5 }}>
                    {t('partnerDirectory.callScript')}
                  </div>
                  {contactIds[lead.id] ? (
                    <a href={`/partner-portal/contacts/${contactIds[lead.id]}`}
                      style={{ display: 'block', textAlign: 'center', background: TEAL, color: 'white', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                      {t('partnerDirectory.openContact')}
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 8 }}>{t('partnerDirectory.minting')}</div>
                  )}
                </div>
              ) : (
                <button onClick={() => getLink(lead)} disabled={minting === lead.id}
                  style={{ marginTop: 12, width: '100%', background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: minting === lead.id ? 0.6 : 1 }}>
                  {minting === lead.id ? t('partnerDirectory.minting') : t('partnerDirectory.getLink')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      </>)}

      {tab === 'claimed' && (
        claimedLoading ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: 24 }}>{t('partnerDirectory.loading')}</p>
        ) : claimed.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: 24 }}>{t('partnerDirectory.claimedEmpty')}</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {claimed.map((c) => (
              <div key={c.businessId} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{c.niche} · {c.city}, {c.state}</div>
                    {/* Marked with the partner's name + claim date (req #3) */}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {t('partnerDirectory.claimedVia')}{c.partnerSlug ? ` · ${c.partnerSlug}` : ''} · {t('partnerDirectory.claimedOn')} {dateFmt(c.claimedAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {c.purchaseCount > 0 ? (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 700, color: TEAL }}>{money(c.commissionCents / 100)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('partnerDirectory.commissionEarned')}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('partnerDirectory.noPurchaseYet')}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  {c.hasVoiceSub && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'oklch(45% 0.13 160)', background: 'oklch(60% 0.15 160 / 0.14)', borderRadius: 6, padding: '3px 8px' }}>{t('partnerDirectory.badgeVoiceCustomer')}</span>
                  )}
                  {c.hasDirectorySub && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'oklch(45% 0.13 75)', background: 'oklch(70% 0.14 75 / 0.16)', borderRadius: 6, padding: '3px 8px' }}>{t('partnerDirectory.badgeFeatured')}</span>
                  )}
                  <a href={c.listingHref} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, color: TEAL, textDecoration: 'none', marginLeft: 'auto' }}>
                    {t('partnerDirectory.viewListing')} →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'scripts' && <ScriptsPanel />}
    </div>
  )
}
