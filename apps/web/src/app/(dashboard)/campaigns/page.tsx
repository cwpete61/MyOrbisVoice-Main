'use client'

import { useState } from 'react'
import { apiFetch, apiFetchRaw, useApi } from '@/hooks/useApi'

interface Campaign {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELED'
  createdAt: string
  _count: { attempts: number }
}

interface Attempt {
  id: string
  status: string
  outcomeCode: string | null
  attemptNumber: number
  startedAt: string | null
  endedAt: string | null
  contact: { id: string; fullName: string | null; phoneE164: string | null }
}

interface CampaignDetail extends Campaign {
  attempts: Attempt[]
  stats: Record<string, number>
}

interface Contact {
  id: string
  fullName: string | null
  phoneE164: string | null
  email: string | null
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: 'var(--surface-overlay)',    text: 'var(--text-tertiary)' },
  SCHEDULED: { bg: 'oklch(14% 0.04 75)',        text: 'oklch(70% 0.16 75)'  },
  RUNNING:   { bg: 'oklch(19% 0.04 193)',       text: 'oklch(72% 0.12 193)' },
  PAUSED:    { bg: 'oklch(14% 0.04 75)',        text: 'oklch(70% 0.16 75)'  },
  COMPLETED: { bg: 'oklch(15% 0.05 145)',       text: 'oklch(65% 0.15 145)' },
  CANCELED:  { bg: 'oklch(13% 0.04 25)',        text: 'oklch(68% 0.20 25)'  },
}

const inp = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-xs font-medium mb-1'

export default function CampaignsPage() {
  const { data: campaigns, loading, error, reload } = useApi<Campaign[]>('/api/campaigns')
  const [selected, setSelected] = useState<string | null>(null)
  const { data: detail, loading: detailLoading, reload: reloadDetail } = useApi<CampaignDetail>(
    selected ? `/api/campaigns/${selected}` : '', [selected]
  )

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Add contacts panel
  const [showAddContacts, setShowAddContacts] = useState(false)
  const { data: contactList } = useApi<{ items: Contact[] }>('/api/contacts?limit=200')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [addingContacts, setAddingContacts] = useState(false)

  function showMsg(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function createCampaign() {
    if (!form.name) return
    setSaving(true)
    try {
      const campaign = await apiFetch<Campaign>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description || undefined }),
      })
      setForm({ name: '', description: '' })
      setShowCreate(false)
      reload()
      setSelected(campaign.id)
      showMsg('success', 'Campaign created.')
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function doAction(action: 'launch' | 'pause' | 'cancel') {
    if (!selected) return
    if (action === 'cancel' && !confirm('Cancel this campaign?')) return
    try {
      await apiFetchRaw(`/api/campaigns/${selected}/${action}`, { method: 'POST' })
      reload()
      reloadDetail()
      showMsg('success', `Campaign ${action}ed.`)
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Failed') }
  }

  async function addContacts() {
    if (!selected || selectedContacts.size === 0) return
    setAddingContacts(true)
    try {
      await apiFetch(`/api/campaigns/${selected}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds: Array.from(selectedContacts) }),
      })
      setSelectedContacts(new Set())
      setShowAddContacts(false)
      reloadDetail()
      showMsg('success', `${selectedContacts.size} contact(s) added.`)
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Failed') }
    finally { setAddingContacts(false) }
  }

  const canLaunch  = detail?.status === 'DRAFT' || detail?.status === 'PAUSED'
  const canPause   = detail?.status === 'RUNNING'
  const canCancel  = detail && !['COMPLETED', 'CANCELED'].includes(detail.status)
  const totalCalls = detail ? Object.values(detail.stats).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Outbound call campaigns</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New campaign</button>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New campaign</h2>
          <div>
            <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Campaign name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="Q3 Follow-up" />
          </div>
          <div>
            <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inp} rows={2} placeholder="What this campaign is about…" />
          </div>
          <div className="flex gap-2">
            <button onClick={createCampaign} disabled={saving || !form.name} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Campaign list */}
        <div className="col-span-1 space-y-2">
          {loading && <div className="h-4 rounded animate-pulse w-32" style={{ background: 'var(--border-subtle)' }} />}
          {error   && <div className="alert-error text-xs">{error}</div>}
          {!loading && (campaigns ?? []).length === 0 && (
            <div className="py-12 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No campaigns yet.</p>
            </div>
          )}
          {(campaigns ?? []).map((c) => {
            const s = STATUS_STYLE[c.status]!
            return (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{
                  background: selected === c.id ? 'var(--surface-raised)' : 'var(--surface-base)',
                  border: `1px solid ${selected === c.id ? 'oklch(72% 0.12 193)' : 'var(--border-subtle)'}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="badge text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>{c.status}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c._count.attempts} contacts · {new Date(c.createdAt).toLocaleDateString()}</p>
              </button>
            )
          })}
        </div>

        {/* Campaign detail */}
        <div className="col-span-2">
          {!selected && (
            <div className="py-20 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a campaign to view details</p>
            </div>
          )}

          {selected && detailLoading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}

          {selected && detail && (
            <div className="rounded-xl space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              {/* Header */}
              <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.name}</h2>
                  {detail.description && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{detail.description}</p>}
                </div>
                <span className="badge" style={{ background: STATUS_STYLE[detail.status]!.bg, color: STATUS_STYLE[detail.status]!.text }}>{detail.status}</span>
              </div>

              {/* Stats */}
              <div className="px-6 grid grid-cols-4 gap-4">
                {[
                  { label: 'Total',     value: totalCalls },
                  { label: 'Answered',  value: detail.stats['COMPLETED'] ?? 0 },
                  { label: 'Failed',    value: detail.stats['FAILED']    ?? 0 },
                  { label: 'Pending',   value: detail.stats['PENDING']   ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg text-center" style={{ background: 'var(--surface-overlay)' }}>
                    <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-6 flex flex-wrap gap-2">
                {canLaunch  && <button onClick={() => doAction('launch')} className="btn-primary">Launch</button>}
                {canPause   && <button onClick={() => doAction('pause')}  className="btn-ghost">Pause</button>}
                <button onClick={() => setShowAddContacts(true)} className="btn-ghost">+ Add contacts</button>
                {canCancel  && <button onClick={() => doAction('cancel')} className="btn-danger">Cancel</button>}
              </div>

              {/* Add contacts selector */}
              {showAddContacts && (
                <div className="mx-6 p-4 rounded-lg space-y-3" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Select contacts to add</p>
                    <button onClick={() => setShowAddContacts(false)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✕</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(contactList?.items ?? []).filter(c => c.phoneE164).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input type="checkbox"
                          checked={selectedContacts.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selectedContacts)
                            e.target.checked ? next.add(c.id) : next.delete(c.id)
                            setSelectedContacts(next)
                          }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.fullName ?? '—'}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.phoneE164}</span>
                      </label>
                    ))}
                    {(contactList?.items ?? []).filter(c => c.phoneE164).length === 0 && (
                      <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No contacts with phone numbers. Add contacts first.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addContacts} disabled={addingContacts || selectedContacts.size === 0} className="btn-primary">
                      {addingContacts ? 'Adding…' : `Add ${selectedContacts.size || ''} contacts`}
                    </button>
                    <button onClick={() => setShowAddContacts(false)} className="btn-ghost">Cancel</button>
                  </div>
                </div>
              )}

              {/* Attempts list */}
              {detail.attempts.length > 0 && (
                <div className="px-6 pb-6">
                  <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Call log</h3>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                          {['Contact', 'Phone', 'Status', 'Outcome', 'Started'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.attempts.map((a, i) => (
                          <tr key={a.id} style={{ borderBottom: i < detail.attempts.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{a.contact.fullName ?? '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{a.contact.phoneE164 ?? '—'}</td>
                            <td className="px-3 py-2">
                              <span className="badge" style={{ background: STATUS_STYLE[a.status]?.bg ?? 'var(--surface-overlay)', color: STATUS_STYLE[a.status]?.text ?? 'var(--text-tertiary)' }}>{a.status}</span>
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{a.outcomeCode ?? '—'}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{a.startedAt ? new Date(a.startedAt).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
