'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

export function MailboxHeader({ active }: { active: 'inbox' | 'sent' | 'compose' | 'search' }) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  // Pre-fill the input from the URL on the search results page so the user can refine.
  const initialQ = active === 'search' ? (params.get('q') ?? '') : ''
  const [q, setQ] = useState(initialQ)
  useEffect(() => { setQ(initialQ) }, [initialQ])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed.length < 2) return
    router.push(`/partner-portal/mailbox/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('partnerMailbox.title')}</h1>
          <p className="text-xs mt-0.5 font-medium" style={{ color: 'oklch(55% 0.18 25)' }}>
            {t('partnerMailbox.transactionalNote')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submitSearch} className="flex items-center">
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('partnerMailbox.search.placeholder')}
              aria-label={t('partnerMailbox.search.placeholder')}
              className="rounded-lg px-3 py-1.5 text-xs w-56"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </form>
          <Link
            href="/partner-portal/mailbox/compose"
            className="px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--brand-500)', color: '#fff' }}
          >
            {t('partnerMailbox.composeCta')}
          </Link>
        </div>
      </div>
      <div className="flex gap-1 text-xs" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Tab href="/partner-portal/mailbox"          label={t('partnerMailbox.tabInbox')}   active={active === 'inbox'} />
        <Tab href="/partner-portal/mailbox/sent"     label={t('partnerMailbox.tabSent')}    active={active === 'sent'} />
        <Tab href="/partner-portal/mailbox/compose"  label={t('partnerMailbox.tabCompose')} active={active === 'compose'} />
        {active === 'search' && (
          <Tab href={`/partner-portal/mailbox/search?q=${encodeURIComponent(initialQ)}`} label={t('partnerMailbox.tabSearch')} active />
        )}
      </div>
    </div>
  )
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 -mb-px font-semibold"
      style={{
        color:        active ? 'var(--text-primary)'   : 'var(--text-tertiary)',
        borderBottom: active ? '2px solid var(--brand-500)' : '2px solid transparent',
      }}
    >
      {label}
    </Link>
  )
}
