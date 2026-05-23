'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, API_BASE } from '@/hooks/useApi'
import { getAccessToken } from '@/lib/auth'

// ── Types (mirror the API service) ───────────────────────────────────────────
type Intent = 'pitch-product' | 'recruit-partners' | 'how-to-sell' | 'social-cuts'
type Aspect = 'horizontal' | 'vertical'

interface VideoRow {
  id:            string
  intent:        Intent
  titleEn:       string
  titleEs:       string
  descriptionEn: string
  descriptionEs: string
  filename:      string | null
  durationSec:   number
  aspectRatio:   Aspect
  comingSoon:    boolean
  visible:       boolean
  sortOrder:     number
  createdAt:     string
  updatedAt:     string
}

interface Settings {
  columnsDesktop: number
  columnsTablet:  number
  columnsMobile:  number
  defaultSort:    string
  defaultTab:     string
}

const INTENTS: { key: Intent; label: string }[] = [
  { key: 'pitch-product',    label: 'Pitch Product' },
  { key: 'recruit-partners', label: 'Recruit Partners' },
  { key: 'how-to-sell',      label: 'How to Sell' },
  { key: 'social-cuts',      label: 'Social Cuts' },
]

function fmtDuration(s: number) {
  if (!s) return '—'
  const m = Math.floor(s / 60); const r = s % 60
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `0:${r.toString().padStart(2, '0')}`
}

export default function AdminMarketingKitPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Edit only fires for existing rows; the create flow is the file-driven
  // upload modal below (no separate "+ New video" button).
  const [editing, setEditing] = useState<VideoRow | null>(null)
  // Upload modal — opened after the admin picks a file from a tab's "+ Upload
  // video" button. We pre-read duration + aspect from <video> metadata so the
  // server doesn't need ffprobe.
  interface UploadDraft {
    file:        File
    intent:      Intent
    durationSec: number
    aspectRatio: Aspect
  }
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [vs, st] = await Promise.all([
        apiFetch<VideoRow[]>('/api/admin/marketing-kit/videos'),
        apiFetch<Settings>('/api/admin/marketing-kit/settings'),
      ])
      setVideos(vs); setSettings(st)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function toggleVisible(v: VideoRow) {
    try {
      const updated = await apiFetch<VideoRow>(`/api/admin/marketing-kit/videos/${v.id}`, {
        method: 'PATCH', body: JSON.stringify({ visible: !v.visible }),
      })
      setVideos(prev => prev?.map(x => x.id === v.id ? updated : x) ?? null)
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Failed') }
  }

  async function toggleComingSoon(v: VideoRow) {
    try {
      const updated = await apiFetch<VideoRow>(`/api/admin/marketing-kit/videos/${v.id}`, {
        method: 'PATCH', body: JSON.stringify({ comingSoon: !v.comingSoon }),
      })
      setVideos(prev => prev?.map(x => x.id === v.id ? updated : x) ?? null)
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Failed') }
  }

  // Move a video up/down WITHIN ITS OWN TAB. Finds the adjacent sibling (same
  // intent), swaps their positions in the flat list, sends the new flat order
  // to the reorder API which re-stamps sortOrder. Other tabs' relative order
  // is untouched.
  async function move(v: VideoRow, dir: -1 | 1) {
    if (!videos) return
    const sameTab = videos.filter(x => x.intent === v.intent)
    const idxInTab = sameTab.findIndex(x => x.id === v.id)
    const swapTarget = sameTab[idxInTab + dir]
    if (!swapTarget) return
    const i = videos.findIndex(x => x.id === v.id)
    const j = videos.findIndex(x => x.id === swapTarget.id)
    if (i < 0 || j < 0) return
    const reordered = [...videos]
    ;[reordered[i], reordered[j]] = [reordered[j]!, reordered[i]!]
    setVideos(reordered) // optimistic
    try {
      await apiFetch('/api/admin/marketing-kit/videos/reorder', {
        method: 'POST', body: JSON.stringify({ order: reordered.map(x => x.id) }),
      })
      await load()
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Reorder failed'); load() }
  }

  async function remove(v: VideoRow) {
    if (!confirm(`Delete "${v.titleEn}"? The Bunny file will also be removed.`)) return
    try {
      await apiFetch(`/api/admin/marketing-kit/videos/${v.id}`, { method: 'DELETE' })
      setVideos(prev => prev?.filter(x => x.id !== v.id) ?? null)
      showToast('success', 'Deleted.')
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Delete failed') }
  }

  // Read a video file's duration + dimensions client-side via HTMLVideoElement.
  // We use these to pre-populate the upload modal and post them as the
  // authoritative values to the server (which has no ffprobe).
  async function probeVideoFile(file: File): Promise<{ durationSec: number; width: number; height: number }> {
    const url = URL.createObjectURL(file)
    try {
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.muted = true
      el.src = url
      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => resolve()
        el.onerror = () => reject(new Error('Could not read video metadata'))
      })
      return { durationSec: Math.round(el.duration), width: el.videoWidth, height: el.videoHeight }
    } finally { URL.revokeObjectURL(url) }
  }

  // The single "+ Upload video" entry point per tab. Reads metadata from the
  // file before showing the bilingual modal, so duration + aspect ratio are
  // already filled in by the time the admin sees the form.
  async function startUploadForTab(intent: Intent, file: File) {
    try {
      const meta = await probeVideoFile(file)
      setUploadDraft({
        file, intent,
        durationSec: meta.durationSec,
        aspectRatio: meta.width >= meta.height ? 'horizontal' : 'vertical',
      })
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Could not read video') }
  }

  async function replaceFor(v: VideoRow, file: File) {
    const fd = new FormData(); fd.append('file', file)
    const token = getAccessToken()
    try {
      const res = await fetch(`${API_BASE}/api/admin/marketing-kit/videos/${v.id}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const json = await res.json() as { data?: VideoRow; errors?: { message: string }[] }
      if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'Upload failed')
      setVideos(prev => prev?.map(x => x.id === v.id ? json.data! : x) ?? null)
      showToast('success', 'Video uploaded.')
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Upload failed') }
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
  if (error)   return <p className="text-sm" style={{ color: 'oklch(55% 0.2 25)' }}>{error}</p>
  if (!videos || !settings) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Marketing Kit</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Upload, edit, and reorder the videos partners see in their Marketing Kit. Both English and Spanish copy required.
        </p>
      </div>

      {toast && (
        <div className="rounded-lg p-3 text-sm" style={{
          background: toast.type === 'success' ? 'oklch(96% 0.05 145)' : 'oklch(95% 0.05 25)',
          color:      toast.type === 'success' ? 'oklch(35% 0.16 145)' : 'oklch(35% 0.18 25)',
        }}>{toast.text}</div>
      )}

      <SettingsPanel settings={settings} onChange={setSettings} showToast={showToast} />

      {/* One card per tab — count in the header, "+ New" creates a row in
          that tab pre-selected, up/down arrows reorder within the tab only. */}
      {INTENTS.map(tab => {
        const rows = videos.filter(v => v.intent === tab.key)
        return (
          <div key={tab.key} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tab.label}
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(45% 0.13 193)' }}>{rows.length}</span>
              </p>
              <label className="cursor-pointer" title={`Upload a video into ${tab.label}`}>
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-block" style={{ background: 'oklch(55% 0.11 193)', color: '#fff' }}>+ Upload video</span>
                <input type="file" accept="video/mp4,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) startUploadForTab(tab.key, f); e.currentTarget.value = '' }} />
              </label>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                No videos in this tab yet. Click <b>+ Upload video</b> to add one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--surface-raised)' }}>
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold w-8"  style={{ color: 'var(--text-tertiary)' }}>#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Title (EN / ES)</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Aspect</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Duration</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>File</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Visible</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Coming&nbsp;Soon</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold w-44" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v, i) => (
                      <tr key={v.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col items-center gap-0.5">
                            <button onClick={() => move(v, -1)} aria-label="Move up" disabled={i === 0}
                              className="w-5 h-5 rounded text-[10px]" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', opacity: i === 0 ? 0.4 : 1 }}>▲</button>
                            <button onClick={() => move(v, +1)} aria-label="Move down" disabled={i === rows.length - 1}
                              className="w-5 h-5 rounded text-[10px]" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', opacity: i === rows.length - 1 ? 0.4 : 1 }}>▼</button>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <p className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{v.titleEn}</p>
                          <p className="text-xs leading-tight" style={{ color: 'var(--text-tertiary)' }}>{v.titleEs}</p>
                        </td>
                        <td className="px-3 py-2 align-top text-xs" style={{ color: 'var(--text-secondary)' }}>{v.aspectRatio === 'horizontal' ? '16:9' : '9:16'}</td>
                        <td className="px-3 py-2 align-top text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{fmtDuration(v.durationSec)}</td>
                        <td className="px-3 py-2 align-top text-xs" style={{ color: v.filename ? 'oklch(45% 0.13 145)' : 'var(--text-tertiary)' }}>
                          {v.filename ? '✓ uploaded' : '— no file'}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button onClick={() => toggleVisible(v)}
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: v.visible ? 'oklch(96% 0.05 145)' : 'oklch(95% 0.02 0)', color: v.visible ? 'oklch(35% 0.16 145)' : 'var(--text-tertiary)' }}>
                            {v.visible ? 'Visible' : 'Hidden'}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button onClick={() => toggleComingSoon(v)}
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: v.comingSoon ? 'oklch(94% 0.06 80)' : 'oklch(95% 0.02 0)', color: v.comingSoon ? 'oklch(40% 0.15 80)' : 'var(--text-tertiary)' }}>
                            {v.comingSoon ? 'Coming soon' : 'Live'}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                          <label className="inline-block mr-1 cursor-pointer" title="Swap in a new MP4 at the same Bunny path">
                            <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>Replace</span>
                            <input type="file" accept="video/mp4,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceFor(v, f); e.currentTarget.value = '' }} />
                          </label>
                          <button onClick={() => setEditing(v)} className="px-2 py-1 rounded text-xs font-medium mr-1" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>Edit</button>
                          <button onClick={() => remove(v)} className="px-2 py-1 rounded text-xs font-medium" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {editing && (
        <EditModal
          video={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setVideos(prev => prev?.map(x => x.id === row.id ? row : x) ?? null)
            setEditing(null)
            showToast('success', 'Saved.')
          }}
        />
      )}

      {uploadDraft && (
        <UploadModal
          draft={uploadDraft}
          onClose={() => setUploadDraft(null)}
          onSaved={(row) => {
            setVideos(prev => prev ? [...prev, row] : [row])
            setUploadDraft(null)
            showToast('success', `${row.titleEn} uploaded.`)
          }}
        />
      )}
    </div>
  )
}

// ── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ settings, onChange, showToast }: {
  settings: Settings; onChange: (s: Settings) => void
  showToast: (type: 'success' | 'error', text: string) => void
}) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(settings), [settings])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const updated = await apiFetch<Settings>('/api/admin/marketing-kit/settings', {
        method: 'PATCH', body: JSON.stringify(draft),
      })
      onChange(updated); showToast('success', 'Settings saved.')
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Library display</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Controls how the videos render on the partner Marketing Kit page.</p>
      </div>
      <form onSubmit={save} className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumField label="Columns — desktop" value={draft.columnsDesktop} onChange={(v) => setDraft({ ...draft, columnsDesktop: v })} />
          <NumField label="Columns — tablet"  value={draft.columnsTablet}  onChange={(v) => setDraft({ ...draft, columnsTablet:  v })} />
          <NumField label="Columns — mobile"  value={draft.columnsMobile}  onChange={(v) => setDraft({ ...draft, columnsMobile:  v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelField label="Default sort"
            value={draft.defaultSort}
            onChange={(v) => setDraft({ ...draft, defaultSort: v })}
            options={[
              { value: 'manual',   label: 'Manual (sort order)' },
              { value: 'newest',   label: 'Newest first' },
              { value: 'duration', label: 'Shortest first' },
            ]} />
          <SelField label="Default tab"
            value={draft.defaultTab}
            onChange={(v) => setDraft({ ...draft, defaultTab: v })}
            options={[
              { value: 'all',              label: 'All' },
              { value: 'pitch-product',    label: 'Pitch Product' },
              { value: 'recruit-partners', label: 'Recruit Partners' },
              { value: 'how-to-sell',      label: 'How to Sell' },
              { value: 'social-cuts',      label: 'Social Cuts' },
            ]} />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.11 193)', color: '#fff', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type="number" min={1} max={6} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
    </div>
  )
}
function SelField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Create/Edit modal ────────────────────────────────────────────────────────

function EditModal({ video, onClose, onSaved }: {
  video: VideoRow
  onClose: () => void
  onSaved: (row: VideoRow) => void
}) {
  const [form, setForm] = useState({
    intent:        video.intent,
    aspectRatio:   video.aspectRatio,
    titleEn:       video.titleEn,
    titleEs:       video.titleEs,
    descriptionEn: video.descriptionEn,
    descriptionEs: video.descriptionEs,
    durationSec:   video.durationSec,
    comingSoon:    video.comingSoon,
    visible:       video.visible,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null); setSaving(true)
    try {
      const row = await apiFetch<VideoRow>(`/api/admin/marketing-kit/videos/${video.id}`, {
        method: 'PATCH', body: JSON.stringify(form),
      })
      onSaved(row)
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Edit video</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <SelField label="Tab (intent)" value={form.intent} onChange={(v) => setForm({ ...form, intent: v as Intent })}
            options={INTENTS.map(i => ({ value: i.key, label: i.label }))} />
          <SelField label="Aspect ratio" value={form.aspectRatio} onChange={(v) => setForm({ ...form, aspectRatio: v as Aspect })}
            options={[{ value: 'horizontal', label: '16:9 horizontal' }, { value: 'vertical', label: '9:16 vertical' }]} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <TxtField label="Title (English) *" value={form.titleEn} onChange={(v) => setForm({ ...form, titleEn: v })} />
          <TxtField label="Title (Spanish) *" value={form.titleEs} onChange={(v) => setForm({ ...form, titleEs: v })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <TxtArea label="Description (English) *" value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
          <TxtArea label="Description (Spanish) *" value={form.descriptionEs} onChange={(v) => setForm({ ...form, descriptionEs: v })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Duration (seconds)</label>
            <input type="number" min={0} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
          </div>
          <label className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Visible to partners</span>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={form.comingSoon} onChange={(e) => setForm({ ...form, comingSoon: e.target.checked })} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Coming soon (placeholder)</span>
          </label>
        </div>

        {error && <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>{error}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.11 193)', color: '#fff', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TxtField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
    </div>
  )
}
function TxtArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical' }} />
    </div>
  )
}

// ── Upload modal — the single new-video path. The MP4 is already in memory
// (picked by the admin), and we've read duration + aspect from it via
// HTMLVideoElement. The admin fills bilingual title/description; Save streams
// the file + metadata to the API in one multipart POST.
function UploadModal({ draft, onClose, onSaved }: {
  draft: { file: File; intent: Intent; durationSec: number; aspectRatio: Aspect }
  onClose: () => void
  onSaved: (row: VideoRow) => void
}) {
  const filenameRoot = draft.file.name.replace(/\.[^/.]+$/, '')
  const [form, setForm] = useState({
    intent:        draft.intent,
    aspectRatio:   draft.aspectRatio,
    titleEn:       filenameRoot,
    titleEs:       '',
    descriptionEn: '',
    descriptionEs: '',
    visible:       true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null); setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', draft.file)
      fd.append('intent',        form.intent)
      fd.append('titleEn',       form.titleEn.trim())
      fd.append('titleEs',       form.titleEs.trim())
      fd.append('descriptionEn', form.descriptionEn.trim())
      fd.append('descriptionEs', form.descriptionEs.trim())
      fd.append('aspectRatio',   form.aspectRatio)
      fd.append('durationSec',   String(draft.durationSec))
      fd.append('visible',       form.visible ? 'true' : 'false')
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/api/admin/marketing-kit/videos/with-file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const json = await res.json() as { data?: VideoRow; errors?: { message: string }[] }
      if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'Upload failed')
      onSaved(json.data!)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setSaving(false) }
  }

  const sizeMB = (draft.file.size / 1024 / 1024).toFixed(1)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload video</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>Duration, aspect ratio and file name are auto-detected — only the bilingual copy is required.</p>

        {/* Auto-detected summary */}
        <div className="rounded-lg p-3 mb-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <Detected label="File"     value={draft.file.name} />
          <Detected label="Size"     value={`${sizeMB} MB`} />
          <Detected label="Duration" value={`${Math.floor(draft.durationSec / 60)}:${(draft.durationSec % 60).toString().padStart(2, '0')}`} />
          <Detected label="Aspect"   value={draft.aspectRatio === 'horizontal' ? '16:9' : '9:16'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <SelField label="Tab" value={form.intent} onChange={(v) => setForm({ ...form, intent: v as Intent })}
            options={INTENTS.map(i => ({ value: i.key, label: i.label }))} />
          <SelField label="Aspect ratio (override)" value={form.aspectRatio} onChange={(v) => setForm({ ...form, aspectRatio: v as Aspect })}
            options={[{ value: 'horizontal', label: '16:9 horizontal' }, { value: 'vertical', label: '9:16 vertical' }]} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <TxtField label="Title (English) *" value={form.titleEn} onChange={(v) => setForm({ ...form, titleEn: v })} />
          <TxtField label="Title (Spanish) *" value={form.titleEs} onChange={(v) => setForm({ ...form, titleEs: v })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <TxtArea label="Description (English) *" value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
          <TxtArea label="Description (Spanish) *" value={form.descriptionEs} onChange={(v) => setForm({ ...form, descriptionEs: v })} />
        </div>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Visible to partners on save</span>
        </label>

        {error && <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>{error}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'oklch(55% 0.11 193)', color: '#fff', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Uploading…' : 'Upload & publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Detected({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-xs truncate font-medium" style={{ color: 'var(--text-primary)' }} title={value}>{value}</p>
    </div>
  )
}
