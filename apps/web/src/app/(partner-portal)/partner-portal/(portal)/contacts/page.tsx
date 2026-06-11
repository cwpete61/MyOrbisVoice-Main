'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApi, apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { LeadScoreBadge } from '@/components/LeadScoreBadge'

interface Contact {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phoneE164: string | null
  source: string
  createdAt: string
  optedOutSms: boolean
  optedOutVoice: boolean
  optedOutEmail: boolean
  emailStatus: string | null
  metadataJson: { leadCaptureScore?: number | null; leadCaptureGrade?: string | null } | null
  pipelineStage: { id: string; name: string; color: string | null } | null
}

interface ContactList {
  items: Contact[]
  total: number
  page: number
  limit: number
}

const inp = 'input'

export default function PartnerContactsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { data, loading, error, reload } = useApi<ContactList>(
    `/api/partner/crm/contacts${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`,
    [searchQuery],
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(search)
  }

  const contacts = data?.items ?? []
  const dash = '—'

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected((s) => (s.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))))
  }
  async function deleteSelected() {
    if (selected.size === 0 || !confirm(t('partnerContacts.confirmDelete', { n: selected.size }))) return
    setDeleting(true)
    try {
      for (const id of selected) await apiFetch(`/api/partner/crm/contacts/${id}`, { method: 'DELETE' })
      setSelected(new Set()); reload()
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('partnerContacts.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data ? t('partnerContacts.subtitleTotal', { n: data.total }) : t('partnerContacts.subtitleManage')}
          </p>
        </div>
        <Link href="/partner-portal/crm" className="btn-ghost">{t('partnerContacts.boardView')}</Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('partnerContacts.searchPlaceholder')}
          className={inp + ' max-w-sm'}
        />
        <button type="submit" className="btn-ghost">{t('partnerContacts.search')}</button>
        {searchQuery && (
          <button type="button" onClick={() => { setSearch(''); setSearchQuery('') }} className="btn-ghost">{t('partnerContacts.clear')}</button>
        )}
      </form>

      {selected.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerContacts.nSelected', { n: selected.size })}</span>
          <button onClick={deleteSelected} disabled={deleting} className="text-sm px-3 py-1.5 rounded-lg disabled:opacity-60" style={{ background: 'var(--error-600)', color: '#fff' }}>
            {deleting ? '…' : t('partnerContacts.deleteSelected', { n: selected.size })}
          </button>
        </div>
      )}

      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error   && <div className="alert-error">{error}</div>}

      {!loading && contacts.length === 0 && (
        <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerContacts.empty')}</p>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="px-3 py-3 w-9">
                  <input type="checkbox" aria-label="select all" checked={contacts.length > 0 && selected.size === contacts.length} onChange={toggleAll} />
                </th>
                {[
                  { key: 'name',   label: t('partnerContacts.table.name') },
                  { key: 'stage',  label: t('partnerContacts.table.stage') },
                  { key: 'email',  label: t('partnerContacts.table.email') },
                  { key: 'phone',  label: t('partnerContacts.table.phone') },
                  { key: 'source', label: t('partnerContacts.table.source') },
                  { key: 'added',  label: t('partnerContacts.table.added') },
                ].map((h) => (
                  <th key={h.key} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < contacts.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label="select" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    <span className="inline-flex items-center gap-2">
                      <Link href={`/partner-portal/contacts/${c.id}`} className="hover:underline">
                        {c.fullName ?? ([c.firstName, c.lastName].filter(Boolean).join(' ') || dash)}
                      </Link>
                      {typeof c.metadataJson?.leadCaptureScore === 'number' && (
                        <LeadScoreBadge score={c.metadataJson.leadCaptureScore} grade={c.metadataJson.leadCaptureGrade} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.pipelineStage ? (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: c.pipelineStage.color ?? 'var(--surface-overlay)', color: '#333' }}
                      >
                        {c.pipelineStage.name}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{dash}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    <span>{c.email ?? dash}</span>
                    {c.emailStatus === 'invalid' && <span className="ml-1 text-xs text-red-500">✕</span>}
                    {c.emailStatus === 'valid'   && <span className="ml-1 text-xs text-green-500">✓</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phoneE164 ?? dash}</td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{c.source}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.createdAt).toLocaleDateString(dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
