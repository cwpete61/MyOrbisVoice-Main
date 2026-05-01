'use client'

import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CampaignTemplate {
  id: string
  vertical: string
  campaignType: string
  name: string
  description: string
  defaultPrompt: string
  defaultTriggerTag: string
  defaultDelayHours: number
  defaultMaxRetries: number
  defaultRetryIntervalHours: number
  suggestedTagsJson: string[] | null
}

interface Campaign {
  id: string
  campaignType: string
  name: string
  description: string | null
  prompt: string
  triggerTag: string
  delayHours: number
  maxRetries: number
  retryIntervalHours: number
  isActive: boolean
  createdAt: string
  template: { name: string; vertical: string } | null
  _count: { enrollments: number }
}

interface Enrollment {
  id: string
  status: string
  triggerTag: string
  triggeredAt: string
  scheduledCallAt: string | null
  attemptCount: number
  contact: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; email: string | null; phoneE164: string | null }
  campaign: { id: string; name: string; campaignType: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VERTICAL_LABELS: Record<string, string> = {
  GENERAL: 'General', LEGAL: 'Legal', DENTAL: 'Dental', MEDICAL: 'Medical / Clinic',
  FINANCIAL: 'Financial Services', HOME_SERVICES: 'Home Services', AUTO_REPAIR: 'Auto Repair',
  REAL_ESTATE: 'Real Estate', FITNESS: 'Fitness & Gym', BEAUTY: 'Beauty & Wellness',
  EDUCATION: 'Education', HOSPITALITY: 'Hospitality', VETERINARY: 'Veterinary',
  CHILDCARE: 'Childcare / Nursery', ACCOUNTING: 'Accounting / Tax',
  INSURANCE: 'Insurance', PROPERTY_MANAGEMENT: 'Property Management',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-800', OPTED_OUT: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color ?? 'bg-gray-100 text-gray-700'}`}>{label}</span>
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type View = 'library' | 'mine' | 'enrollments'

export default function CampaignsPage() {
  const [view, setView] = useState<View>('mine')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showMsg(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Automated voice follow-ups, confirmations, and outreach — triggered by contact tags.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>How Campaigns Work</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Browse the Template Library', body: 'Pick a pre-built campaign that fits your business. Each template includes a prompt, trigger tag, delay, and retry schedule.' },
            { step: '2', title: 'Add it to My Campaigns', body: 'Click "+ Add to My Campaigns" to copy the template into your account. Customize the prompt and settings to match your tone.' },
            { step: '3', title: 'Activate the Campaign', body: 'Toggle the campaign on. It will only fire calls once it is active — inactive campaigns are saved but never triggered.' },
            { step: '4', title: 'Tags Trigger the Calls', body: 'When a contact receives the campaign\'s trigger tag (manually or via a call outcome), a follow-up call is automatically scheduled.' },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}>
                {step}
              </div>
              <div>
                <p className="text-xs font-semibold italic" style={{ color: 'oklch(55% 0.11 193)' }}>{title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['mine', 'My Campaigns'], ['library', 'Template Library'], ['enrollments', 'Enrollments']] as [View, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'library'     && <TemplateLibrary onMsg={showMsg} />}
      {view === 'mine'        && <MyCampaigns onMsg={showMsg} />}
      {view === 'enrollments' && <Enrollments />}
    </div>
  )
}

// ── Template Library ──────────────────────────────────────────────────────────
const VERTICAL_ORDER = [
  'GENERAL','LEGAL','DENTAL','MEDICAL','FINANCIAL','HOME_SERVICES','AUTO_REPAIR',
  'REAL_ESTATE','FITNESS','BEAUTY','EDUCATION','HOSPITALITY',
  'VETERINARY','CHILDCARE','ACCOUNTING','INSURANCE','PROPERTY_MANAGEMENT',
]

function TemplateLibrary({ onMsg }: { onMsg: (t: 'success' | 'error', m: string) => void }) {
  const { data: allTemplates, loading, error } = useApi<CampaignTemplate[]>('/api/campaigns/templates')
  const [activating, setActivating]   = useState<string | null>(null)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [activeVertical, setActiveVertical] = useState('GENERAL')

  // Build counts per vertical from full template list
  const countsByVertical: Record<string, number> = {}
  for (const t of allTemplates ?? []) {
    countsByVertical[t.vertical] = (countsByVertical[t.vertical] ?? 0) + 1
  }
  // Verticals that actually have templates, in preferred order
  const presentVerticals = VERTICAL_ORDER.filter(v => countsByVertical[v])

  // Filter by vertical tab + search
  const query = search.toLowerCase().trim()
  const filtered = (allTemplates ?? []).filter(t => {
    const matchesVertical = t.vertical === activeVertical
    const matchesSearch   = !query ||
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.defaultTriggerTag.toLowerCase().includes(query)
    return matchesVertical && matchesSearch
  })

  // Group filtered results by vertical
  const grouped: Record<string, CampaignTemplate[]> = {}
  for (const t of filtered) {
    ;(grouped[t.vertical] ??= []).push(t)
  }
  const groupedEntries = VERTICAL_ORDER
    .filter(v => grouped[v])
    .map(v => [v, grouped[v]!] as [string, CampaignTemplate[]])

  async function activateTemplate(t: CampaignTemplate) {
    setActivating(t.id)
    try {
      await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          templateId:         t.id,
          campaignType:       t.campaignType,
          name:               t.name,
          description:        t.description,
          prompt:             t.defaultPrompt,
          triggerTag:         t.defaultTriggerTag,
          delayHours:         t.defaultDelayHours,
          maxRetries:         t.defaultMaxRetries,
          retryIntervalHours: t.defaultRetryIntervalHours,
          isActive:           false,
        }),
      })
      onMsg('success', `"${t.name}" added to My Campaigns — customize and activate it there.`)
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : 'Failed to add campaign')
    } finally { setActivating(null) }
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading templates…</div>
  if (error)   return <div className="text-sm text-red-600 py-8 text-center">{error}</div>

  return (
    <div className="space-y-5">

      {/* Search bar */}
      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates by name, description, or tag…"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        )}
      </div>

      {/* Vertical tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {presentVerticals.map(v => (
          <button
            key={v}
            onClick={() => setActiveVertical(v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeVertical === v ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {VERTICAL_LABELS[v] ?? v}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeVertical === v ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>{countsByVertical[v]}</span>
          </button>
        ))}
      </div>

      {/* Results summary */}
      <p className="text-xs text-gray-400">
        {!search
          ? `${filtered.length} template${filtered.length !== 1 ? 's' : ''} in ${VERTICAL_LABELS[activeVertical] ?? activeVertical}`
          : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
      </p>

      {/* Template cards */}
      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
          No templates match your search.
        </div>
      )}

      {groupedEntries.map(([vertical, items]) => (
        <div key={vertical}>
          {/* Section header — only show when search spans multiple verticals */}
          {query && groupedEntries.length > 1 && (
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {VERTICAL_LABELS[vertical] ?? vertical}
              </h2>
              <span className="text-xs text-gray-400">{items.length} template{items.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-xs leading-snug">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{t.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-gray-500 mt-auto pt-1">
                    <span className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-gray-600 truncate max-w-full">{t.defaultTriggerTag}</span>
                    <span className="bg-gray-100 rounded px-1.5 py-0.5">{t.defaultDelayHours}h delay</span>
                    <span className="bg-gray-100 rounded px-1.5 py-0.5">{t.defaultMaxRetries} retries</span>
                  </div>
                </div>

                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    {expanded === t.id ? '▲ Hide prompt' : '▼ Preview prompt'}
                  </button>
                  {expanded === t.id && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 leading-relaxed">{t.defaultPrompt}</p>
                    </div>
                  )}
                  <button
                    onClick={() => activateTemplate(t)}
                    disabled={activating === t.id}
                    className="w-full px-3 py-2 bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {activating === t.id ? 'Adding…' : '+ Add to My Campaigns'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── My Campaigns ──────────────────────────────────────────────────────────────
function MyCampaigns({ onMsg }: { onMsg: (t: 'success' | 'error', m: string) => void }) {
  const { data: campaigns, loading, error, reload } = useApi<Campaign[]>('/api/campaigns')
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const blankForm = { campaignType: 'FOLLOWUP_CUSTOMER_SERVICE', name: '', description: '', prompt: '', triggerTag: '', delayHours: 1, maxRetries: 2, retryIntervalHours: 24, isActive: false }
  const [form, setForm] = useState(blankForm)

  function startEdit(c: Campaign) {
    setEditing(c)
    setForm({ campaignType: c.campaignType, name: c.name, description: c.description ?? '', prompt: c.prompt, triggerTag: c.triggerTag, delayHours: c.delayHours, maxRetries: c.maxRetries, retryIntervalHours: c.retryIntervalHours, isActive: c.isActive })
    setShowNew(false)
  }

  function startNew() {
    setEditing(null)
    setForm(blankForm)
    setShowNew(true)
  }

  async function save() {
    if (!form.name || !form.prompt || !form.triggerTag) { onMsg('error', 'Name, prompt, and trigger tag are required.'); return }
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/api/campaigns/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
        onMsg('success', 'Campaign updated.')
      } else {
        await apiFetch('/api/campaigns', { method: 'POST', body: JSON.stringify(form) })
        onMsg('success', 'Campaign created.')
      }
      reload()
      setEditing(null)
      setShowNew(false)
    } catch (err) { onMsg('error', err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function toggleActive(c: Campaign) {
    try {
      await apiFetch(`/api/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) })
      reload()
    } catch (err) { onMsg('error', err instanceof Error ? err.message : 'Failed') }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign? Existing enrollments will also be removed.')) return
    setDeleting(id)
    try {
      await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      reload()
      if (editing?.id === id) { setEditing(null); setShowNew(false) }
      onMsg('success', 'Campaign deleted.')
    } catch (err) { onMsg('error', err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>
  if (error)   return <div className="text-sm text-red-600 py-8 text-center">{error}</div>

  const showForm = editing !== null || showNew

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Campaign list */}
      <div className="col-span-2 space-y-2">
        <button onClick={startNew} className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
          + New campaign
        </button>

        {(campaigns ?? []).length === 0 && !showNew && (
          <div className="py-12 text-center text-sm text-gray-400">
            No campaigns yet.<br />Add one from the Template Library or create custom.
          </div>
        )}

        {(campaigns ?? []).map(c => (
          <div key={c.id}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${editing?.id === c.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            onClick={() => startEdit(c)}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(c) }}
                className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.isActive ? 'bg-teal-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${c.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="mt-1.5 flex gap-2 items-center flex-wrap">
              <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{c.triggerTag}</code>
              <span className="text-xs text-gray-400">{c._count.enrollments} enrolled</span>
              {c.template && <span className="text-xs text-gray-400">{VERTICAL_LABELS[c.template.vertical] ?? c.template.vertical}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Editor panel */}
      <div className="col-span-3">
        {!showForm && (
          <div className="py-20 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            Select a campaign to edit or create a new one.
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
            </div>
            <div className="p-6 space-y-5">
              <Field label="Campaign name">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} placeholder="Post-procedure follow-up" />
              </Field>

              <Field label="Description (optional)">
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inp} placeholder="Brief description of what this campaign does" />
              </Field>

              <Field label="Trigger tag" hint="The contact tag that starts this campaign automatically.">
                <input value={form.triggerTag} onChange={e => setForm(f => ({ ...f, triggerTag: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  className={inp} placeholder="post-procedure" />
              </Field>

              <Field label="Agent prompt" hint="What the agent says on this call. Be specific about the purpose and tone.">
                <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                  className={inp} rows={6} placeholder="You are calling to follow up on the contact's recent visit…" />
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Delay (hours)" hint="How long after the tag is applied before calling.">
                  <input type="number" min={0} value={form.delayHours} onChange={e => setForm(f => ({ ...f, delayHours: Number(e.target.value) }))}
                    className={inp} />
                </Field>
                <Field label="Max retries" hint="How many times to retry if no answer.">
                  <input type="number" min={0} max={10} value={form.maxRetries} onChange={e => setForm(f => ({ ...f, maxRetries: Number(e.target.value) }))}
                    className={inp} />
                </Field>
                <Field label="Retry interval (hours)">
                  <input type="number" min={1} value={form.retryIntervalHours} onChange={e => setForm(f => ({ ...f, retryIntervalHours: Number(e.target.value) }))}
                    className={inp} />
                </Field>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-teal-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-700">{form.isActive ? 'Active — will trigger on tag' : 'Inactive — will not trigger'}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save campaign'}
                </button>
                <button onClick={() => { setEditing(null); setShowNew(false) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
                {editing && (
                  <button onClick={() => deleteCampaign(editing.id)} disabled={deleting === editing.id}
                    className="ml-auto px-4 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50">
                    {deleting === editing.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Enrollments ───────────────────────────────────────────────────────────────
function Enrollments() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: enrollments, loading, error } = useApi<Enrollment[]>(
    `/api/enrollments${statusFilter ? `?status=${statusFilter}` : ''}`,
    [statusFilter]
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All statuses</option>
          {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'OPTED_OUT', 'CANCELLED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{enrollments?.length ?? 0} enrollments</span>
      </div>

      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>}
      {error   && <div className="text-sm text-red-600 py-8 text-center">{error}</div>}
      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Contact', 'Campaign', 'Tag', 'Status', 'Triggered', 'Scheduled Call', 'Attempts'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(enrollments ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No enrollments found.</td></tr>
              )}
              {(enrollments ?? []).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{e.contact.fullName ?? (`${e.contact.firstName ?? ''} ${e.contact.lastName ?? ''}`.trim() || '—')}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.contact.phoneE164 ?? e.contact.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{e.campaign.name}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{e.triggerTag}</code></td>
                  <td className="px-4 py-3"><Badge label={e.status} color={STATUS_COLORS[e.status]} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(e.triggeredAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{e.scheduledCallAt ? new Date(e.scheduledCallAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-center">{e.attemptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-900'
