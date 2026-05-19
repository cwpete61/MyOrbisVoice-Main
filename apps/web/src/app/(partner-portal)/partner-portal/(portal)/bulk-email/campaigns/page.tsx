'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'
type Status = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'

interface CampaignRow {
  id: string
  name: string
  status: Status
  _count: { touches: number; leads: number }
}
interface Touch { id?: string; delayDays: number; subject: string; bodyHtml: string }
interface CampaignLead {
  id: string
  lead: { id: string; businessName: string; email: string | null; ownerName: string | null }
}
interface CampaignDetail {
  id: string
  name: string
  status: Status
  touches: Touch[]
  leads: CampaignLead[]
}
interface EligibleLead {
  id: string
  businessName: string
  email: string | null
  ownerName: string | null
  category: string | null
}
interface Funnel { enrolled: number; contacted: number; clicked: number; booked: number }

const card = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }
const inputCls = 'w-full text-sm px-3 py-2 rounded-lg outline-none'
const inputStyle = { background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

export default function CampaignsPage() {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // create state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // touch-editor state (mirrors detail.touches while editing)
  const [touches, setTouches] = useState<Touch[]>([])

  // lead picker
  const [picker, setPicker] = useState(false)
  const [eligible, setEligible] = useState<EligibleLead[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

  const loadList = useCallback(async () => {
    try {
      setCampaigns(await apiFetch<CampaignRow[]>('/api/partner/cold-email/campaigns'))
    } catch (e) { setError(errMsg(e)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadList() }, [loadList])

  async function openCampaign(id: string) {
    setError(null)
    try {
      const c = await apiFetch<CampaignDetail>(`/api/partner/cold-email/campaigns/${id}`)
      setDetail(c)
      setTouches(c.touches.length ? c.touches.map(x => ({ ...x })) : [{ delayDays: 0, subject: '', bodyHtml: '' }])
      apiFetch<Funnel>(`/api/partner/cold-email/campaigns/${id}/funnel`)
        .then(setFunnel)
        .catch(() => setFunnel(null))
    } catch (e) { setError(errMsg(e)) }
  }

  async function createCampaign() {
    if (!newName.trim()) return
    setBusy(true); setError(null)
    try {
      const c = await apiFetch<CampaignRow>('/api/partner/cold-email/campaigns', {
        method: 'POST', body: JSON.stringify({ name: newName.trim() }),
      })
      setCreating(false); setNewName('')
      await loadList()
      await openCampaign(c.id)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  async function patchCampaign(patch: { name?: string; status?: Status }) {
    if (!detail) return
    setBusy(true); setError(null)
    try {
      await apiFetch(`/api/partner/cold-email/campaigns/${detail.id}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      })
      await openCampaign(detail.id)
      await loadList()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  async function saveSequence() {
    if (!detail) return
    const clean = touches.filter(x => x.subject.trim() && x.bodyHtml.trim())
    if (clean.length === 0) { setError(t('coldCampaigns.needTouch')); return }
    setBusy(true); setError(null)
    try {
      await apiFetch(`/api/partner/cold-email/campaigns/${detail.id}/touches`, {
        method: 'PUT',
        body: JSON.stringify({ touches: clean.map(x => ({ delayDays: x.delayDays, subject: x.subject, bodyHtml: x.bodyHtml })) }),
      })
      await openCampaign(detail.id)
      await loadList()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  async function deleteCampaign() {
    if (!detail || !confirm(t('coldCampaigns.deleteConfirm'))) return
    setBusy(true); setError(null)
    try {
      await apiFetch(`/api/partner/cold-email/campaigns/${detail.id}`, { method: 'DELETE' })
      setDetail(null)
      await loadList()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  async function openPicker() {
    setError(null); setPicked(new Set())
    try {
      setEligible(await apiFetch<EligibleLead[]>('/api/partner/cold-email/eligible-leads'))
      setPicker(true)
    } catch (e) { setError(errMsg(e)) }
  }

  async function enrollPicked() {
    if (!detail || picked.size === 0) return
    setBusy(true); setError(null)
    try {
      await apiFetch(`/api/partner/cold-email/campaigns/${detail.id}/leads`, {
        method: 'POST', body: JSON.stringify({ leadIds: [...picked] }),
      })
      setPicker(false)
      await openCampaign(detail.id)
      await loadList()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  async function removeLead(campaignLeadId: string) {
    if (!detail) return
    setBusy(true); setError(null)
    try {
      await apiFetch(`/api/partner/cold-email/campaigns/${detail.id}/leads/${campaignLeadId}`, { method: 'DELETE' })
      await openCampaign(detail.id)
      await loadList()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  const isDraft = detail?.status === 'DRAFT'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('coldCampaigns.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('coldCampaigns.subtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'oklch(60% 0.2 25 / 0.12)', color: 'oklch(55% 0.2 25)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.loading')}</p>
      ) : detail ? (
        /* ── Detail / builder ── */
        <div className="space-y-5">
          <button onClick={() => { setDetail(null); setFunnel(null); setError(null) }} className="text-sm" style={{ color: TEAL }}>
            {t('coldCampaigns.back')}
          </button>

          <section className="rounded-xl p-4 space-y-3" style={card}>
            <div className="flex items-center justify-between gap-3">
              <input
                className="text-base font-semibold flex-1 px-2 py-1 rounded outline-none bg-transparent"
                style={{ color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                defaultValue={detail.name}
                onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== detail.name) void patchCampaign({ name: e.target.value.trim() }) }}
              />
              <span className="text-xs px-2 py-1 rounded font-medium flex-shrink-0"
                style={{ background: 'var(--surface-overlay)', color: detail.status === 'ACTIVE' ? TEAL : 'var(--text-tertiary)' }}>
                {t(`coldCampaigns.status${detail.status}`)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detail.status === 'DRAFT' && (
                <button onClick={() => patchCampaign({ status: 'ACTIVE' })} disabled={busy}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50" style={{ background: TEAL, color: 'white' }}>
                  {t('coldCampaigns.activate')}
                </button>
              )}
              {detail.status === 'ACTIVE' && (
                <button onClick={() => patchCampaign({ status: 'PAUSED' })} disabled={busy}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                  {t('coldCampaigns.pause')}
                </button>
              )}
              {detail.status === 'PAUSED' && (
                <button onClick={() => patchCampaign({ status: 'ACTIVE' })} disabled={busy}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50" style={{ background: TEAL, color: 'white' }}>
                  {t('coldCampaigns.resume')}
                </button>
              )}
              {detail.status !== 'ACTIVE' && (
                <button onClick={deleteCampaign} disabled={busy}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50" style={{ background: 'var(--surface-overlay)', color: 'oklch(55% 0.2 25)' }}>
                  {t('coldCampaigns.delete')}
                </button>
              )}
            </div>
            {isDraft && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.activateHint')}</p>
            )}
            {!isDraft && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.draftOnlyNote')}</p>
            )}
          </section>

          {/* Funnel */}
          {funnel && (
            <section className="rounded-xl p-4" style={card}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                {t('coldCampaigns.funnelTitle')}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['funnelEnrolled', funnel.enrolled],
                  ['funnelContacted', funnel.contacted],
                  ['funnelClicked', funnel.clicked],
                  ['funnelBooked', funnel.booked],
                ] as const).map(([key, n]) => (
                  <div key={key} className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface-overlay)' }}>
                    <p className="text-lg font-semibold" style={{ color: TEAL }}>{n}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t(`coldCampaigns.${key}`)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Touch sequence */}
          <section className="rounded-xl p-4 space-y-3" style={card}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('coldCampaigns.sequenceTitle')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.sequenceHint')}</p>
            </div>
            {touches.map((touch, i) => (
              <div key={i} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-overlay)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: TEAL }}>
                    {t('coldCampaigns.touchLabel', { n: String(i + 1) })}
                  </span>
                  {isDraft && touches.length > 1 && (
                    <button onClick={() => setTouches(touches.filter((_, j) => j !== i))}
                      className="text-xs" style={{ color: 'oklch(55% 0.2 25)' }}>
                      {t('coldCampaigns.removeTouch')}
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('coldCampaigns.delayLabel')} — {i === 0 ? t('coldCampaigns.delayHintFirst') : t('coldCampaigns.delayHintNext')}
                  </label>
                  <input type="number" min={0} disabled={!isDraft} className={inputCls} style={inputStyle}
                    value={touch.delayDays}
                    onChange={e => setTouches(touches.map((x, j) => j === i ? { ...x, delayDays: Math.max(0, Number(e.target.value) || 0) } : x))} />
                </div>
                <input disabled={!isDraft} className={inputCls} style={inputStyle}
                  placeholder={t('coldCampaigns.subjectLabel')}
                  value={touch.subject}
                  onChange={e => setTouches(touches.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} />
                <textarea disabled={!isDraft} rows={4} className={inputCls} style={inputStyle}
                  placeholder={t('coldCampaigns.bodyLabel')}
                  value={touch.bodyHtml}
                  onChange={e => setTouches(touches.map((x, j) => j === i ? { ...x, bodyHtml: e.target.value } : x))} />
              </div>
            ))}
            {isDraft && (
              <div className="flex items-center gap-2">
                {touches.length < 10 && (
                  <button onClick={() => setTouches([...touches, { delayDays: 3, subject: '', bodyHtml: '' }])}
                    className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                    {t('coldCampaigns.addTouch')}
                  </button>
                )}
                <button onClick={saveSequence} disabled={busy}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50" style={{ background: TEAL, color: 'white' }}>
                  {t('coldCampaigns.saveSequence')}
                </button>
              </div>
            )}
          </section>

          {/* Enrolled leads */}
          <section className="rounded-xl p-4 space-y-3" style={card}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('coldCampaigns.leadsTitle')} ({detail.leads.length})
              </p>
              {isDraft && (
                <button onClick={openPicker}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: TEAL, color: 'white' }}>
                  {t('coldCampaigns.addLeads')}
                </button>
              )}
            </div>
            {detail.leads.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.noLeads')}</p>
            ) : (
              <ul className="space-y-1.5">
                {detail.leads.map(cl => (
                  <li key={cl.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2"
                    style={{ background: 'var(--surface-overlay)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {cl.lead.businessName}
                      <span style={{ color: 'var(--text-tertiary)' }}> · {cl.lead.email}</span>
                    </span>
                    {isDraft && (
                      <button onClick={() => removeLead(cl.id)} className="text-xs" style={{ color: 'oklch(55% 0.2 25)' }}>
                        {t('coldCampaigns.remove')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        /* ── List ── */
        <div className="space-y-4">
          {creating ? (
            <section className="rounded-xl p-4 space-y-3" style={card}>
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('coldCampaigns.newCampaignName')}
              </label>
              <input className={inputCls} style={inputStyle} value={newName}
                onChange={e => setNewName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') void createCampaign() }} />
              <div className="flex items-center gap-2">
                <button onClick={createCampaign} disabled={busy || !newName.trim()}
                  className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50" style={{ background: TEAL, color: 'white' }}>
                  {t('coldCampaigns.create')}
                </button>
                <button onClick={() => { setCreating(false); setNewName('') }}
                  className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                  {t('coldCampaigns.cancel')}
                </button>
              </div>
            </section>
          ) : (
            <button onClick={() => setCreating(true)}
              className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: TEAL, color: 'white' }}>
              {t('coldCampaigns.newCampaign')}
            </button>
          )}

          {campaigns.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map(c => (
                <li key={c.id}>
                  <button onClick={() => openCampaign(c.id)}
                    className="w-full text-left rounded-xl p-4 flex items-center justify-between gap-3" style={card}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {t('coldCampaigns.touchesCount', { n: String(c._count.touches) })} · {t('coldCampaigns.leadsCount', { n: String(c._count.leads) })}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded font-medium flex-shrink-0"
                      style={{ background: 'var(--surface-overlay)', color: c.status === 'ACTIVE' ? TEAL : 'var(--text-tertiary)' }}>
                      {t(`coldCampaigns.status${c.status}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Lead picker modal */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPicker(false)}>
          <div className="rounded-xl p-4 max-w-lg w-full max-h-[80vh] overflow-auto space-y-3" style={card}
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('coldCampaigns.leadPickerTitle')}</p>
            {eligible.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('coldCampaigns.leadPickerEmpty')}</p>
            ) : (
              <ul className="space-y-1">
                {eligible.map(l => (
                  <li key={l.id}>
                    <label className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 cursor-pointer"
                      style={{ background: picked.has(l.id) ? 'oklch(55% 0.11 193 / 0.12)' : 'var(--surface-overlay)' }}>
                      <input type="checkbox" checked={picked.has(l.id)}
                        onChange={() => {
                          const next = new Set(picked)
                          next.has(l.id) ? next.delete(l.id) : next.add(l.id)
                          setPicked(next)
                        }} />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {l.businessName}<span style={{ color: 'var(--text-tertiary)' }}> · {l.email}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <button onClick={enrollPicked} disabled={busy || picked.size === 0}
                className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50" style={{ background: TEAL, color: 'white' }}>
                {t('coldCampaigns.enrollSelected', { n: String(picked.size) })}
              </button>
              <button onClick={() => setPicker(false)}
                className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                {t('coldCampaigns.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
