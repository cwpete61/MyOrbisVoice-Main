'use client'

/**
 * Knowledge Base section of the Business DNA editor. Lets a tenant upload
 * reference documents (PDF, Word, Excel, CSV, plain text). Files live on
 * Bunny under the tenant's namespace; extracted text is cached on the
 * server so the AI agent can use the content as background knowledge
 * during conversations.
 *
 * Self-contained: handles its own loading, uploads, deletes, status
 * polling. Bypasses the standard DNA form/save/dirty flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { getAccessToken } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface KbFile {
  id:               string
  filename:         string
  mimeType:         string
  sizeBytes:        number
  extractionStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  errorMessage:     string | null
  uploadedAt:       string
  hasText:          boolean
}

interface UsageInfo {
  usedBytes: string
  capBytes:  string
  pct:       number
  fileCount: number
  capMb:     number
  usedMb:    number
  maxFileMb: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function StatusPill({ status, t }: { status: KbFile['extractionStatus']; t: (k: string) => string }) {
  const styles: Record<KbFile['extractionStatus'], { bg: string; fg: string; key: string }> = {
    PENDING:    { bg: 'oklch(95% 0.05 75)',  fg: 'oklch(35% 0.16 75)',  key: 'tenantKb.status.pending'    },
    PROCESSING: { bg: 'oklch(95% 0.06 230)', fg: 'oklch(35% 0.18 230)', key: 'tenantKb.status.processing' },
    READY:      { bg: 'oklch(95% 0.06 145)', fg: 'oklch(35% 0.16 145)', key: 'tenantKb.status.ready'      },
    FAILED:     { bg: 'oklch(95% 0.06 25)',  fg: 'oklch(40% 0.18 25)',  key: 'tenantKb.status.failed'     },
  }
  const s = styles[status]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {t(s.key)}
    </span>
  )
}

export function KnowledgeBaseSection() {
  const t = useT()
  const [files, setFiles]     = useState<KbFile[]>([])
  const [usage, setUsage]     = useState<UsageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const reload = useCallback(async () => {
    try {
      const [list, u] = await Promise.all([
        apiFetch<KbFile[]>('/api/knowledge-base'),
        apiFetch<UsageInfo>('/api/knowledge-base/usage'),
      ])
      setFiles(list)
      setUsage(u)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    void reload()
  }, [reload])

  // Poll while any file is mid-extraction.
  useEffect(() => {
    const inFlight = files.some(f => f.extractionStatus === 'PENDING' || f.extractionStatus === 'PROCESSING')
    if (inFlight && !pollRef.current) {
      pollRef.current = setInterval(() => { void reload() }, 3000)
    } else if (!inFlight && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [files, reload])

  async function uploadOne(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = getAccessToken()
      // Direct fetch — must NOT set Content-Type so the browser writes the
      // multipart boundary itself. apiFetchRaw forces application/json.
      const res = await fetch(`${API_BASE}/api/knowledge-base`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { errors?: Array<{ message?: string }> }
        const msg  = body.errors?.[0]?.message ?? `Upload failed (HTTP ${res.status})`
        throw new Error(msg)
      }
      await reload()
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list)
    for (const file of arr) {
      // Sequential upload — simpler progress + clearer per-file errors.
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(file)
    }
  }

  function onPickClick() {
    inputRef.current?.click()
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (!list || list.length === 0) return
    void uploadFiles(list)
    // Reset so re-selecting the same file still fires onChange.
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const list = e.dataTransfer.files
    if (!list || list.length === 0) return
    void uploadFiles(list)
  }

  async function deleteFile(id: string) {
    if (!window.confirm(t('tenantKb.confirmDelete'))) return
    setDeleting(id)
    try {
      await apiFetch(`/api/knowledge-base/${id}`, { method: 'DELETE' })
      await reload()
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantKb.loading')}</p>
  }
  if (error) {
    return <div className="alert-error">{error}</div>
  }

  // Tier with no allocation — feature is locked.
  if (usage && usage.capMb === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('tenantKb.locked.title')}
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantKb.locked.body')}
        </p>
        <a
          href="/billing"
          className="inline-block btn-primary text-sm px-4 py-1.5"
        >
          {t('tenantKb.locked.upgradeCta')}
        </a>
      </div>
    )
  }

  const usedMb = usage?.usedMb ?? 0
  const capMb  = usage?.capMb  ?? 0
  const pct    = Math.min(100, Math.max(0, usage?.pct ?? 0))
  const overWarn  = pct >= 80 && pct < 95
  const overCrit  = pct >= 95

  return (
    <div className="space-y-4">
      {/* Storage usage bar */}
      <div
        className="rounded-lg p-3"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span style={{ color: 'var(--text-secondary)' }}>
            {t('tenantKb.usage.label', { used: usedMb.toFixed(1), cap: capMb.toString(), count: usage?.fileCount ?? 0 })}
          </span>
          <span style={{ color: overCrit ? 'oklch(55% 0.18 25)' : overWarn ? 'oklch(60% 0.16 75)' : 'var(--text-tertiary)' }}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-app)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: overCrit ? 'oklch(55% 0.18 25)' : overWarn ? 'oklch(70% 0.16 75)' : 'oklch(55% 0.11 193)',
            }}
          />
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {t('tenantKb.usage.fileSizeHint', { mb: usage?.maxFileMb ?? 25 })}
        </p>
      </div>

      {/* Drop zone / file picker */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragOver={(e) => { e.preventDefault() }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
        onDrop={onDrop}
        onClick={onPickClick}
        className="rounded-xl p-6 text-center cursor-pointer transition-colors"
        style={{
          background:  dragActive ? 'oklch(55% 0.11 193 / 0.08)' : 'var(--surface-app)',
          border:      `1px dashed ${dragActive ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)'}`,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,text/markdown"
          onChange={onInputChange}
          className="hidden"
        />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {uploading ? t('tenantKb.dropzone.uploading') : t('tenantKb.dropzone.title')}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantKb.dropzone.hint')}
        </p>
      </div>

      {uploadError && (
        <div className="alert-error">{uploadError}</div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          {t('tenantKb.empty')}
        </p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          {files.map((f, i) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {f.filename}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {formatBytes(f.sizeBytes)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
                {f.extractionStatus === 'FAILED' && f.errorMessage && (
                  <p className="text-xs mt-1" style={{ color: 'oklch(55% 0.18 25)' }}>
                    {f.errorMessage}
                  </p>
                )}
              </div>
              <StatusPill status={f.extractionStatus} t={t} />
              <button
                onClick={() => deleteFile(f.id)}
                disabled={deleting === f.id}
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'transparent',
                  border:     '1px solid oklch(70% 0.12 25)',
                  color:      'oklch(50% 0.18 25)',
                  opacity:    deleting === f.id ? 0.5 : 1,
                }}
              >
                {deleting === f.id ? t('tenantKb.actions.deleting') : t('tenantKb.actions.delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
