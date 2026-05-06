'use client'

import { useState } from 'react'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { Tooltip } from '@/components/Tooltip'

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
  enableVoice: boolean
  enableSms: boolean
  enableEmail: boolean
  enableWhatsapp: boolean
  smsBody: string | null
  whatsappBody: string | null
  emailSubject: string | null
  emailBody: string | null
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
const VERTICAL_ORDER = [
  'GENERAL','LEGAL','DENTAL','MEDICAL','FINANCIAL','HOME_SERVICES','AUTO_REPAIR',
  'REAL_ESTATE','FITNESS','BEAUTY','EDUCATION','HOSPITALITY',
  'VETERINARY','CHILDCARE','ACCOUNTING','INSURANCE','PROPERTY_MANAGEMENT',
]

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
  const t = useT()
  const [view, setView] = useState<View>('mine')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showMsg(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const steps: Array<{ step: string; title: string; body: string }> = [
    { step: '1', title: t('tenantCampaigns.howItWorks.step1Title'), body: t('tenantCampaigns.howItWorks.step1Body') },
    { step: '2', title: t('tenantCampaigns.howItWorks.step2Title'), body: t('tenantCampaigns.howItWorks.step2Body') },
    { step: '3', title: t('tenantCampaigns.howItWorks.step3Title'), body: t('tenantCampaigns.howItWorks.step3Body') },
    { step: '4', title: t('tenantCampaigns.howItWorks.step4Title'), body: t('tenantCampaigns.howItWorks.step4Body') },
  ]

  const tabs: Array<[View, string]> = [
    ['mine', t('tenantCampaigns.tabs.mine')],
    ['library', t('tenantCampaigns.tabs.library')],
    ['enrollments', t('tenantCampaigns.tabs.enrollments')],
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tenantCampaigns.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('tenantCampaigns.subtitle')}</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantCampaigns.howItWorks.title')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {steps.map(({ step, title, body }) => (
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
        {tabs.map(([v, label]) => (
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
function TemplateLibrary({ onMsg }: { onMsg: (t: 'success' | 'error', m: string) => void }) {
  const t = useT()
  const { data: allTemplates, loading, error } = useApi<CampaignTemplate[]>('/api/campaigns/templates')
  const [activating, setActivating]   = useState<string | null>(null)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [activeVertical, setActiveVertical] = useState('GENERAL')

  function verticalLabel(v: string) {
    return t(`tenantCampaigns.verticals.${v}`)
  }

  // Build counts per vertical from full template list
  const countsByVertical: Record<string, number> = {}
  for (const tmpl of allTemplates ?? []) {
    countsByVertical[tmpl.vertical] = (countsByVertical[tmpl.vertical] ?? 0) + 1
  }
  // Verticals that actually have templates, in preferred order
  const presentVerticals = VERTICAL_ORDER.filter(v => countsByVertical[v])

  // Filter by vertical tab + search
  const query = search.toLowerCase().trim()
  const filtered = (allTemplates ?? []).filter(tmpl => {
    const matchesVertical = tmpl.vertical === activeVertical
    const matchesSearch   = !query ||
      tmpl.name.toLowerCase().includes(query) ||
      tmpl.description.toLowerCase().includes(query) ||
      tmpl.defaultTriggerTag.toLowerCase().includes(query)
    return matchesVertical && matchesSearch
  })

  // Group filtered results by vertical
  const grouped: Record<string, CampaignTemplate[]> = {}
  for (const tmpl of filtered) {
    if (!grouped[tmpl.vertical]) grouped[tmpl.vertical] = []
    grouped[tmpl.vertical]!.push(tmpl)
  }
  const groupedEntries = VERTICAL_ORDER
    .filter(v => grouped[v])
    .map(v => [v, grouped[v]!] as [string, CampaignTemplate[]])

  async function activateTemplate(tmpl: CampaignTemplate) {
    setActivating(tmpl.id)
    try {
      await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          templateId:         tmpl.id,
          campaignType:       tmpl.campaignType,
          name:               tmpl.name,
          description:        tmpl.description,
          prompt:             tmpl.defaultPrompt,
          triggerTag:         tmpl.defaultTriggerTag,
          delayHours:         tmpl.defaultDelayHours,
          maxRetries:         tmpl.defaultMaxRetries,
          retryIntervalHours: tmpl.defaultRetryIntervalHours,
          isActive:           false,
        }),
      })
      onMsg('success', t('tenantCampaigns.library.addedToast', { name: tmpl.name }))
    } catch (err) {
      onMsg('error', err instanceof Error ? err.message : t('tenantCampaigns.library.addFailed'))
    } finally { setActivating(null) }
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">{t('tenantCampaigns.library.loading')}</div>
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
          placeholder={t('tenantCampaigns.library.searchPlaceholder')}
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
            {verticalLabel(v)}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeVertical === v ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>{countsByVertical[v]}</span>
          </button>
        ))}
      </div>

      {/* Results summary */}
      <p className="text-xs text-gray-400">
        {!search
          ? t(filtered.length === 1 ? 'tenantCampaigns.library.summaryInVertical' : 'tenantCampaigns.library.summaryInVerticalPlural', { count: filtered.length, vertical: verticalLabel(activeVertical) })
          : t(filtered.length === 1 ? 'tenantCampaigns.library.summaryResults' : 'tenantCampaigns.library.summaryResultsPlural', { count: filtered.length, query: search })}
      </p>

      {/* Template cards */}
      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
          {t('tenantCampaigns.library.noMatches')}
        </div>
      )}

      {groupedEntries.map(([vertical, items]) => (
        <div key={vertical}>
          {/* Section header — only show when search spans multiple verticals */}
          {query && groupedEntries.length > 1 && (
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {verticalLabel(vertical)}
              </h2>
              <span className="text-xs text-gray-400">{t(items.length === 1 ? 'tenantCampaigns.library.verticalCount' : 'tenantCampaigns.library.verticalCountPlural', { count: items.length })}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map(tmpl => (
              <div key={tmpl.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-xs leading-snug">{tmpl.name}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{tmpl.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-gray-500 mt-auto pt-1">
                    <span className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-gray-600 truncate max-w-full">{tmpl.defaultTriggerTag}</span>
                    <span className="bg-gray-100 rounded px-1.5 py-0.5">{t('tenantCampaigns.library.delayHours', { hours: tmpl.defaultDelayHours })}</span>
                    <span className="bg-gray-100 rounded px-1.5 py-0.5">{t('tenantCampaigns.library.retries', { count: tmpl.defaultMaxRetries })}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setExpanded(expanded === tmpl.id ? null : tmpl.id)}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    {expanded === tmpl.id ? t('tenantCampaigns.library.hidePrompt') : t('tenantCampaigns.library.previewPrompt')}
                  </button>
                  {expanded === tmpl.id && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 leading-relaxed">{tmpl.defaultPrompt}</p>
                    </div>
                  )}
                  <button
                    onClick={() => activateTemplate(tmpl)}
                    disabled={activating === tmpl.id}
                    className="w-full px-3 py-2 bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {activating === tmpl.id ? t('tenantCampaigns.library.adding') : t('tenantCampaigns.library.addButton')}
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
  const t = useT()
  const { data: campaigns, loading, error, reload } = useApi<Campaign[]>('/api/campaigns')
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const blankForm = { campaignType: 'FOLLOWUP_CUSTOMER_SERVICE', name: '', description: '', prompt: '', triggerTag: '', delayHours: 1, maxRetries: 2, retryIntervalHours: 24, isActive: false, enableVoice: true, enableSms: false, enableEmail: false, enableWhatsapp: false, smsBody: '', whatsappBody: '', emailSubject: '', emailBody: '' }
  const [form, setForm] = useState(blankForm)

  function startEdit(c: Campaign) {
    setEditing(c)
    setForm({ campaignType: c.campaignType, name: c.name, description: c.description ?? '', prompt: c.prompt, triggerTag: c.triggerTag, delayHours: c.delayHours, maxRetries: c.maxRetries, retryIntervalHours: c.retryIntervalHours, isActive: c.isActive, enableVoice: c.enableVoice, enableSms: c.enableSms, enableEmail: c.enableEmail, enableWhatsapp: c.enableWhatsapp, smsBody: c.smsBody ?? '', whatsappBody: c.whatsappBody ?? '', emailSubject: c.emailSubject ?? '', emailBody: c.emailBody ?? '' })
    setShowNew(false)
  }

  function startNew() {
    setEditing(null)
    setForm(blankForm)
    setShowNew(true)
  }

  async function save() {
    if (!form.name || !form.triggerTag) { onMsg('error', t('tenantCampaigns.mine.validation.nameAndTagRequired')); return }
    if (!form.enableVoice && !form.enableSms && !form.enableEmail && !form.enableWhatsapp) {
      onMsg('error', t('tenantCampaigns.mine.validation.atLeastOneChannel')); return
    }
    if (form.enableVoice && !form.prompt) { onMsg('error', t('tenantCampaigns.mine.validation.voicePromptRequired')); return }
    if (form.enableSms   && !form.smsBody) { onMsg('error', t('tenantCampaigns.mine.validation.smsBodyRequired')); return }
    if (form.enableEmail && (!form.emailSubject || !form.emailBody)) { onMsg('error', t('tenantCampaigns.mine.validation.emailFieldsRequired')); return }
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/api/campaigns/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
        onMsg('success', t('tenantCampaigns.mine.updatedToast'))
      } else {
        await apiFetch('/api/campaigns', { method: 'POST', body: JSON.stringify(form) })
        onMsg('success', t('tenantCampaigns.mine.createdToast'))
      }
      reload()
      setEditing(null)
      setShowNew(false)
    } catch (err) { onMsg('error', err instanceof Error ? err.message : t('tenantCampaigns.mine.saveFailed')) }
    finally { setSaving(false) }
  }

  async function toggleActive(c: Campaign) {
    try {
      await apiFetch(`/api/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) })
      reload()
    } catch (err) { onMsg('error', err instanceof Error ? err.message : t('tenantCampaigns.mine.toggleFailed')) }
  }

  async function deleteCampaign(id: string) {
    if (!confirm(t('tenantCampaigns.mine.deleteConfirm'))) return
    setDeleting(id)
    try {
      await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      reload()
      if (editing?.id === id) { setEditing(null); setShowNew(false) }
      onMsg('success', t('tenantCampaigns.mine.deletedToast'))
    } catch (err) { onMsg('error', err instanceof Error ? err.message : t('tenantCampaigns.mine.deleteFailed')) }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">{t('tenantCampaigns.mine.loading')}</div>
  if (error)   return <div className="text-sm text-red-600 py-8 text-center">{error}</div>

  const showForm = editing !== null || showNew

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Campaign list */}
      <div className="col-span-2 space-y-2">
        <button onClick={startNew} className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
          {t('tenantCampaigns.mine.newCampaign')}
        </button>

        {(campaigns ?? []).length === 0 && !showNew && (
          <div className="py-12 text-center text-sm text-gray-400">
            {t('tenantCampaigns.mine.emptyTitle')}<br />{t('tenantCampaigns.mine.emptyHint')}
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
              <span className="text-xs text-gray-400">{t('tenantCampaigns.mine.enrolledCount', { count: c._count.enrollments })}</span>
              {c.template && <span className="text-xs text-gray-400">{t(`tenantCampaigns.verticals.${c.template.vertical}`)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Editor panel */}
      <div className="col-span-3">
        {!showForm && (
          <div className="py-20 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            {t('tenantCampaigns.mine.selectPrompt')}
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editing ? t('tenantCampaigns.mine.editTitle') : t('tenantCampaigns.mine.newTitle')}</h2>
            </div>
            <div className="p-6 space-y-5">
              <Field label={t('tenantCampaigns.form.name')}>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} placeholder={t('tenantCampaigns.form.namePlaceholder')} />
              </Field>

              <Field label={t('tenantCampaigns.form.description')}>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inp} placeholder={t('tenantCampaigns.form.descriptionPlaceholder')} />
              </Field>

              <Field label={t('tenantCampaigns.form.channels')} hint={t('tenantCampaigns.form.channelsHint')}>
                <div className="grid grid-cols-2 gap-2">
                  <ChannelToggle
                    label={t('tenantCampaigns.channels.voice')}
                    sublabel={t('tenantCampaigns.channels.voiceSub')}
                    checked={form.enableVoice}
                    onChange={v => setForm(f => ({ ...f, enableVoice: v }))}
                  />
                  <ChannelToggle
                    label={t('tenantCampaigns.channels.sms')}
                    sublabel={t('tenantCampaigns.channels.smsSub')}
                    checked={form.enableSms}
                    onChange={v => setForm(f => ({ ...f, enableSms: v }))}
                  />
                  <ChannelToggle
                    label={t('tenantCampaigns.channels.email')}
                    sublabel={t('tenantCampaigns.channels.emailSub')}
                    checked={form.enableEmail}
                    onChange={v => setForm(f => ({ ...f, enableEmail: v }))}
                  />
                  <ChannelToggle
                    label={t('tenantCampaigns.channels.whatsapp')}
                    sublabel={t('tenantCampaigns.channels.whatsappSub')}
                    checked={form.enableWhatsapp}
                    onChange={v => setForm(f => ({ ...f, enableWhatsapp: v }))}
                    comingSoon
                  />
                </div>
              </Field>

              <Field label={t('tenantCampaigns.form.triggerTag')} hint={t('tenantCampaigns.form.triggerTagHint')} tooltip={t('tenantCampaigns.tooltips.triggerTag')}>
                <input value={form.triggerTag} onChange={e => setForm(f => ({ ...f, triggerTag: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  className={inp} placeholder={t('tenantCampaigns.form.triggerTagPlaceholder')} />
              </Field>

              {form.enableVoice && (
                <Field label={t('tenantCampaigns.form.voicePrompt')} hint={t('tenantCampaigns.form.voicePromptHint')} tooltip={t('tenantCampaigns.tooltips.voicePrompt')}>
                  <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                    className={inp} rows={6} placeholder={t('tenantCampaigns.form.voicePromptPlaceholder')} />
                </Field>
              )}

              {form.enableSms && (
                <Field label={t('tenantCampaigns.form.smsBody')} hint={t('tenantCampaigns.form.smsBodyHint', { count: form.smsBody.length })}>
                  <textarea value={form.smsBody} onChange={e => setForm(f => ({ ...f, smsBody: e.target.value }))}
                    className={inp} rows={3} maxLength={1600}
                    placeholder={t('tenantCampaigns.form.smsBodyPlaceholder')} />
                </Field>
              )}

              {form.enableEmail && (
                <>
                  <Field label={t('tenantCampaigns.form.emailSubject')} hint={t('tenantCampaigns.form.emailSubjectHint')}>
                    <input value={form.emailSubject} onChange={e => setForm(f => ({ ...f, emailSubject: e.target.value }))}
                      className={inp} placeholder={t('tenantCampaigns.form.emailSubjectPlaceholder')} />
                  </Field>
                  <Field label={t('tenantCampaigns.form.emailBody')} hint={t('tenantCampaigns.form.emailBodyHint')}>
                    <textarea value={form.emailBody} onChange={e => setForm(f => ({ ...f, emailBody: e.target.value }))}
                      className={inp} rows={6}
                      placeholder={t('tenantCampaigns.form.emailBodyPlaceholder')} />
                  </Field>
                </>
              )}

              {form.enableWhatsapp && (
                <Field label={t('tenantCampaigns.form.whatsappBody')} hint={t('tenantCampaigns.form.whatsappBodyHint')}>
                  <textarea value={form.whatsappBody} onChange={e => setForm(f => ({ ...f, whatsappBody: e.target.value }))}
                    className={inp} rows={3} maxLength={4000}
                    placeholder={t('tenantCampaigns.form.whatsappBodyPlaceholder')} />
                </Field>
              )}

              <div className="grid grid-cols-3 gap-4">
                <Field label={t('tenantCampaigns.form.delayHours')} hint={t('tenantCampaigns.form.delayHoursHint')} tooltip={t('tenantCampaigns.tooltips.delayHours')}>
                  <input type="number" min={0} value={form.delayHours} onChange={e => setForm(f => ({ ...f, delayHours: Number(e.target.value) }))}
                    className={inp} />
                </Field>
                <Field label={t('tenantCampaigns.form.maxRetries')} hint={t('tenantCampaigns.form.maxRetriesHint')} tooltip={t('tenantCampaigns.tooltips.maxRetries')}>
                  <input type="number" min={0} max={10} value={form.maxRetries} onChange={e => setForm(f => ({ ...f, maxRetries: Number(e.target.value) }))}
                    className={inp} />
                </Field>
                <Field label={t('tenantCampaigns.form.retryInterval')} tooltip={t('tenantCampaigns.tooltips.retryInterval')}>
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
                <span className="text-sm text-gray-700">{form.isActive ? t('tenantCampaigns.mine.active') : t('tenantCampaigns.mine.inactive')}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {saving ? t('tenantCampaigns.mine.saving') : t('tenantCampaigns.mine.save')}
                </button>
                <button onClick={() => { setEditing(null); setShowNew(false) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  {t('tenantCampaigns.mine.cancel')}
                </button>
                {editing && (
                  <button onClick={() => deleteCampaign(editing.id)} disabled={deleting === editing.id}
                    className="ml-auto px-4 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50">
                    {deleting === editing.id ? t('tenantCampaigns.mine.deleting') : t('tenantCampaigns.mine.delete')}
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
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [statusFilter, setStatusFilter] = useState('')
  const { data: enrollments, loading, error } = useApi<Enrollment[]>(
    `/api/enrollments${statusFilter ? `?status=${statusFilter}` : ''}`,
    [statusFilter]
  )

  const STATUS_KEYS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'OPTED_OUT', 'CANCELLED'] as const
  const headers: Array<[string, string]> = [
    ['contact', t('tenantCampaigns.enrollments.table.contact')],
    ['campaign', t('tenantCampaigns.enrollments.table.campaign')],
    ['tag', t('tenantCampaigns.enrollments.table.tag')],
    ['status', t('tenantCampaigns.enrollments.table.status')],
    ['triggered', t('tenantCampaigns.enrollments.table.triggered')],
    ['scheduledCall', t('tenantCampaigns.enrollments.table.scheduledCall')],
    ['attempts', t('tenantCampaigns.enrollments.table.attempts')],
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">{t('tenantCampaigns.enrollments.allStatuses')}</option>
          {STATUS_KEYS.map(s => (
            <option key={s} value={s}>{t(`tenantCampaigns.statusPill.${s}`)}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{t('tenantCampaigns.enrollments.count', { count: enrollments?.length ?? 0 })}</span>
      </div>

      {loading && <div className="text-sm text-gray-500 py-8 text-center">{t('tenantCampaigns.enrollments.loading')}</div>}
      {error   && <div className="text-sm text-red-600 py-8 text-center">{error}</div>}
      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {headers.map(([key, label]) => (
                  <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(enrollments ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">{t('tenantCampaigns.enrollments.empty')}</td></tr>
              )}
              {(enrollments ?? []).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{e.contact.fullName ?? (`${e.contact.firstName ?? ''} ${e.contact.lastName ?? ''}`.trim() || t('tenantCampaigns.enrollments.none'))}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.contact.phoneE164 ?? e.contact.email ?? t('tenantCampaigns.enrollments.none')}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{e.campaign.name}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{e.triggerTag}</code></td>
                  <td className="px-4 py-3"><Badge label={t(`tenantCampaigns.statusPill.${e.status}`)} color={STATUS_COLORS[e.status]} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(e.triggeredAt).toLocaleString(dateLocale)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{e.scheduledCallAt ? new Date(e.scheduledCallAt).toLocaleString(dateLocale) : t('tenantCampaigns.enrollments.none')}</td>
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
function Field({ label, hint, tooltip, children }: { label: string; hint?: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {tooltip ? <Tooltip content={tooltip}>{label}</Tooltip> : label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function ChannelToggle({
  label, sublabel, checked, onChange, comingSoon,
}: {
  label: string
  sublabel: string
  checked: boolean
  onChange: (v: boolean) => void
  comingSoon?: boolean
}) {
  const t = useT()
  const disabled = !!comingSoon
  return (
    <label
      className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
        disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-70'
          : checked
            ? 'border-teal-500 bg-teal-50 cursor-pointer'
            : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={disabled ? false : checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {comingSoon && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
              {t('tenantCampaigns.channels.comingSoon')}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{sublabel}</p>
      </div>
    </label>
  )
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-900'
