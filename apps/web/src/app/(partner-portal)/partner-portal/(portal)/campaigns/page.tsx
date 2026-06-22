'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { InboundEvaluation } from '@/components/InboundEvaluation'
import { EvaluationInstructions } from '@/components/EvaluationInstructions'
import { MarketingStrategy } from '@/components/MarketingStrategy'
import { GraphicsStudio } from '@/components/GraphicsStudio'
import { GroupsManager } from '@/components/GroupsManager'
import { ColdCallConsole } from '@/components/ColdCallConsole'

interface Campaign {
  id: string
  name: string
  subject: string
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  totalRecipients: number
  sentCount: number
  bouncedCount: number
  complainedCount: number
  skippedCount: number
  createdAt: string
}

interface CampaignList {
  items: Campaign[]
  total: number
}

interface PartnerPolicy {
  bulkEnabled: boolean
  suspended: boolean
  suspendedReason: string | null
  dailyCap: number
  sendWindowStartHour: number
  sendWindowEndHour: number
  dripIntervalSecs: number
}

const STATUS_COLORS: Record<Campaign['status'], string> = {
  DRAFT:     'oklch(95% 0 0)',
  SCHEDULED: 'oklch(95% 0.04 250)',
  RUNNING:   'oklch(92% 0.10 145)',
  PAUSED:    'oklch(95% 0.08 80)',
  COMPLETED: 'oklch(95% 0.05 145)',
  FAILED:    'oklch(95% 0.05 25)',
  CANCELED:  'oklch(93% 0 0)',
}

export default function PartnerCampaignsListPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const { data, loading, error } = useApi<CampaignList>('/api/partner/campaigns', [])
  const { data: policy } = useApi<PartnerPolicy>('/api/partner/email-policy', [])
  const [tab, setTab] = useState<'email' | 'inbound'>('email')
  const [sub, setSub] = useState<'eval' | 'instructions' | 'marketing' | 'graphics' | 'groups' | 'coldcall'>('eval')

  return (
    <div className="space-y-6">
      {/* Tabs — Email campaigns | Inbound Evaluation */}
      <div className="flex items-center gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {([['email', t('partnerCampaigns.title')], ['inbound', t('partnerCampaigns.tabInbound')]] as const).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              marginBottom: '-1px',
              borderBottom: `2px solid ${tab === key ? 'var(--brand-500, oklch(55% 0.11 193))' : 'transparent'}`,
              color: tab === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'inbound' ? (
        <div className="space-y-5">
          {/* Sub-tabs — Lead Capture Evaluation | Instructions | Marketing Strategy */}
          <div className="flex items-center gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {([['eval', t('partnerCampaigns.subLeadCapture')], ['instructions', t('partnerCampaigns.tabInstructions')], ['marketing', t('partnerCampaigns.subMarketing')], ['graphics', t('partnerCampaigns.subGraphics')], ['groups', t('partnerCampaigns.subGroups')], ['coldcall', t('partnerCampaigns.subColdCall')]] as const).map(([key, label]) => (
              <button
                key={key} onClick={() => setSub(key)}
                className="px-3.5 py-2 text-sm font-medium transition-colors"
                style={{
                  marginBottom: '-1px',
                  borderBottom: `2px solid ${sub === key ? 'var(--brand-500, oklch(55% 0.11 193))' : 'transparent'}`,
                  color: sub === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {sub === 'eval' ? <InboundEvaluation /> : sub === 'instructions' ? <EvaluationInstructions /> : sub === 'marketing' ? <MarketingStrategy /> : sub === 'graphics' ? <GraphicsStudio /> : sub === 'groups' ? <GroupsManager /> : <ColdCallConsole />}
        </div>
      ) : <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('partnerCampaigns.subtitle')}
        </p>
        {policy?.bulkEnabled && !policy.suspended && (
          <Link href="/partner-portal/campaigns/new" className="btn-primary">
            {t('partnerCampaigns.newCampaign')}
          </Link>
        )}
      </div>

      {/* Status panel — shows resolved limits + bulk-enabled gate */}
      {policy && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerCampaigns.limitsHeading')}</h2>
          {!policy.bulkEnabled && (
            <p className="text-sm" style={{ color: 'var(--error-600)' }}>
              {t('partnerCampaigns.bulkDisabled')}
            </p>
          )}
          {policy.suspended && (
            <p className="text-sm" style={{ color: 'var(--error-600)' }}>
              {t('partnerCampaigns.bulkSuspended')} {policy.suspendedReason}
            </p>
          )}
          {policy.bulkEnabled && !policy.suspended && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Stat label={t('partnerCampaigns.dailyCap')} value={`${policy.dailyCap}`} />
              <Stat label={t('partnerCampaigns.sendWindow')} value={`${policy.sendWindowStartHour}:00 – ${policy.sendWindowEndHour}:00`} />
              <Stat label={t('partnerCampaigns.dripInterval')} value={t('partnerCampaigns.secondsBetween', { n: policy.dripIntervalSecs })} />
              <Stat label={t('partnerCampaigns.adminControlled')} value={t('partnerCampaigns.readOnly')} />
            </div>
          )}
        </div>
      )}

      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error && <div className="alert-error">{error}</div>}

      {!loading && data && data.items.length === 0 && (
        <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerCampaigns.empty')}</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[
                  t('partnerCampaigns.table.name'),
                  t('partnerCampaigns.table.status'),
                  t('partnerCampaigns.table.progress'),
                  t('partnerCampaigns.table.bounces'),
                  t('partnerCampaigns.table.created'),
                ].map((label, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    <Link href={`/partner-portal/campaigns/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{c.subject}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: STATUS_COLORS[c.status], color: '#333' }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {c.sentCount} / {c.totalRecipients}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: c.bouncedCount > 0 ? 'var(--error-600)' : 'var(--text-tertiary)' }}>
                    {c.bouncedCount + c.complainedCount}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(c.createdAt).toLocaleDateString(dateLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
