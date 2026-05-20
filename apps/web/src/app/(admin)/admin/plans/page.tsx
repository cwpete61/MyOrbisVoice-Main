'use client'

import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'

interface Entitlement {
  id: string
  key: string
  valueType: string
  booleanValue: boolean | null
  integerValue: number | null
  stringValue: string | null
}

interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  interval: string
  priceCents: number
  isActive: boolean
  entitlements: Entitlement[]
}

const ENTITLEMENT_META: Record<string, { label: string; section: string; type: 'boolean' | 'integer'; unit?: string }> = {
  // Channels
  widget_enabled:         { label: 'Widget',                       section: 'Channels',             type: 'boolean' },
  inbound_enabled:        { label: 'Inbound Phone',                section: 'Channels',             type: 'boolean' },
  outbound_enabled:       { label: 'Outbound Caller',              section: 'Channels',             type: 'boolean' },
  sms_enabled:            { label: 'SMS',                          section: 'Channels',             type: 'boolean' },
  max_phone_numbers:      { label: 'Max Phone Numbers',            section: 'Channels',             type: 'integer' },
  max_concurrent_calls:   { label: 'Max Concurrent Calls',         section: 'Channels',             type: 'integer' },
  max_channels:           { label: 'Max Channels',                 section: 'Channels',             type: 'integer' },
  // Agents & Staff
  max_agents:             { label: 'Max Agents',                   section: 'Agents & Staff',       type: 'integer' },
  max_seats:              { label: 'Max Team Seats',               section: 'Agents & Staff',       type: 'integer' },
  max_contacts:           { label: 'Max Contacts',                 section: 'Agents & Staff',       type: 'integer' },
  agent_handoff_enabled:  { label: 'Agent-to-Agent Handoff',       section: 'Agents & Staff',       type: 'boolean' },
  department_routing:     { label: 'Department Routing',           section: 'Agents & Staff',       type: 'boolean' },
  agent_scheduling:       { label: 'Agent Availability Schedule',  section: 'Agents & Staff',       type: 'boolean' },
  escalation_rules:       { label: 'Escalation Rules',             section: 'Agents & Staff',       type: 'boolean' },
  vip_caller_recognition: { label: 'VIP Caller Recognition',       section: 'Agents & Staff',       type: 'boolean' },
  agent_assignment:       { label: 'Agent Assignment to Staff',    section: 'Agents & Staff',       type: 'boolean' },
  live_call_monitoring:   { label: 'Live Call Monitoring',         section: 'Agents & Staff',       type: 'boolean' },
  call_takeover:          { label: 'Call Takeover',                section: 'Agents & Staff',       type: 'boolean' },
  // Locations
  multi_location:         { label: 'Multi-Location',               section: 'Locations',            type: 'boolean' },
  max_locations:          { label: 'Max Locations',                section: 'Locations',            type: 'integer' },
  // Apps
  mobile_app:             { label: 'Mobile App Access',            section: 'Apps',                 type: 'boolean' },
  desktop_app:            { label: 'Desktop App Access',           section: 'Apps',                 type: 'boolean' },
  push_notifications:     { label: 'Push Notifications',           section: 'Apps',                 type: 'boolean' },
  manager_dashboard:      { label: 'Manager Dashboard',            section: 'Apps',                 type: 'boolean' },
  // Data & Reporting
  minutes_per_month:      { label: 'Minutes / Month',              section: 'Data & Reporting',     type: 'integer', unit: 'min' },
  data_retention_months:  { label: 'Data Retention',              section: 'Data & Reporting',     type: 'integer', unit: 'months' },
  recording_storage_gb:   { label: 'Recording Storage',            section: 'Data & Reporting',     type: 'integer', unit: 'GB' },
  max_campaigns:          { label: 'Max Campaigns',                section: 'Data & Reporting',     type: 'integer' },
  sentiment_analysis:     { label: 'Sentiment Analysis',           section: 'Data & Reporting',     type: 'boolean' },
  agent_performance:      { label: 'Agent Performance Tracking',   section: 'Data & Reporting',     type: 'boolean' },
  audit_log_export:       { label: 'Audit Log Export',             section: 'Data & Reporting',     type: 'boolean' },
  conversion_tracking:    { label: 'Conversion Tracking',          section: 'Data & Reporting',     type: 'boolean' },
  // Integrations
  webhooks_enabled:       { label: 'Webhooks / Zapier',            section: 'Integrations',         type: 'boolean' },
  api_access:             { label: 'Direct API Access',            section: 'Integrations',         type: 'boolean' },
  affiliate_enabled:      { label: 'Partner Portal',               section: 'Integrations',         type: 'boolean' },
  campaigns_enabled:      { label: 'Campaigns',                    section: 'Integrations',         type: 'boolean' },
  // Branding
  white_label:            { label: 'White Label / Custom Branding', section: 'Branding',            type: 'boolean' },
  // Compliance & Support
  multi_calendar_booking: { label: 'Multi-Calendar Booking',       section: 'Agents & Staff',       type: 'boolean' },
  compliance_mode:        { label: 'Compliance Mode',              section: 'Compliance & Support', type: 'boolean' },
  sla_guarantee:          { label: 'SLA Guarantee (99.9%)',        section: 'Compliance & Support', type: 'boolean' },
  onboarding_assistance:  { label: 'Onboarding Assistance',        section: 'Compliance & Support', type: 'boolean' },
  priority_support:       { label: 'Priority Support',             section: 'Compliance & Support', type: 'boolean' },
  // ── Pricing & Quotas (managed Twilio model) ────────────────────────────
  // Inclusions: how much of each channel is included in the plan's monthly fee.
  // Overage cents: per-unit charge applied when usage exceeds the inclusion.
  // All values stored as cents (integer) to avoid float math.
  phone_number_monthly_cost_cents:   { label: 'Phone Number Monthly Cost',        section: 'Pricing & Quotas', type: 'integer', unit: '¢/number' },
  included_sms_per_month:            { label: 'SMS Included / Month',             section: 'Pricing & Quotas', type: 'integer', unit: 'msg' },
  sms_overage_per_message_cents:     { label: 'SMS Overage Rate',                 section: 'Pricing & Quotas', type: 'integer', unit: '¢/msg' },
  included_mms_per_month:            { label: 'MMS Included / Month',             section: 'Pricing & Quotas', type: 'integer', unit: 'msg' },
  mms_overage_per_message_cents:     { label: 'MMS Overage Rate',                 section: 'Pricing & Quotas', type: 'integer', unit: '¢/msg' },
  included_whatsapp_per_month:       { label: 'WhatsApp Included / Month',        section: 'Pricing & Quotas', type: 'integer', unit: 'msg' },
  whatsapp_overage_per_message_cents:{ label: 'WhatsApp Overage Rate',            section: 'Pricing & Quotas', type: 'integer', unit: '¢/msg' },
  voice_overage_per_minute_cents:    { label: 'Voice Overage Rate',               section: 'Pricing & Quotas', type: 'integer', unit: '¢/min' },
  whatsapp_enabled:                  { label: 'WhatsApp Channel',                 section: 'Channels',         type: 'boolean' },
  mms_enabled:                       { label: 'MMS Channel',                      section: 'Channels',         type: 'boolean' },
}

const SECTION_ORDER = [
  'Channels', 'Pricing & Quotas', 'Agents & Staff', 'Locations', 'Apps',
  'Data & Reporting', 'Integrations', 'Branding', 'Compliance & Support',
]

const PLAN_ORDER = ['ltd', 'basic_monthly', 'pro_monthly', 'premier_monthly', 'enterprise_monthly']

function formatPrice(plan: Plan) {
  if (plan.interval === 'ONE_TIME') return `$${(plan.priceCents / 100).toFixed(0)} one-time`
  return `$${(plan.priceCents / 100).toFixed(0)}/mo`
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none"
      style={{ background: checked ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)' }}
      aria-pressed={checked}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

export default function AdminPlansPage() {
  const { data: plans, loading, reload } = useApi<Plan[]>('/api/admin/plans')
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [editingSections, setEditingSections] = useState<Record<string, Record<string, boolean>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleCollapsed(planId: string) {
    setCollapsed(prev => ({ ...prev, [planId]: !(prev[planId] ?? false) }))
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  function isSectionEditing(planId: string, section: string) {
    return editingSections[planId]?.[section] ?? false
  }

  function startSectionEdit(plan: Plan, section: string, sectionEntitlements: Entitlement[]) {
    const d: Record<string, string> = { ...(drafts[plan.id] ?? {}) }
    for (const e of sectionEntitlements) {
      if (!(e.key in d)) {
        if (e.booleanValue !== null) d[e.key] = e.booleanValue ? 'true' : 'false'
        else if (e.integerValue !== null) d[e.key] = String(e.integerValue)
        else d[e.key] = e.stringValue ?? ''
      }
    }
    setDrafts(prev => ({ ...prev, [plan.id]: d }))
    setEditingSections(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], [section]: true } }))
  }

  function cancelSectionEdit(planId: string, section: string) {
    setEditingSections(prev => ({ ...prev, [planId]: { ...prev[planId], [section]: false } }))
  }

  function setDraft(planId: string, key: string, value: string) {
    setDrafts(prev => ({ ...prev, [planId]: { ...prev[planId], [key]: value } }))
  }

  async function saveSection(plan: Plan, section: string, sectionEntitlements: Entitlement[]) {
    const saveKey = `${plan.id}:${section}`
    setSaving(saveKey)
    try {
      const d = drafts[plan.id] ?? {}
      const updates = sectionEntitlements.map(e => {
        const raw = d[e.key]
        if (raw === undefined) return null
        const meta = ENTITLEMENT_META[e.key]
        if (meta?.type === 'boolean') return { key: e.key, booleanValue: raw === 'true' }
        const n = Number(raw)
        if (!Number.isNaN(n)) return { key: e.key, integerValue: n }
        return { key: e.key, stringValue: raw }
      }).filter(Boolean)

      await apiFetch(`/api/admin/plans/${plan.id}/entitlements`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      })
      await reload()
      cancelSectionEdit(plan.id, section)
      showToast('success', `${plan.name} — ${section} saved.`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 pt-2 animate-pulse">
        {[200, 140, 180].map(w => (
          <div key={w} className="h-4 rounded" style={{ width: `${w}px`, background: 'var(--border-subtle)' }} />
        ))}
      </div>
    )
  }

  const sorted = [...(plans ?? [])].sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Plans & Entitlements</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Enterprise is the ceiling — every switch ON, every quantity at max. Lower tiers are built by editing sections below.
        </p>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>
      )}

      <div className="space-y-8">
        {sorted.map(plan => {
          // Group entitlements by section
          const bySection: Record<string, Entitlement[]> = {}
          for (const e of plan.entitlements) {
            const section = ENTITLEMENT_META[e.key]?.section ?? 'Other'
            if (!bySection[section]) bySection[section] = []
            bySection[section].push(e)
          }
          const sections = [...SECTION_ORDER, 'Other'].filter(s => bySection[s]?.length)

          return (
            <div key={plan.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              {/* Plan header — clickable accordion */}
              <button
                data-testid="plan-accordion-toggle"
                onClick={() => toggleCollapsed(plan.id)}
                className="w-full text-left px-6 py-4"
                style={{ background: 'var(--surface-raised)', borderBottom: !collapsed[plan.id] ? 'none' : '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{plan.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }}>
                    {formatPrice(plan)}
                  </span>
                  {!plan.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>Inactive</span>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    style={{ color: 'var(--text-tertiary)', flexShrink: 0, transition: 'transform 0.2s', transform: collapsed[plan.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {plan.description && (
                  <p className="text-xs mt-0.5 text-left" style={{ color: 'var(--text-tertiary)' }}>{plan.description}</p>
                )}
              </button>

              {/* Sections */}
              {collapsed[plan.id] && <div style={{ background: 'var(--surface-base)' }}>
                {sections.map((section, si) => {
                  const entitlements = bySection[section] ?? []
                  const isEditing = isSectionEditing(plan.id, section)
                  const saveKey = `${plan.id}:${section}`
                  const d = drafts[plan.id] ?? {}

                  return (
                    <div
                      key={section}
                      className="px-6 py-5"
                      style={{ borderTop: si === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                    >
                      {/* Section header */}
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                          {section}
                        </p>
                        {!isEditing ? (
                          <button
                            onClick={() => startSectionEdit(plan, section, entitlements)}
                            className="text-xs px-2.5 py-1 rounded transition-colors"
                            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveSection(plan, section, entitlements)}
                              disabled={saving === saveKey}
                              className="btn-primary text-xs py-1 px-3"
                            >
                              {saving === saveKey ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => cancelSectionEdit(plan.id, section)}
                              className="btn-secondary text-xs py-1 px-3"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Entitlement rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
                        {entitlements.map(e => {
                          const meta = ENTITLEMENT_META[e.key]
                          const label = meta?.label ?? e.key
                          const unit = meta?.unit ?? ''
                          const isBool = meta?.type === 'boolean'
                          const rawVal = e.booleanValue !== null
                            ? (e.booleanValue ? 'true' : 'false')
                            : e.integerValue !== null ? String(e.integerValue)
                            : e.stringValue ?? ''
                          const draftVal = d[e.key] ?? rawVal

                          return (
                            <div key={e.key} className="flex items-center justify-between gap-4 min-w-0">
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                              {isEditing ? (
                                isBool ? (
                                  <Toggle
                                    checked={draftVal === 'true'}
                                    onChange={v => setDraft(plan.id, e.key, v ? 'true' : 'false')}
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <input
                                      type="number"
                                      value={draftVal}
                                      onChange={ev => setDraft(plan.id, e.key, ev.target.value)}
                                      className="input text-xs py-1 w-24 text-right"
                                    />
                                    {unit && <span className="text-xs w-10" style={{ color: 'var(--text-tertiary)' }}>{unit}</span>}
                                  </div>
                                )
                              ) : (
                                isBool ? (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded flex-shrink-0 font-medium"
                                    style={rawVal === 'true'
                                      ? { background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }
                                      : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
                                    }
                                  >
                                    {rawVal === 'true' ? 'ON' : 'OFF'}
                                  </span>
                                ) : (
                                  <span className="text-sm font-mono flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                                    {Number(rawVal).toLocaleString()}{unit ? ` ${unit}` : ''}
                                  </span>
                                )
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
