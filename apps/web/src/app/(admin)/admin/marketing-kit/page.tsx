'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, API_BASE } from '@/hooks/useApi'
import { getAccessToken } from '@/lib/auth'
import { useLocale } from '@/lib/i18n/I18nProvider'

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
  hiddenTabs:     string[]
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
  const { locale } = useLocale()
  const [videos, setVideos] = useState<VideoRow[] | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Edit only fires for existing rows; the create flow is the file-driven
  // upload modal below (no separate "+ New video" button).
  const [editing, setEditing] = useState<VideoRow | null>(null)
  // Upload modal — opened after the admin picks file(s) from a tab's "+
  // Upload" button. We pre-read media metadata client-side (video duration,
  // image dimensions, audio duration) so the server doesn't need ffprobe.
  // 1 file = single asset (video / image / audio); 2+ images = carousel.
  type DraftMedia = 'video' | 'image' | 'audio' | 'carousel'
  interface UploadDraft {
    files:       File[]
    intent:      Intent
    mediaType:   DraftMedia
    durationSec: number
    aspectRatio: Aspect
    mime:        string
  }
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null)
  // Generator modal — opens when the admin clicks "✨ Generate" on a tab.
  const [genFor, setGenFor] = useState<Intent | null>(null)

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

  // Probe a single file client-side. Each helper returns the bits the upload
  // form needs to pre-populate; if probe fails (corrupt file, missing codec)
  // we fall back to safe defaults so the admin can still try the upload.
  async function probeMedia(file: File): Promise<{ durationSec: number; width: number; height: number }> {
    const url = URL.createObjectURL(file)
    try {
      const m = file.type.toLowerCase()
      if (m.startsWith('image/')) {
        const img = document.createElement('img')
        img.src = url
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not read image')) })
        return { durationSec: 0, width: img.naturalWidth, height: img.naturalHeight }
      }
      if (m.startsWith('audio/')) {
        const a = document.createElement('audio')
        a.preload = 'metadata'; a.src = url
        await new Promise<void>((resolve, reject) => { a.onloadedmetadata = () => resolve(); a.onerror = () => reject(new Error('Could not read audio')) })
        return { durationSec: Math.round(a.duration), width: 0, height: 0 }
      }
      // default: video
      const v = document.createElement('video')
      v.preload = 'metadata'; v.muted = true; v.src = url
      await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error('Could not read video')) })
      return { durationSec: Math.round(v.duration), width: v.videoWidth, height: v.videoHeight }
    } finally { URL.revokeObjectURL(url) }
  }

  // Single "+ Upload" entry point per tab. 1 file = single asset (video /
  // image / audio detected by MIME). 2+ files = carousel (must all be images;
  // first slide drives aspect ratio).
  async function startUploadForTab(intent: Intent, files: File[]) {
    if (files.length === 0) return
    try {
      if (files.length === 1) {
        const f = files[0]!
        const m = f.type.toLowerCase()
        const mediaType: DraftMedia = m.startsWith('image/') ? 'image' : m.startsWith('audio/') ? 'audio' : 'video'
        const meta = await probeMedia(f)
        const aspectRatio: Aspect = meta.width >= meta.height || meta.width === 0 ? 'horizontal' : 'vertical'
        setUploadDraft({ files, intent, mediaType, durationSec: meta.durationSec, aspectRatio, mime: f.type })
      } else {
        // Carousel — verify every file is an image
        for (const f of files) {
          if (!f.type.startsWith('image/')) { showToast('error', `Carousel slides must all be images (${f.name} is ${f.type || 'unknown'})`); return }
        }
        const meta = await probeMedia(files[0]!)
        const aspectRatio: Aspect = meta.width >= meta.height ? 'horizontal' : 'vertical'
        setUploadDraft({ files, intent, mediaType: 'carousel', durationSec: 0, aspectRatio, mime: files[0]!.type })
      }
    } catch (e) { showToast('error', e instanceof Error ? e.message : 'Could not read file') }
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
              <div className="flex items-center gap-2">
                <button onClick={() => setGenFor(tab.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(45% 0.13 193)', border: '1px solid oklch(55% 0.11 193 / 0.4)' }}
                  title={`Generate a post for ${tab.label} with AI`}>
                  ✨ Generate
                </button>
                <label className="cursor-pointer" title={`Upload media into ${tab.label}. 1 file = video/image/audio. Multi-select images = carousel.`}>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-block" style={{ background: 'oklch(55% 0.11 193)', color: '#fff' }}>+ Upload</span>
                  <input type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) startUploadForTab(tab.key, fs); e.currentTarget.value = '' }} />
                </label>
              </div>
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
                      <th className="text-left px-3 py-2 text-xs font-semibold"      style={{ color: 'var(--text-tertiary)' }}>Title</th>
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
                          {/* Show the title in its own language with a small EN/ES badge.
                              Rows can carry just one language (post-refactor) or both
                              (legacy seeded rows); badge reflects which. */}
                          {(() => {
                            const en = !!v.titleEn?.trim()
                            const es = !!v.titleEs?.trim()
                            const display = en && es
                              ? (locale === 'es' ? v.titleEs : v.titleEn)
                              : (v.titleEn?.trim() || v.titleEs?.trim() || '—')
                            const badge = en && es ? 'EN+ES' : (en ? 'EN' : 'ES')
                            return (
                              <div className="flex items-center gap-2">
                                <p className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{display}</p>
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                                  {badge}
                                </span>
                              </div>
                            )
                          })()}
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

      {genFor && (
        <GenerateModal
          intent={genFor}
          onClose={() => setGenFor(null)}
          onGenerated={(row) => {
            setVideos(prev => prev ? [...prev, row] : [row])
            setGenFor(null)
            showToast('success', `Generated: ${row.titleEn || row.titleEs}`)
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

        {/* Tab visibility — uncheck to hide that tab from partners. Admin
            always sees every tab in this admin panel. */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tabs visible to partners</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {INTENTS.map(tab => {
              const hidden = draft.hiddenTabs.includes(tab.key)
              return (
                <label key={tab.key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={(e) => {
                      const next = new Set(draft.hiddenTabs)
                      if (e.target.checked) next.delete(tab.key); else next.add(tab.key)
                      setDraft({ ...draft, hiddenTabs: Array.from(next) })
                    }}
                  />
                  {tab.label}
                </label>
              )
            })}
          </div>
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
  draft: { files: File[]; intent: Intent; mediaType: 'video' | 'image' | 'audio' | 'carousel'; durationSec: number; aspectRatio: Aspect; mime: string }
  onClose: () => void
  onSaved: (row: VideoRow) => void
}) {
  const filenameRoot = (draft.files[0]?.name ?? 'untitled').replace(/\.[^/.]+$/, '')
  // Admin picks ONE language; the server auto-translates to the other to
  // satisfy the bilingual rule. Default = English.
  const [primaryLang, setPrimaryLang] = useState<'en' | 'es'>('en')
  const [form, setForm] = useState({
    intent:      draft.intent,
    aspectRatio: draft.aspectRatio,
    title:       filenameRoot,
    description: '',
    visible:     true,
  })
  const [saving, setSaving]   = useState(false)
  const [aiBusy, setAiBusy]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function generateDescription() {
    if (!form.title.trim()) { setError('Add a title first — AI generates the description from it.'); return }
    setError(null); setAiBusy(true)
    try {
      const out = await apiFetch<{ description: string }>('/api/admin/marketing-kit/ai/describe', {
        method: 'POST',
        body: JSON.stringify({ title: form.title.trim(), intent: form.intent, lang: primaryLang }),
      })
      setForm(f => ({ ...f, description: out.description }))
    } catch (e) { setError(e instanceof Error ? e.message : 'AI could not generate a description.') }
    finally { setAiBusy(false) }
  }

  async function submit() {
    setError(null); setSaving(true)
    try {
      const fd = new FormData()
      // Carousel = multiple 'files' fields; everything else = single 'file'.
      if (draft.mediaType === 'carousel') {
        for (const f of draft.files) fd.append('files', f)
      } else {
        fd.append('file', draft.files[0]!)
      }
      fd.append('intent',      form.intent)
      fd.append('primaryLang', primaryLang)
      fd.append('title',       form.title.trim())
      fd.append('description', form.description.trim())
      fd.append('aspectRatio', form.aspectRatio)
      fd.append('durationSec', String(draft.durationSec))
      fd.append('visible',     form.visible ? 'true' : 'false')
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

  const totalBytes = draft.files.reduce((sum, f) => sum + f.size, 0)
  const sizeMB = (totalBytes / 1024 / 1024).toFixed(1)
  const langLabel = (l: 'en' | 'es') => l === 'en' ? 'English' : 'Spanish'
  const otherLang = primaryLang === 'en' ? 'Spanish' : 'English'
  const mediaLabel: Record<typeof draft.mediaType, string> = {
    video: 'Video', image: 'Image', audio: 'Audio', carousel: `Carousel (${draft.files.length} slides)`,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload video</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          This video lives in the language you pick — partners reading in the other language won&apos;t see it. Upload it again in the other language if you want both audiences. Duration, aspect ratio, and file name are auto-detected.
        </p>

        {/* Auto-detected summary */}
        <div className="rounded-lg p-3 mb-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <Detected label="File"     value={draft.mediaType === 'carousel' ? `${draft.files.length} slides` : (draft.files[0]?.name ?? '—')} />
          <Detected label="Size"     value={`${sizeMB} MB`} />
          <Detected label="Type"     value={mediaLabel[draft.mediaType]} />
          <Detected label={draft.mediaType === 'audio' || draft.mediaType === 'video' ? 'Duration' : 'Aspect'}
            value={draft.mediaType === 'audio' || draft.mediaType === 'video'
              ? `${Math.floor(draft.durationSec / 60)}:${(draft.durationSec % 60).toString().padStart(2, '0')}`
              : (draft.aspectRatio === 'horizontal' ? '16:9' : '9:16')} />
        </div>

        {/* Language toggle */}
        <div className="mb-3">
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>I&apos;m writing in</p>
          <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['en', 'es'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setPrimaryLang(l)}
                className="px-4 py-1.5 text-sm font-semibold"
                style={{
                  background: primaryLang === l ? 'oklch(55% 0.11 193)' : 'var(--surface-raised)',
                  color:      primaryLang === l ? '#fff' : 'var(--text-secondary)',
                }}>
                {langLabel(l)}
              </button>
            ))}
          </div>
          <span className="text-xs ml-3" style={{ color: 'var(--text-tertiary)' }}>
            Card shows only to partners reading in {langLabel(primaryLang)}. Upload again in {otherLang} for the other audience.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <SelField label="Tab" value={form.intent} onChange={(v) => setForm({ ...form, intent: v as Intent })}
            options={INTENTS.map(i => ({ value: i.key, label: i.label }))} />
          <SelField label="Aspect ratio (override)" value={form.aspectRatio} onChange={(v) => setForm({ ...form, aspectRatio: v as Aspect })}
            options={[{ value: 'horizontal', label: '16:9 horizontal' }, { value: 'vertical', label: '9:16 vertical' }]} />
        </div>

        <div className="mb-3">
          <TxtField label={`Title (${langLabel(primaryLang)}) *`} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        </div>

        <div className="mb-4">
          <div className="flex items-end justify-between mb-1">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description ({langLabel(primaryLang)}) *</label>
            <button type="button" onClick={generateDescription} disabled={aiBusy || !form.title.trim()}
              className="text-xs px-2 py-1 rounded-md font-semibold"
              style={{ background: aiBusy ? 'var(--surface-overlay)' : 'oklch(55% 0.11 193 / 0.12)', color: 'oklch(45% 0.13 193)', border: '1px solid oklch(55% 0.11 193 / 0.35)', opacity: (!form.title.trim()) ? 0.5 : 1 }}
              title="Generate a description from the title with AI">
              {aiBusy ? '…thinking' : '✨ AI describe from title'}
            </button>
          </div>
          <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical' }} />
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

// ── Generate modal — admin picks an angle (or free prompt), language, and
// composition, then the server orchestrates AI copy + AI image + Remotion
// render + Bunny upload + DB row insertion. ~10-20s end-to-end.
interface Angle {
  key:         string
  label:       string
  intent:      string
  composition: 'Social-Static' | 'Social-Imagery' | 'Social-Reel'
  aggression:  string
  briefEn:     string
  briefEs:     string
  imageStyle?: string
}
function GenerateModal({ intent, onClose, onGenerated }: {
  intent:       Intent
  onClose:      () => void
  onGenerated:  (row: VideoRow) => void
}) {
  const [angles, setAngles]       = useState<Angle[] | null>(null)
  const [mode, setMode]           = useState<'angle' | 'free'>('angle')
  const [angleKey, setAngleKey]   = useState<string>('')
  const [brief, setBrief]         = useState<string>('')
  const [lang, setLang]           = useState<'en' | 'es'>('en')
  const [composition, setComposition] = useState<'Social-Static' | 'Social-Imagery' | 'Social-Reel'>('Social-Imagery')
  const [visible, setVisible]     = useState(true)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    apiFetch<Angle[]>('/api/admin/marketing-kit/angles')
      .then(list => {
        setAngles(list)
        // Default to the first angle that matches this tab.
        const fit = list.find(a => a.intent === intent) ?? list[0]
        if (fit) { setAngleKey(fit.key); setComposition(fit.composition) }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load angles'))
  }, [intent])

  async function submit() {
    setBusy(true); setError(null)
    try {
      const body: Record<string, unknown> = { intent, lang, composition, visible }
      if (mode === 'angle') body.angleKey = angleKey
      else                  body.brief    = brief.trim()
      const row = await apiFetch<VideoRow>('/api/admin/marketing-kit/generate', {
        method: 'POST', body: JSON.stringify(body),
      })
      onGenerated(row)
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed') }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>✨ Generate a post</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          AI writes the copy (4 per-platform variants), generates an on-brand background, and renders the final card. ~10-20 seconds.
        </p>

        {/* Mode toggle */}
        <div className="mb-3 inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {(['angle', 'free'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className="px-4 py-1.5 text-sm font-semibold"
              style={{ background: mode === m ? 'oklch(55% 0.11 193)' : 'var(--surface-raised)', color: mode === m ? '#fff' : 'var(--text-secondary)' }}>
              {m === 'angle' ? 'Curated angle' : 'Free prompt'}
            </button>
          ))}
        </div>

        {mode === 'angle' ? (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Angle</label>
            <select value={angleKey} onChange={(e) => {
              setAngleKey(e.target.value)
              const a = angles?.find(x => x.key === e.target.value)
              if (a) setComposition(a.composition)
            }}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              {angles?.map(a => <option key={a.key} value={a.key}>{a.label}  ({a.intent})</option>)}
            </select>
            {angles?.find(a => a.key === angleKey) && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                {lang === 'es' ? angles.find(a => a.key === angleKey)!.briefEs : angles.find(a => a.key === angleKey)!.briefEn}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Free prompt</label>
            <textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder={`e.g. Hook: most local biz owners spend 60% of their day inside Google but their GBP is half-empty. Pitch: free GBP audit shows what they are missing. Pattern: PAS, direct tier.`}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical' }} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <SelField label="Language" value={lang} onChange={(v) => setLang(v as 'en' | 'es')}
            options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }]} />
          <SelField label="Composition" value={composition} onChange={(v) => setComposition(v as typeof composition)}
            options={[
              { value: 'Social-Imagery',   label: 'AI photo + text (4:5)' },
              { value: 'Social-Static',    label: 'Typography card (1:1)' },
              { value: 'Stat-Card',        label: 'Stat card — big number (1:1)' },
              { value: 'Hook-Card',        label: 'Hook card — question (1:1)' },
              { value: 'Quote-Card',       label: 'Quote / testimonial (4:5)' },
              { value: 'Comparison-Card',  label: 'You vs them (1:1)' },
              { value: 'Value-Pillars',    label: 'Value pillars 1-2-3 (4:5)' },
              { value: 'Social-Reel',      label: 'Animated reel — 12s (9:16)' },
              { value: 'Hook-Reel',        label: 'Hook reel — 15s (9:16)' },
              { value: 'Partner-LongForm', label: 'YouTube long-form intro/outro (16:9)' },
            ]} />
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Visibility</label>
            <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              Visible to partners on generate
            </label>
          </div>
        </div>

        {error && <div className="rounded-lg p-2 mb-3 text-xs" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>{error}</div>}
        {busy && <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: 'oklch(96% 0.04 230)', color: 'oklch(35% 0.16 230)' }}>
          Generating… (copy → AI image → render → upload). Don't close this window.
        </div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>Cancel</button>
          <button onClick={submit} disabled={busy || (mode === 'free' && !brief.trim()) || (mode === 'angle' && !angleKey)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'oklch(55% 0.11 193)', color: '#fff', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Generating…' : '✨ Generate & publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
