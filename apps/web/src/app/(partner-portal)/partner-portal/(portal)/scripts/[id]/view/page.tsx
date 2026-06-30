'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

interface Script { id: string; title: string; channel: 'call' | 'email' | 'sms'; bodyHtml: string }

// Read-only, print-friendly view of a single script — opened in a new window from
// the Scripts tab so a partner can read it during a call. bodyHtml is sanitized
// server-side on save, so rendering it here is safe.
export default function ScriptViewPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<Script>(`/api/partner/scripts/${id}`)
      .then(setScript)
      .catch((e) => setError(e instanceof Error ? e.message : 'Not found'))
  }, [id])

  if (error) return <div style={{ padding: 32, color: 'oklch(50% 0.18 25)' }}>{error}</div>
  if (!script) return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>{t('partnerScripts.loading')}</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{script.title}</h1>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEAL, background: 'oklch(55% 0.11 193 / 0.12)', borderRadius: 5, padding: '2px 8px', marginTop: 6, display: 'inline-block' }}>
            {t(`partnerScripts.channel_${script.channel}`)}
          </span>
        </div>
        <button onClick={() => window.print()}
          style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {t('partnerScripts.print')}
        </button>
      </div>
      <div
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 22px', fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}
        dangerouslySetInnerHTML={{ __html: script.bodyHtml }}
      />
    </div>
  )
}
