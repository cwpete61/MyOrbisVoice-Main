'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { MailboxItemRow, type MailboxItem } from '@/components/MailboxItemRow'
import { MailboxHeader } from '@/components/MailboxHeader'

type SearchResponse = { items: MailboxItem[]; nextCursor: string | null; query: string }

export default function PartnerMailboxSearchPage() {
  const t = useT()
  const params = useSearchParams()
  const q = (params.get('q') ?? '').trim()

  const [items, setItems]           = useState<MailboxItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (q.length < 2) { setLoading(false); return }
    setLoading(true)
    setItems([])
    setNextCursor(null)
    setError(null)
    apiFetch<SearchResponse>(`/api/partner/mailbox/search?q=${encodeURIComponent(q)}&limit=50`)
      .then((d) => { setItems(d.items); setNextCursor(d.nextCursor) })
      .catch(e => setError((e as Error).message ?? 'Search failed'))
      .finally(() => setLoading(false))
  }, [q])

  async function loadMore() {
    if (!nextCursor) return
    const d = await apiFetch<SearchResponse>(
      `/api/partner/mailbox/search?q=${encodeURIComponent(q)}&cursor=${nextCursor}&limit=50`,
    )
    setItems(prev => [...prev, ...d.items])
    setNextCursor(d.nextCursor)
  }

  return (
    <div className="max-w-3xl">
      <MailboxHeader active="search" />

      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {q.length < 2
          ? t('partnerMailbox.search.hint')
          : t('partnerMailbox.search.resultsFor').replace('{q}', q)}
      </p>

      {loading && <p className="text-sm pt-4" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.loading')}</p>}
      {error   && <p className="text-sm pt-4" style={{ color: 'oklch(60% 0.2 30)' }}>{error}</p>}

      {!loading && !error && q.length >= 2 && items.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerMailbox.search.noResults')}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.search.noResultsHelp')}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          {items.map(it => <MailboxItemRow key={it.id} item={it} basePath="/partner-portal/mailbox" />)}
        </div>
      )}

      {nextCursor && (
        <button onClick={loadMore} className="mt-4 px-4 py-2 text-xs rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {t('partnerMailbox.loadMore')}
        </button>
      )}
    </div>
  )
}
