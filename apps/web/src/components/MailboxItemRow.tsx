'use client'

import Link from 'next/link'
import { useUserTimezone } from '@/lib/timezone'

export type MailboxItem = {
  id:             string
  direction:      'INBOUND' | 'OUTBOUND'
  fromAddress:    string
  toAddresses:    unknown   // Json array — usually string[]
  subject:        string
  textBody:       string | null
  threadId:       string | null
  readAt:         string | null
  receivedAt:     string | null
  sentAt:         string | null
  createdAt:      string
  deliveryStatus: string | null
}

/**
 * Single row in the Mailbox Inbox / Sent list. Compact: from/to + subject +
 * snippet + date in one clickable row that links to the detail page.
 */
export function MailboxItemRow({ item, basePath }: { item: MailboxItem; basePath: string }) {
  const tz = useUserTimezone()
  const isInbound  = item.direction === 'INBOUND'
  const isUnread   = isInbound && !item.readAt
  const counterparty = isInbound
    ? stripDisplay(item.fromAddress)
    : firstRecipient(item.toAddresses)
  const snippet = (item.textBody ?? '').replace(/\s+/g, ' ').slice(0, 110)
  const date    = formatDate(item.receivedAt ?? item.sentAt ?? item.createdAt, tz)

  return (
    <Link
      href={`${basePath}/${item.id}`}
      className="flex items-start gap-3 px-4 py-3 border-b transition-colors hover:opacity-90"
      style={{
        borderColor: 'var(--border-subtle)',
        background: isUnread ? 'oklch(55% 0.11 193 / 0.08)' : 'transparent',
      }}
    >
      <div
        className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
        style={{ background: isUnread ? 'var(--brand-500)' : 'transparent' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-0.5">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {counterparty}
          </span>
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{date}</span>
        </div>
        <div className="text-xs font-medium truncate" style={{ color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {item.subject || '(no subject)'}
        </div>
        {snippet && (
          <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {snippet}
          </div>
        )}
      </div>
    </Link>
  )
}

function stripDisplay(s: string): string {
  // "Alex Rivera <alex@x.com>" -> "Alex Rivera"; bare email -> the local part.
  const m = s.match(/^(.+?)\s*<.+>$/)
  if (m && m[1]) return m[1].trim().replace(/^["']|["']$/g, '')
  const at = s.indexOf('@')
  return at > 0 ? s.slice(0, at) : s
}

function firstRecipient(to: unknown): string {
  if (Array.isArray(to) && to.length > 0 && typeof to[0] === 'string') return stripDisplay(to[0])
  if (typeof to === 'string') return stripDisplay(to)
  return '—'
}

function formatDate(iso: string | null, tz: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDay = diffMs / (1000 * 60 * 60 * 24)
  // "Same calendar day" comparison uses the user's tz, not the runtime tz.
  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
                === new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
  if (diffDay < 1 && sameDay) {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d)
  }
  if (diffDay < 7) {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' }).format(d)
  }
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, month: 'short', day: 'numeric' }).format(d)
}
