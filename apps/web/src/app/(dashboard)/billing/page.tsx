'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Plan {
  id: string
  code: string
  name: string
  interval: string
  stripePriceId: string | null
  entitlements: Array<{ key: string; valueType: string; booleanValue: boolean | null; integerValue: number | null; stringValue: string | null }>
}

interface Subscription {
  id: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  plan: Plan
}

const ENTITLEMENT_LABELS: Record<string, string> = {
  max_channels: 'Max channels',
  max_agents: 'Max agents',
  minutes_per_month: 'Minutes / month',
  widget_enabled: 'Website widget',
  inbound_enabled: 'Inbound receptionist',
  outbound_enabled: 'Outbound caller',
  affiliate_enabled: 'Affiliate portal',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
  TRIALING: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  PAST_DUE: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
  CANCELED: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
  INCOMPLETE: 'text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
}

function formatEntitlementValue(e: Plan['entitlements'][0]) {
  if (e.valueType === 'BOOLEAN') return e.booleanValue ? '✓' : '✗'
  if (e.valueType === 'INTEGER') return String(e.integerValue ?? 0)
  return e.stringValue ?? '—'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BillingPage() {
  const { data: subscription, loading: subLoading } = useApi<Subscription | null>('/api/billing/subscription')
  const { data: plans, loading: plansLoading } = useApi<Plan[]>('/api/billing/plans')
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  async function startCheckout(planCode: string) {
    setUpgrading(planCode)
    setError('')
    try {
      const result = await apiFetch<{ url: string }>('/api/billing/checkout-session', {
        method: 'POST',
        body: JSON.stringify({ planCode }),
      })
      window.location.href = result.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setUpgrading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setError('')
    try {
      const result = await apiFetch<{ url: string }>('/api/billing/portal-session', { method: 'POST' })
      window.location.href = result.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  if (subLoading || plansLoading) {
    return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Billing</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage your subscription and plan</p>

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {subscription ? (
        <div className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">{subscription.plan.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subscription.plan.interval === 'MONTHLY' ? 'Monthly billing' : 'Annual billing'}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[subscription.status] ?? STATUS_COLORS.INCOMPLETE}`}>
              {subscription.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Current period</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            {subscription.cancelAtPeriodEnd && (
              <div>
                <p className="text-yellow-700 dark:text-yellow-400 font-medium">Cancels at period end</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {subscription.plan.entitlements.map((e) => (
              <div key={e.key} className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                <p className="text-gray-500 dark:text-gray-400">{ENTITLEMENT_LABELS[e.key] ?? e.key}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatEntitlementValue(e)}</p>
              </div>
            ))}
          </div>

          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {portalLoading ? 'Opening…' : 'Manage subscription'}
          </button>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-800 dark:text-yellow-400">
          No active subscription. Choose a plan below to get started.
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Available plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(plans ?? []).map((plan) => {
          const isCurrent = subscription?.plan.code === plan.code
          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-gray-900 border rounded-xl p-5 flex flex-col ${isCurrent ? 'border-blue-400 ring-1 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{plan.interval === 'MONTHLY' ? 'per month' : 'per year'}</p>
              </div>
              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.entitlements.map((e) => (
                  <li key={e.key} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span className={e.valueType === 'BOOLEAN' ? (e.booleanValue ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-gray-600') : 'text-blue-600 dark:text-blue-400'}>
                      {e.valueType === 'BOOLEAN' ? (e.booleanValue ? '✓' : '✗') : '●'}
                    </span>
                    <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}{e.valueType !== 'BOOLEAN' ? `: ${e.integerValue ?? e.stringValue ?? '—'}` : ''}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="text-xs text-center text-blue-600 dark:text-blue-400 font-medium py-2">Current plan</span>
              ) : (
                <button
                  onClick={() => startCheckout(plan.code)}
                  disabled={upgrading !== null || !plan.stripePriceId}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 text-center"
                >
                  {upgrading === plan.code ? 'Redirecting…' : plan.stripePriceId ? 'Select plan' : 'Coming soon'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
