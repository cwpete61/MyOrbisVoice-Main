'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

type EmailDetail = {
  id:              string
  partnerId:       string
  threadId:        string | null
  messageId:       string | null
  inReplyTo:       string | null
  direction:       'INBOUND' | 'OUTBOUND'
  fromAddress:     string
  toAddresses:     unknown
  ccAddresses:     unknown
  subject:         string
  htmlBody:        string | null
  textBody:        string | null
  attachmentsJson: unknown
  deliveryStatus:  string | null
  readAt:          string | null
  receivedAt:      string | null
  sentAt:          string | null
  createdAt:       string
}

export default function PartnerEmailDetailPage() {
  const t = useT()
  const tz = useUserTimezone()
  const params = useParams<{ id: string }>()
  const [email,   setEmail]   = useState<EmailDetail | null>(null)
  const [thread,  setThread]  = useState<EmailDetail[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!params?.id) return
    let cancelled = false
    apiFetch<EmailDetail>(`/api/partner/mailbox/emails/${params.id}`)
      .then(async (e) => {
        if (cancelled) return
        setEmail(e)
        setExpanded({ [e.id]: true })   // current message expanded by default
        if (e.threadId) {
          try {
            const { emails } = await apiFetch<{ emails: EmailDetail[] }>(
              `/api/partner/mailbox/threads/${e.threadId}`
            )
            if (!cancelled) setThread(emails)
          } catch {
            /* thread fetch is non-critical — fall back to single-email view */
          }
        }
      })
      .catch(e => !cancelled && setError((e as Error).message ?? 'Load failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [params?.id])

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.loading')}</div>
  if (error)   return <div className="text-sm pt-8" style={{ color: 'oklch(60% 0.2 30)' }}>{error}</div>
  if (!email)  return null

  const messages: EmailDetail[] = thread && thread.length > 1 ? thread : [email]
  const showThread = messages.length > 1

  // Build reply URL from the latest message in the thread (most relevant for the next reply)
  const latest        = messages[messages.length - 1] ?? email
  const replySubject  = latest.subject.startsWith('Re: ') ? latest.subject : `Re: ${latest.subject}`
  const replyTo       = latest.direction === 'INBOUND' ? extractEmail(latest.fromAddress) : ''
  const replyParams   = new URLSearchParams({
    ...(replyTo  ? { to: replyTo } : {}),
    subject:  replySubject,
    ...(latest.messageId ? { inReplyTo: latest.messageId } : {}),
    ...(latest.threadId  ? { threadId:  latest.threadId  } : {}),
  })
  const anyInbound = messages.some(m => m.direction === 'INBOUND')

  return (
    <div className="max-w-3xl">
      <Link href={email.direction === 'OUTBOUND' ? '/partner-portal/mailbox/sent' : '/partner-portal/mailbox'} className="text-xs inline-flex items-center gap-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
        ← {email.direction === 'OUTBOUND' ? t('partnerMailbox.detail.backToSent') : t('partnerMailbox.detail.backToInbox')}
      </Link>

      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-baseline justify-between mb-1 gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{email.subject || '(no subject)'}</h1>
        </div>
        {showThread && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerMailbox.detail.thread.messageCount').replace('{n}', String(messages.length))}
          </p>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {messages.map((m) => {
          const isExpanded = !!expanded[m.id]
          const dateStr    = formatInTimezone(m.receivedAt ?? m.sentAt ?? m.createdAt, {
            tz,
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          const recipients = Array.isArray(m.toAddresses) ? m.toAddresses.join(', ') : String(m.toAddresses ?? '')
          const directionLabel = m.direction === 'INBOUND'
            ? t('partnerMailbox.detail.thread.received')
            : t('partnerMailbox.detail.thread.sent')

          return (
            <div
              key={m.id}
              className="rounded-xl"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <button
                type="button"
                onClick={() => setExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                className="w-full text-left px-5 py-3 flex items-baseline justify-between gap-3"
                style={{ background: 'transparent', cursor: 'pointer' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{directionLabel}</span>
                    {' · '}
                    <span className="break-all">{m.direction === 'INBOUND' ? m.fromAddress : recipients}</span>
                  </div>
                  {!isExpanded && m.textBody && (
                    <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {snippet(m.textBody)}
                    </div>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{dateStr}</span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5">
                  <div className="text-xs mb-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <Row label={t('partnerMailbox.detail.from')} value={m.fromAddress} />
                    <Row label={t('partnerMailbox.detail.to')}   value={recipients} />
                    {m.direction === 'INBOUND' && m.deliveryStatus && (
                      <Row label={t('partnerMailbox.detail.deliveryStatus')} value={m.deliveryStatus} mono />
                    )}
                  </div>
                  {m.htmlBody ? (
                    <div
                      className="mailbox-body"
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: m.htmlBody }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                      {m.textBody ?? ''}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {anyInbound && (
        <Link
          href={`/partner-portal/mailbox/compose?${replyParams.toString()}`}
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--brand-500)', color: '#fff' }}
        >
          {t('partnerMailbox.detail.reply')}
        </Link>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex text-xs mb-1.5">
      <span className="w-24 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="flex-1 break-all" style={{ color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/)
  return m && m[1] ? m[1] : addr.trim()
}

function snippet(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  return cleaned.length > 120 ? cleaned.slice(0, 117) + '…' : cleaned
}
