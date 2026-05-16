'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { PartnerBackToOnboarding } from '@/components/PartnerBackToOnboarding'

// Phase G.1.B-1 — partner self-service search + admin-approved purchase.
// Stripe billing wired in next session; for now admin invoices manually.

// Phase G.2 — VOICE_SMS bundled tier retired. SMS is now decoupled from
// the number subscription and sold as separate credit packs (see CreditsCard).
// Any historical VOICE_SMS rows continue to render their existing badge in
// the active-numbers list (driven by partnerCapabilityTier), but the picker
// only offers VOICE + TOLLFREE for new purchases.
type Tier = 'VOICE' | 'TOLLFREE'

const TIER_INFO: Record<Tier, { priceCents: number; numberType: 'local' | 'tollfree' }> = {
  VOICE:     { priceCents:  200, numberType: 'local'    },
  TOLLFREE:  { priceCents:  500, numberType: 'tollfree' },
}

type SmsPack = { id: 'pack_5' | 'pack_10'; credits: number; unitAmountCents: number }
type VoiceUsage = {
  cycleAmountCents: number
  cycleMinutes:     number
  cycleCallCount:   number
  rateCents:        { LOCAL: number; TOLLFREE: number }
  recentCalls: Array<{
    callSid:         string
    direction:       string
    numberType:      string
    billableMinutes: number
    amountCents:     number
    createdAt:       string
  }>
}
type Financials = {
  purchasedCents:   number
  spentCents:       number
  pendingCostCents: number
  netCents:         number
  marginPct:        number
  status:           'HEALTHY' | 'LOW' | 'OVER_BUDGET'
}
type CreditsStatus = {
  balance:       number
  recentLedger:  Array<{
    id:            string
    eventType:     string
    creditsDelta:  number
    balanceAfter:  number
    channel:       string | null
    packId:        string | null
    usdAmountCents: number | null
    createdAt:     string
    note:          string | null
  }>
  packs:         SmsPack[]
  channelCost:   Record<string, number>
  financials:    Financials
}

type Subaccount = { exists: boolean; subaccountSid: string | null; status: string | null }
type PaymentMethod = { hasCard: boolean; brand: string | null; last4: string | null }
type PhoneNumberRow = {
  id:                    string
  e164Number:            string
  displayLabel:          string | null
  monthlyPriceCents:     number | null
  purchaseStatus:        'PENDING' | 'APPROVED' | 'PURCHASED' | 'REJECTED' | 'RELEASED'
  partnerCapabilityTier: Tier | null
  a2pStatus:             'NOT_REQUIRED' | 'PENDING_QUEUE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  rejectionReason:       string | null
  isInboundEnabled:      boolean
  isOutboundEnabled:     boolean
  isSmsEnabled:          boolean
  requestedAt:           string | null
  approvedAt:            string | null
  createdAt:             string
}
type SearchHit = {
  phoneNumber:  string
  friendlyName: string
  locality:     string | null
  region:       string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
}

export default function PartnerPhoneNumbersPage() {
  const t = useT()
  const [sub, setSub] = useState<Subaccount | null>(null)
  const [pm, setPm] = useState<PaymentMethod | null>(null)
  const [numbers, setNumbers] = useState<PhoneNumberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingCardForm, setOpeningCardForm] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [tier, setTier] = useState<Tier>('VOICE')
  const [areaCode, setAreaCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [requestingFor, setRequestingFor] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Phase G.2 — SMS credit state
  const [credits, setCredits] = useState<CreditsStatus | null>(null)
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  // Phase G.3 — voice usage
  const [voiceUsage, setVoiceUsage] = useState<VoiceUsage | null>(null)

  async function reload() {
    const [s, n, p, c, v] = await Promise.all([
      apiFetch<Subaccount>('/api/partner/twilio/subaccount').catch(() => null),
      apiFetch<{ items: PhoneNumberRow[]; total: number }>('/api/partner/twilio/numbers').catch(() => ({ items: [], total: 0 })),
      apiFetch<PaymentMethod>('/api/partner/billing/payment-method').catch(() => null),
      apiFetch<CreditsStatus>('/api/partner/sms-credits').catch(() => null),
      apiFetch<VoiceUsage>('/api/partner/voice-usage').catch(() => null),
    ])
    setSub(s ?? { exists: false, subaccountSid: null, status: null })
    setNumbers(n?.items ?? [])
    setPm(p ?? { hasCard: false, brand: null, last4: null })
    setCredits(c)
    setVoiceUsage(v)
  }

  async function buyPack(packId: 'pack_5' | 'pack_10') {
    setBuyingPack(packId)
    setError(null)
    try {
      const { url } = await apiFetch<{ url: string }>('/api/partner/sms-credits/purchase-session', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      })
      window.location.href = url
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Could not open Stripe Checkout')
      setBuyingPack(null)
    }
  }

  async function openCardSetup() {
    setOpeningCardForm(true)
    try {
      const { url } = await apiFetch<{ url: string }>('/api/partner/billing/setup-session', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      // Stripe Checkout (hosted) — full-page redirect. Stripe redirects back
      // to ?setup=success on completion, where we reload payment method.
      window.location.href = url
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Could not open Stripe Checkout')
      setOpeningCardForm(false)
    }
  }

  async function cancelNumber(id: string, phoneNumber: string) {
    if (!confirm(`Cancel ${phoneNumber}? Subscription stops at end of current period and the number is released.`)) return
    setCancelingId(id)
    try {
      await apiFetch(`/api/partner/twilio/numbers/${id}/cancel`, { method: 'POST' })
      setSuccessMsg(`Subscription canceled for ${phoneNumber}. The number will be released shortly.`)
      await reload()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Cancel failed')
    } finally { setCancelingId(null) }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false)).catch(err => { setError((err as Error).message); setLoading(false) })
    // After Stripe Checkout redirect → flag a quick toast + drop the query
    // so refresh doesn't re-toast.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const setupResult = params.get('setup')
      if (setupResult === 'success') {
        setSuccessMsg(t('partnerPhoneNumbers.card.saved'))
        window.history.replaceState({}, '', window.location.pathname)
      } else if (setupResult === 'cancel') {
        window.history.replaceState({}, '', window.location.pathname)
      }
      const creditsResult = params.get('credits')
      if (creditsResult === 'success') {
        setSuccessMsg(t('partnerPhoneNumbers.credits.purchaseSuccess'))
        window.history.replaceState({}, '', window.location.pathname)
      } else if (creditsResult === 'cancel') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [t])

  async function runSearch() {
    setSearchErr(null)
    setHits([])
    setSearching(true)
    try {
      const params = new URLSearchParams()
      params.set('type', TIER_INFO[tier].numberType)
      if (areaCode.trim()) params.set('areaCode', areaCode.trim())
      params.set('limit', '20')
      const data = await apiFetch<SearchHit[]>(`/api/partner/twilio/numbers/search?${params.toString()}`)
      setHits(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setSearchErr((e as Error).message ?? 'Search failed')
    } finally { setSearching(false) }
  }

  async function requestNumber(phoneNumber: string) {
    setSuccessMsg(null)
    setRequestingFor(phoneNumber)
    try {
      await apiFetch('/api/partner/twilio/numbers/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, tier }),
      })
      setSuccessMsg(t('partnerPhoneNumbers.requestSent').replace('{number}', phoneNumber))
      setHits(prev => prev.filter(h => h.phoneNumber !== phoneNumber))
      await reload()
    } catch (e: unknown) {
      setSearchErr((e as Error).message ?? 'Request failed')
    } finally { setRequestingFor(null) }
  }

  function dollars(cents: number | null): string {
    if (cents == null) return '—'
    return `$${(cents / 100).toFixed(2)}/mo`
  }
  function statusBadgeColor(s: PhoneNumberRow['purchaseStatus']): { bg: string; text: string } {
    switch (s) {
      case 'PURCHASED': return { bg: 'oklch(94% 0.06 155)', text: 'oklch(35% 0.14 155)' }
      case 'PENDING':   return { bg: 'oklch(95% 0.04 75)',  text: 'oklch(40% 0.16 75)'  }
      case 'APPROVED':  return { bg: 'oklch(94% 0.06 230)', text: 'oklch(35% 0.14 230)' }
      case 'REJECTED':  return { bg: 'oklch(96% 0.04 25)',  text: 'oklch(40% 0.18 25)'  }
      default:          return { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' }
    }
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.loading')}</div>

  return (
    <div className="max-w-4xl">
      <PartnerBackToOnboarding />
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerPhoneNumbers.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerPhoneNumbers.subtitle')}</p>
        </div>
        <button
          data-testid="buy-new-toggle"
          onClick={() => { setShowSearch(s => !s); setSuccessMsg(null) }}
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: 'var(--brand-500)', color: '#fff' }}
        >
          {showSearch ? t('partnerPhoneNumbers.hideSearch') : t('partnerPhoneNumbers.buyNew')}
        </button>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}
      {successMsg && <div className="alert-success mb-4">{successMsg}</div>}

      {/* Card-on-file banner. Red if missing (blocks approval); green if present. */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: pm?.hasCard ? 'oklch(96% 0.04 155)' : 'oklch(96% 0.04 25)',
          border: '1px solid var(--border-subtle)',
          color: pm?.hasCard ? 'oklch(35% 0.14 155)' : 'oklch(40% 0.18 25)',
        }}
      >
        <div className="text-sm">
          {pm?.hasCard
            ? <>{t('partnerPhoneNumbers.card.onFile').replace('{brand}', pm.brand?.toUpperCase() ?? 'CARD').replace('{last4}', pm.last4 ?? '••••')}</>
            : <>{t('partnerPhoneNumbers.card.missing')}</>}
        </div>
        <button
          onClick={openCardSetup}
          disabled={openingCardForm}
          className="text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: pm?.hasCard ? 'var(--surface-app)' : 'oklch(55% 0.20 25)', color: pm?.hasCard ? 'var(--text-secondary)' : '#fff', border: pm?.hasCard ? '1px solid var(--border-subtle)' : 'none' }}
        >
          {openingCardForm ? t('partnerPhoneNumbers.card.opening') : (pm?.hasCard ? t('partnerPhoneNumbers.card.replace') : t('partnerPhoneNumbers.card.addCta'))}
        </button>
      </div>

      {/* Monthly pricing summary — partners see the recurring number cost
          upfront alongside the one-time SMS credit packs. */}
      <MonthlyPricingCard t={t} />

      {/* Phase G.3 — voice-minute usage this 30-day cycle (post-paid). */}
      <VoiceUsageCard usage={voiceUsage} t={t} />

      {/* Phase G.2 — SMS credit balance + pack purchase */}
      <SmsCreditsCard
        credits={credits}
        onBuy={buyPack}
        buyingPack={buyingPack}
        hasCard={!!pm?.hasCard}
        t={t}
      />

      {/* WhatsApp coming-soon tile */}
      <WhatsAppComingSoonCard t={t} />

      {/* Search panel */}
      {showSearch && (
        <div data-testid="search-panel" className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.search.heading')}</p>

          {/* Tier picker */}
          <div className="mb-4">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('partnerPhoneNumbers.search.tierLabel')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['VOICE', 'TOLLFREE'] as Tier[]).map(opt => {
                const active = tier === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setTier(opt); setHits([]) }}
                    className="text-left rounded-lg px-3 py-2.5"
                    style={{
                      background: active ? 'var(--nav-active-bg)' : 'var(--surface-app)',
                      border: `1px solid ${active ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)'}`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="text-xs font-semibold">{t(`partnerPhoneNumbers.tier.${opt}.label`)}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>${(TIER_INFO[opt].priceCents / 100).toFixed(2)}/mo</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t(`partnerPhoneNumbers.tier.${opt}.desc`)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* SMS pricing table — shown beside tier picker so partner sees the
              credit packs at purchase time. The number subscription does NOT
              include SMS — explained inline above the table. */}
          <PricingTable
            credits={credits}
            t={t}
            variant="compact"
          />

          {/* Phase G.3 — voice-minute billing disclosure. MUST be visible at
              purchase time so the partner knows minutes are billed on top of
              the flat monthly rental. */}
          <div className="rounded-lg px-3 py-2.5 mb-3 text-[11px]"
               style={{ background: 'oklch(95% 0.04 75)', border: '1px solid oklch(60% 0.14 75 / 0.35)', color: 'oklch(38% 0.14 75)' }}>
            <span className="font-semibold">{t('partnerPhoneNumbers.voiceDisclosure.title')}</span>{' '}
            {t('partnerPhoneNumbers.voiceDisclosure.body')}
          </div>

          {/* Area code + search button */}
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerPhoneNumbers.search.areaCodeLabel')}</label>
              <input
                data-testid="area-code"
                type="text"
                value={areaCode}
                onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder={tier === 'TOLLFREE' ? '800, 833, 844, …' : '212, 415, 718, …'}
                inputMode="numeric"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              data-testid="search-go"
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: 'var(--brand-500)', color: '#fff', opacity: searching ? 0.6 : 1 }}
            >
              {searching ? t('partnerPhoneNumbers.search.searching') : t('partnerPhoneNumbers.search.searchBtn')}
            </button>
          </div>

          {searchErr && <p className="text-xs mb-2" style={{ color: 'oklch(60% 0.2 30)' }}>{searchErr}</p>}

          {/* Results */}
          {hits.length > 0 && (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--surface-overlay)', position: 'sticky', top: 0 }}>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.col.number')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.col.location')}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map(h => (
                    <tr key={h.phoneNumber} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{h.friendlyName || h.phoneNumber}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{[h.locality, h.region].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => requestNumber(h.phoneNumber)}
                          disabled={requestingFor !== null}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md"
                          style={{ background: 'oklch(55% 0.11 193)', color: '#fff', opacity: requestingFor === h.phoneNumber ? 0.6 : 1 }}
                        >
                          {requestingFor === h.phoneNumber ? t('partnerPhoneNumbers.requesting') : t('partnerPhoneNumbers.requestThis')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] mt-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.search.approvalNote')}</p>
        </div>
      )}

      {/* Subaccount status banner */}
      <div
        className="rounded-xl p-4 mb-6 text-sm"
        style={{
          background: sub?.exists ? 'oklch(96% 0.04 155)' : 'oklch(96% 0.03 230)',
          border: '1px solid var(--border-subtle)',
          color: sub?.exists ? 'oklch(35% 0.14 155)' : 'oklch(35% 0.14 230)',
        }}
      >
        {sub?.exists
          ? t('partnerPhoneNumbers.subaccount.provisioned').replace('{status}', sub.status ?? '')
          : t('partnerPhoneNumbers.subaccount.notYet')}
      </div>

      {/* Numbers list */}
      {numbers.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('partnerPhoneNumbers.empty.title')}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('partnerPhoneNumbers.empty.body')}</p>
        </div>
      ) : (
        <div data-testid="active-numbers-table" className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['number', 'tier', 'status', 'price', 'requested', 'actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t(`partnerPhoneNumbers.col.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numbers.map((n, i) => {
                const c = statusBadgeColor(n.purchaseStatus)
                return (
                  <tr key={n.id} style={{ borderBottom: i < numbers.length - 1 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--surface-raised)' }}>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {n.e164Number}
                      {n.displayLabel && <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{n.displayLabel}</div>}
                      {n.purchaseStatus === 'PURCHASED' && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.answeredByOrby')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{n.partnerCapabilityTier ? t(`partnerPhoneNumbers.tier.${n.partnerCapabilityTier}.label`) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={{ background: c.bg, color: c.text }}>{t(`partnerPhoneNumbers.status.${n.purchaseStatus}`)}</span>
                      {n.purchaseStatus === 'REJECTED' && n.rejectionReason && (
                        <div className="text-[10px] mt-1" style={{ color: 'oklch(50% 0.18 25)' }}>{n.rejectionReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{dollars(n.monthlyPriceCents)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{n.requestedAt ? new Date(n.requestedAt).toLocaleDateString() : new Date(n.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {n.purchaseStatus === 'PURCHASED' && (
                        <button
                          type="button"
                          onClick={() => cancelNumber(n.id, n.e164Number)}
                          disabled={cancelingId !== null}
                          className="text-[11px] font-medium underline-offset-2 hover:underline"
                          style={{ color: 'oklch(60% 0.18 25)' }}
                        >
                          {cancelingId === n.id ? t('partnerPhoneNumbers.canceling') : t('partnerPhoneNumbers.cancelBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.adminNote')}</p>
    </div>
  )
}

// Monthly-recurring price summary. Sits at the top of the Phone Numbers tab
// so the partner is reminded their number subscription is separate from the
// one-time SMS credit packs below. Auto-localized to EN/ES.
function MonthlyPricingCard({
  t,
}: {
  t: (k: string, v?: Record<string, string|number>) => string
}) {
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: 'oklch(96% 0.04 230)', border: '1px solid oklch(60% 0.10 230 / 0.3)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(35% 0.14 230)' }}>
        {t('partnerPhoneNumbers.monthly.heading')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" style={{ color: 'oklch(30% 0.10 230)' }}>
        <div>
          <span className="font-bold text-lg">$2.00</span>
          <span className="ml-1 text-xs" style={{ color: 'oklch(40% 0.10 230)' }}>/ {t('partnerPhoneNumbers.monthly.perMonth')}</span>
          <div className="text-xs mt-0.5" style={{ color: 'oklch(40% 0.10 230)' }}>{t('partnerPhoneNumbers.monthly.localLabel')}</div>
        </div>
        <div>
          <span className="font-bold text-lg">$5.00</span>
          <span className="ml-1 text-xs" style={{ color: 'oklch(40% 0.10 230)' }}>/ {t('partnerPhoneNumbers.monthly.perMonth')}</span>
          <div className="text-xs mt-0.5" style={{ color: 'oklch(40% 0.10 230)' }}>{t('partnerPhoneNumbers.monthly.tollfreeLabel')}</div>
        </div>
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'oklch(40% 0.10 230)' }}>
        {t('partnerPhoneNumbers.monthly.note')}
      </p>
    </div>
  )
}

// ─── Phase G.2 — SMS Credits Card ────────────────────────────────────────────
// Shows running balance + pricing table (per-channel cost + pack contents) +
// two buy buttons that redirect to Stripe Checkout. Disabled when partner has
// no card on file — points them to add one above.
function SmsCreditsCard({
  credits, onBuy, buyingPack, hasCard, t,
}: {
  credits:    CreditsStatus | null
  onBuy:      (id: 'pack_5' | 'pack_10') => void
  buyingPack: string | null
  hasCard:    boolean
  t:          (k: string, v?: Record<string, string|number>) => string
}) {
  const balance     = credits?.balance ?? 0
  const financials  = credits?.financials
  const isLow       = balance < 50 || financials?.status === 'LOW'
  const isOver      = financials?.status === 'OVER_BUDGET'

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerPhoneNumbers.credits.heading')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('partnerPhoneNumbers.credits.subtitle')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: isLow || isOver ? 'oklch(55% 0.20 25)' : 'var(--text-primary)' }}>
            {balance.toLocaleString()}
          </div>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerPhoneNumbers.credits.balanceLabel')}
          </div>
        </div>
      </div>

      {/* Phase G.2.1 — cost-meter banner. Shows lifetime purchased $, lifetime
          Twilio spend $, and the net (margin). Status-driven coloring lets the
          partner spot OVER_BUDGET / LOW at a glance. */}
      {financials && financials.purchasedCents > 0 && (
        <div
          className="rounded-lg px-3 py-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"
          style={{
            background: isOver ? 'oklch(96% 0.04 25)'  : isLow ? 'oklch(96% 0.04 75)' : 'oklch(96% 0.04 155)',
            border:    `1px solid ${isOver ? 'oklch(60% 0.20 25 / 0.3)' : isLow ? 'oklch(60% 0.18 75 / 0.3)' : 'oklch(55% 0.16 155 / 0.3)'}`,
            color:      isOver ? 'oklch(35% 0.18 25)' : isLow ? 'oklch(38% 0.16 75)' : 'oklch(30% 0.14 155)',
          }}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span>{t('partnerPhoneNumbers.credits.financials.purchased', { amount: `$${(financials.purchasedCents / 100).toFixed(2)}` })}</span>
            <span>{t('partnerPhoneNumbers.credits.financials.spent',     { amount: `$${(financials.spentCents / 100).toFixed(2)}` })}</span>
            <span className="font-semibold">{t('partnerPhoneNumbers.credits.financials.net', { amount: `$${(financials.netCents / 100).toFixed(2)}` })}</span>
          </div>
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            {t(`partnerPhoneNumbers.credits.financials.status.${financials.status}`)}
          </span>
        </div>
      )}

      {isOver && (
        <div className="rounded-lg px-3 py-2 mb-3 text-xs"
             style={{ background: 'oklch(60% 0.20 25 / 0.10)', border: '1px solid oklch(60% 0.20 25 / 0.30)', color: 'oklch(35% 0.18 25)' }}>
          {t('partnerPhoneNumbers.credits.financials.overBudgetWarning')}
        </div>
      )}

      <PricingTable credits={credits} t={t} variant="full" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {(credits?.packs ?? [{ id: 'pack_5', credits: 500, unitAmountCents: 500 }, { id: 'pack_10', credits: 1200, unitAmountCents: 1000 }]).map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => hasCard && onBuy(p.id)}
            disabled={!hasCard || buyingPack !== null}
            className="text-left rounded-lg px-4 py-3"
            style={{
              background: hasCard ? 'oklch(55% 0.11 193)' : 'var(--surface-app)',
              color:      hasCard ? '#fff' : 'var(--text-tertiary)',
              border:     `1px solid ${hasCard ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)'}`,
              opacity:    buyingPack === p.id ? 0.6 : 1,
              cursor:     hasCard ? 'pointer' : 'not-allowed',
            }}
          >
            <div className="text-base font-bold">
              {t('partnerPhoneNumbers.credits.packCta', { credits: p.credits.toLocaleString(), price: `$${(p.unitAmountCents / 100).toFixed(2)}` })}
            </div>
            <div className="text-[11px] mt-0.5" style={{ opacity: hasCard ? 0.85 : 1 }}>
              {buyingPack === p.id
                ? t('partnerPhoneNumbers.credits.opening')
                : (hasCard ? t('partnerPhoneNumbers.credits.buyHelp') : t('partnerPhoneNumbers.credits.needCard'))}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] mt-3" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerPhoneNumbers.credits.rolloverNote')}
      </p>
    </div>
  )
}

// Pricing table — reused in two spots: the standalone SmsCreditsCard (full
// variant with column headers) and inline in the number-purchase panel
// (compact variant so partner can see SMS pricing before buying a number).
function PricingTable({
  credits, t, variant,
}: {
  credits: CreditsStatus | null
  t:       (k: string, v?: Record<string, string|number>) => string
  variant: 'full' | 'compact'
}) {
  const pack5  = credits?.packs?.find(p => p.id === 'pack_5')
  const pack10 = credits?.packs?.find(p => p.id === 'pack_10')
  const cost   = credits?.channelCost ?? { SMS: 1, SMS_LONG: 2, MMS: 2.5 }

  const rows: Array<{ key: string; label: string; perCredit: number }> = [
    { key: 'sms',     label: t('partnerPhoneNumbers.credits.row.sms'),     perCredit: cost.SMS      ?? 1   },
    { key: 'smsLong', label: t('partnerPhoneNumbers.credits.row.smsLong'), perCredit: cost.SMS_LONG ?? 2   },
    { key: 'mms',     label: t('partnerPhoneNumbers.credits.row.mms'),     perCredit: cost.MMS      ?? 2.5 },
  ]
  const c5  = pack5?.credits  ?? 500
  const c10 = pack10?.credits ?? 1200

  return (
    <div className={variant === 'compact' ? 'mt-3 mb-3' : 'mt-2 mb-2'}>
      {variant === 'compact' && (
        <p className="text-[11px] mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerPhoneNumbers.credits.compactHeading')}
        </p>
      )}
      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr style={{ background: 'var(--surface-overlay)' }}>
              <th className="px-3 py-2 text-left text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}></th>
              <th className="px-3 py-2 text-right text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.credits.col.pack5')}</th>
              <th className="px-3 py-2 text-right text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPhoneNumbers.credits.col.pack10')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)' }}>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{r.label}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{Math.floor(c5  / r.perCredit).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{Math.floor(c10 / r.perCredit).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Phase G.3 — voice-minute usage this 30-day cycle. Post-paid: the accrued
// amount is added to the partner's next monthly number-subscription invoice.
function VoiceUsageCard({
  usage, t,
}: {
  usage: VoiceUsage | null
  t:     (k: string, v?: Record<string, string|number>) => string
}) {
  const amount  = usage?.cycleAmountCents ?? 0
  const minutes = usage?.cycleMinutes ?? 0
  const calls   = usage?.cycleCallCount ?? 0
  const localRate = usage?.rateCents?.LOCAL ?? 2
  const tfRate    = usage?.rateCents?.TOLLFREE ?? 3

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerPhoneNumbers.voiceUsage.heading')}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('partnerPhoneNumbers.voiceUsage.subtitle', { local: (localRate / 100).toFixed(2), tollfree: (tfRate / 100).toFixed(2) })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            ${(amount / 100).toFixed(2)}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerPhoneNumbers.voiceUsage.cycleSummary', { minutes, calls })}
          </div>
        </div>
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerPhoneNumbers.voiceUsage.billedNote')}
      </p>
    </div>
  )
}

// WhatsApp coming-soon tile. Locked button, no purchase path yet.
function WhatsAppComingSoonCard({
  t,
}: {
  t: (k: string, v?: Record<string, string|number>) => string
}) {
  return (
    <div className="rounded-xl p-4 mb-6 flex items-center justify-between gap-3 flex-wrap"
         style={{ background: 'var(--surface-app)', border: '1px dashed var(--border-subtle)' }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('partnerPhoneNumbers.whatsapp.heading')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t('partnerPhoneNumbers.whatsapp.subtitle')}
        </p>
      </div>
      <button
        type="button"
        disabled
        className="text-xs font-semibold px-3 py-1.5 rounded-md"
        style={{ background: 'var(--surface-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', cursor: 'not-allowed' }}
      >
        {t('partnerPhoneNumbers.whatsapp.comingSoon')}
      </button>
    </div>
  )
}
