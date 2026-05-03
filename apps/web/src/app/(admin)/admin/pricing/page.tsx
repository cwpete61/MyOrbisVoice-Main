'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface Entitlement {
  key: string
  valueType: 'INTEGER' | 'BOOLEAN' | 'STRING'
  integerValue: number | null
  booleanValue: boolean | null
  stringValue: string | null
}
interface Plan {
  id: string
  code: string
  name: string
  entitlements: Entitlement[]
}

// Field definitions: which entitlement keys appear in the matrix, in this order.
type FieldType = 'integer' | 'boolean'
interface FieldDef {
  key: string
  label: string
  type: FieldType
  unit?: string
  twilioCostHint?: string
  group: 'Telephony' | 'Voice' | 'SMS' | 'MMS' | 'WhatsApp'
}

const FIELDS: FieldDef[] = [
  // Telephony / number rental
  { key: 'phone_number_monthly_cost_cents', label: 'Number rental',          type: 'integer', unit: '¢/mo',  twilioCostHint: 'Twilio cost: $1.15/mo (US local), $2.00/mo (toll-free)', group: 'Telephony' },

  // Voice
  { key: 'minutes_per_month',               label: 'Voice minutes included', type: 'integer', unit: 'min',                                                                          group: 'Voice' },
  { key: 'voice_overage_per_minute_cents',  label: 'Voice overage rate',     type: 'integer', unit: '¢/min', twilioCostHint: 'Twilio: $0.0085 in / $0.014 out / $0.022 toll-free', group: 'Voice' },

  // SMS
  { key: 'included_sms_per_month',          label: 'SMS included',           type: 'integer', unit: 'msg',                                                                          group: 'SMS' },
  { key: 'sms_overage_per_message_cents',   label: 'SMS overage rate',       type: 'integer', unit: '¢/msg', twilioCostHint: 'Twilio: ~$0.0083 + carrier fees',                    group: 'SMS' },

  // MMS
  { key: 'mms_enabled',                     label: 'MMS channel enabled',    type: 'boolean',                                                                                       group: 'MMS' },
  { key: 'included_mms_per_month',          label: 'MMS included',           type: 'integer', unit: 'msg',                                                                          group: 'MMS' },
  { key: 'mms_overage_per_message_cents',   label: 'MMS overage rate',       type: 'integer', unit: '¢/msg', twilioCostHint: 'Twilio: ~$0.022 + carrier fees',                     group: 'MMS' },

  // WhatsApp
  { key: 'whatsapp_enabled',                  label: 'WhatsApp channel enabled', type: 'boolean',                                                                                  group: 'WhatsApp' },
  { key: 'included_whatsapp_per_month',       label: 'WhatsApp included',        type: 'integer', unit: 'msg',                                                                    group: 'WhatsApp' },
  { key: 'whatsapp_overage_per_message_cents',label: 'WhatsApp overage rate',    type: 'integer', unit: '¢/msg', twilioCostHint: 'Twilio: ~$0.005 + Meta conversation fees',     group: 'WhatsApp' },
]

// Order tiers cheapest → most expensive. Plans not in this list still render at the end.
const TIER_ORDER = ['free', 'basic_monthly', 'pro_monthly', 'ltd', 'premier_monthly', 'enterprise_monthly']

type DraftValue = { integerValue?: number | null; booleanValue?: boolean | null }
type Drafts = Record<string /* planId */, Record<string /* key */, DraftValue>>

export default function PricingMatrixPage() {
  const { data: plans, loading, reload } = useApi<Plan[]>('/api/admin/plans')
  const [drafts, setDrafts] = useState<Drafts>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const orderedPlans = useMemo(() => {
    if (!plans) return []
    const sorted = [...plans].sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a.code)
      const bi = TIER_ORDER.indexOf(b.code)
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return sorted
  }, [plans])

  function getEnt(plan: Plan, key: string): Entitlement | undefined {
    return plan.entitlements.find(e => e.key === key)
  }

  function getDraftedValue(plan: Plan, field: FieldDef): { integerValue: number | null; booleanValue: boolean | null } {
    const draft = drafts[plan.id]?.[field.key]
    const ent = getEnt(plan, field.key)
    return {
      integerValue: draft?.integerValue !== undefined ? draft.integerValue : (ent?.integerValue ?? null),
      booleanValue: draft?.booleanValue !== undefined ? draft.booleanValue : (ent?.booleanValue ?? null),
    }
  }

  function setDraft(planId: string, key: string, value: DraftValue) {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], [key]: value } }))
  }

  function clearDrafts() {
    setDrafts({})
  }

  function hasChanges(): boolean {
    return Object.values(drafts).some(planDrafts => Object.keys(planDrafts).length > 0)
  }

  async function saveAll() {
    if (!hasChanges()) return
    setSaving(true)
    let successCount = 0
    let failCount = 0

    for (const [planId, planDrafts] of Object.entries(drafts)) {
      const updates = Object.entries(planDrafts).map(([key, val]) => {
        const update: { key: string; integerValue?: number | null; booleanValue?: boolean | null } = { key }
        if ('integerValue' in val) update.integerValue = val.integerValue
        if ('booleanValue' in val) update.booleanValue = val.booleanValue
        return update
      })
      if (!updates.length) continue
      try {
        const res = await apiFetchRaw(`/api/admin/plans/${planId}/entitlements`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    if (failCount === 0) {
      setToast({ type: 'success', text: `Saved changes to ${successCount} plan${successCount !== 1 ? 's' : ''}.` })
      clearDrafts()
      reload()
    } else {
      setToast({ type: 'error', text: `Saved ${successCount}, failed ${failCount}. Check console.` })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-7xl">
        {[280, 200, 320, 240, 200].map((w, i) => (
          <div key={i} className="h-5 rounded" style={{ width: `${w}px`, background: 'var(--border-subtle)' }} />
        ))}
      </div>
    )
  }

  if (!orderedPlans.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No plans configured.</p>
  }

  // Group fields by category for visual section breaks.
  const groups: { name: string; fields: FieldDef[] }[] = []
  let currentGroup = ''
  for (const f of FIELDS) {
    if (f.group !== currentGroup) {
      groups.push({ name: f.group, fields: [f] })
      currentGroup = f.group
    } else {
      groups[groups.length - 1]!.fields.push(f)
    }
  }

  const cellInputCls = 'rounded text-sm font-mono'
  const cellInputStyle: React.CSSProperties = {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    padding: '4px 8px',
    width: '100%',
    minWidth: '70px',
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pricing Matrix</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Edit prices and monthly quotas across every tier. Twilio reference costs shown beneath rate fields.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges() && (
            <button
              onClick={clearDrafts}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Discard
            </button>
          )}
          <button
            onClick={saveAll}
            disabled={!hasChanges() || saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : hasChanges() ? 'Save changes' : 'No changes'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background:  toast.type === 'success' ? 'oklch(95% 0.05 160)' : 'oklch(95% 0.05 25)',
            color:       toast.type === 'success' ? 'oklch(35% 0.16 160)' : 'oklch(35% 0.16 25)',
            border:      toast.type === 'success' ? '1px solid oklch(80% 0.10 160)' : '1px solid oklch(80% 0.10 25)',
          }}
        >
          {toast.text}
        </div>
      )}

      <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-sm" style={{ minWidth: '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="text-left px-5 py-3 font-medium sticky left-0 z-10" style={{ color: 'var(--text-tertiary)', background: 'var(--surface-raised)', minWidth: '240px' }}>
                Field
              </th>
              {orderedPlans.map(p => (
                <th key={p.id} className="text-left px-3 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {p.name}
                  <p className="text-xs font-normal mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{p.code}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => (
              <tbody key={group.name}>
                <tr style={{ background: 'var(--surface-sunken)' }}>
                  <td colSpan={orderedPlans.length + 1} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                    {group.name}
                  </td>
                </tr>
                {group.fields.map(field => (
                  <tr key={field.key} style={{ borderTop: gi === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                    <td className="px-5 py-3 sticky left-0 z-10" style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                      <p style={{ color: 'var(--text-primary)' }}>{field.label}</p>
                      {field.unit && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{field.unit}</p>}
                      {field.twilioCostHint && <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{field.twilioCostHint}</p>}
                    </td>
                    {orderedPlans.map(plan => {
                      const value = getDraftedValue(plan, field)
                      const draft = drafts[plan.id]?.[field.key]
                      const isDirty = draft !== undefined
                      return (
                        <td
                          key={plan.id}
                          className="px-3 py-3"
                          style={{ borderTop: '1px solid var(--border-subtle)', background: isDirty ? 'oklch(96% 0.05 75)' : 'transparent' }}
                        >
                          {field.type === 'integer' ? (
                            <input
                              className={cellInputCls}
                              style={cellInputStyle}
                              type="number"
                              min="0"
                              step="1"
                              value={value.integerValue ?? ''}
                              onChange={e => {
                                const v = e.target.value
                                setDraft(plan.id, field.key, { integerValue: v === '' ? null : parseInt(v, 10) })
                              }}
                            />
                          ) : (
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!value.booleanValue}
                                onChange={e => setDraft(plan.id, field.key, { booleanValue: e.target.checked })}
                              />
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {value.booleanValue ? 'On' : 'Off'}
                              </span>
                            </label>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Tip: edit any cell, then click <strong>Save changes</strong>. Dirty cells are highlighted. Per-tenant overrides are not affected — those live on each tenant's record.
      </p>
    </div>
  )
}
