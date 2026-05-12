'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { MailboxItemRow, type MailboxItem } from '@/components/MailboxItemRow'
import { MailboxHeader } from '@/components/MailboxHeader'

type ListResponse = { items: MailboxItem[]; nextCursor: string | null }

export default function PartnerSentPage() {
  const t = useT()
  const [items, setItems] = useState<MailboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<ListResponse>('/api/partner/mailbox/sent?limit=50')
      .then((d) => { setItems(d.items); setNextCursor(d.nextCursor) })
      .catch(e => setError((e as Error).message ?? 'Load failed'))
      .finally(() => setLoading(false))
  }, [])

  async function loadMore() {
    if (!nextCursor) return
    const d = await apiFetch<ListResponse>(`/api/partner/mailbox/sent?cursor=${nextCursor}&limit=50`)
    setItems(prev => [...prev, ...d.items])
    setNextCursor(d.nextCursor)
  }

  return (
    <div className="max-w-3xl">
      <MailboxHeader active="sent" />

      {loading && <p className="text-sm pt-4" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.loading')}</p>}
      {error   && <p className="text-sm pt-4" style={{ color: 'oklch(60% 0.2 30)' }}>{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerMailbox.emptySent')}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.emptySentHelp')}</p>
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
