'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

const TEAL = 'oklch(55% 0.11 193)'

interface TranscriptTurn {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

/**
 * Merge consecutive same-role turns into single utterances. Defensive fix
 * for legacy conversations where the gateway pushed every Gemini streaming
 * delta as its own row (one word per turn). The gateway now buffers properly
 * (session.ts:onTranscriptDelta) so new calls don't need this — but it keeps
 * old calls rendering as paragraphs instead of vertical word lists.
 *
 * Smart join: when concatenating, prefer a single space between words; trim
 * to avoid double spaces. Don't insert a space when the previous fragment
 * ends with whitespace or the next begins with punctuation.
 */
function mergeTurns(raw: TranscriptTurn[]): TranscriptTurn[] {
  const out: TranscriptTurn[] = []
  for (const turn of raw) {
    const last = out[out.length - 1]
    const text = (turn.text ?? '').trim()
    if (!text) continue
    if (last && last.role === turn.role) {
      const needsSpace = !/\s$/.test(last.text) && !/^[,.!?;:'")\]]/.test(text)
      last.text = last.text + (needsSpace ? ' ' : '') + text
    } else {
      out.push({ role: turn.role, text, timestamp: turn.timestamp })
    }
  }
  return out
}

interface ConversationDetail {
  id:                    string
  channelType:           string
  startedAt:             string
  endedAt:               string | null
  status:                string
  summary:               string | null
  transcript:            TranscriptTurn[]
  outcomeCode:           string | null
  hasRecording:          boolean
  recordingUrl:          string | null
  recordingDurationSecs: number | null
  contact:               { id: string; fullName: string | null; firstName: string | null; lastName: string | null; email: string | null; phoneE164: string | null } | null
  appointments:          Array<{ id: string; status: string; startAt: string; endAt: string; appointmentType: string | null; timezone: string; location: string | null; notes: string | null }>
}

export default function PartnerConversationDetailPage() {
  const params = useParams<{ id: string }>()
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [data, setData] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return
    apiFetch<ConversationDetail>(`/api/partner/conversations/${params.id}`)
      .then(setData)
      .catch(e => setError((e as Error).message ?? 'load_failed'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => (
      <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
    ))}</div>
  }
  if (error || !data) {
    return (
      <div>
        <Link href="/partner-portal/conversations" className="text-xs mb-4 inline-block" style={{ color: TEAL }}>
          ← {t('partnerConversations.backToList')}
        </Link>
        <div className="alert-error mt-2">{t('partnerConversations.notFound')}</div>
      </div>
    )
  }

  const contactLabel = data.contact?.fullName ?? data.contact?.email ?? data.contact?.phoneE164 ?? t('partnerConversations.anonymousCaller')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/partner-portal/conversations" className="text-xs inline-block mb-3" style={{ color: TEAL, textDecoration: 'none' }}>
          ← {t('partnerConversations.backToList')}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {contactLabel}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {formatInTimezone(new Date(data.startedAt), { tz, locale: dateLocale, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}
          {formatInTimezone(new Date(data.startedAt), { tz, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
          {' · '}
          {data.channelType.toLowerCase()}
          {data.outcomeCode && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'oklch(95% 0.04 193)', color: TEAL }}>
              {data.outcomeCode}
            </span>
          )}
        </p>
      </div>

      {/* Contact details */}
      {data.contact && (data.contact.email || data.contact.phoneE164) && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.contactHeading')}
          </p>
          <div className="text-sm space-y-1" style={{ color: 'var(--text-primary)' }}>
            {data.contact.email && (
              <p><a href={`mailto:${data.contact.email}`} style={{ color: TEAL, textDecoration: 'none' }}>{data.contact.email}</a></p>
            )}
            {data.contact.phoneE164 && (
              <p><a href={`tel:${data.contact.phoneE164}`} style={{ color: TEAL, textDecoration: 'none' }}>{data.contact.phoneE164}</a></p>
            )}
          </div>
        </div>
      )}

      {/* Audio recording */}
      {data.hasRecording && data.recordingUrl && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.recordingHeading')}
          </p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls crossOrigin="anonymous" src={data.recordingUrl} style={{ width: '100%' }} />
        </div>
      )}

      {/* AI summary */}
      {data.summary && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.summaryHeading')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {data.summary}
          </p>
        </div>
      )}

      {/* Appointments born from this call */}
      {data.appointments.length > 0 && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.appointmentsHeading')}
          </p>
          <div className="space-y-2">
            {data.appointments.map(a => (
              <div key={a.id} className="text-sm flex items-start gap-3">
                <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={{
                  background: a.status === 'CONFIRMED' ? 'oklch(95% 0.05 145)' : 'oklch(95% 0.04 193)',
                  color:      a.status === 'CONFIRMED' ? 'oklch(45% 0.15 145)' : TEAL,
                }}>
                  {a.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-primary)' }}>
                    <strong>{a.appointmentType ?? t('partnerConversations.defaultAppointmentType')}</strong>
                    {' — '}
                    {formatInTimezone(new Date(a.startAt), { tz: a.timezone, locale: dateLocale, weekday: 'short', month: 'short', day: 'numeric' })}
                    {' '}
                    {formatInTimezone(new Date(a.startAt), { tz: a.timezone, locale: dateLocale, hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {a.location && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.location}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {(() => { const merged = mergeTurns(data.transcript); return merged.length > 0 && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerConversations.transcriptHeading')}
          </p>
          <div className="space-y-3 text-sm">
            {merged.map((turn, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="flex-shrink-0 text-xs font-semibold uppercase tracking-wider pt-0.5 w-16"
                  style={{ color: turn.role === 'user' ? TEAL : 'var(--text-tertiary)' }}
                >
                  {turn.role === 'user' ? t('partnerConversations.turnUser') : t('partnerConversations.turnAgent')}
                </div>
                <p className="flex-1" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {turn.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )})()}
    </div>
  )
}
