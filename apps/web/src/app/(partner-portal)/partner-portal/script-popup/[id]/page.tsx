'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'
const FONT_MIN = 13, FONT_MAX = 28, FONT_DEFAULT = 16, FONT_KEY = 'va_script_font_px'

interface Script { id: string; title: string; channel: 'call' | 'email' | 'sms'; bodyHtml: string }

// Separate browser popup window for reading one script. Opened from the Scripts
// tab via window.open(...). Lives OUTSIDE the (portal) layout (no sidebar). Because
// it's its own OS window, it stays open while the partner switches tabs or
// navigates the app. Font +/- persists via localStorage; Print prints just this
// window. bodyHtml is sanitized server-side on save, safe to render.
export default function ScriptPopupPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [error, setError] = useState('')
  const [fontPx, setFontPx] = useState(FONT_DEFAULT)

  useEffect(() => {
    apiFetch<Script>(`/api/partner/scripts/${id}`)
      .then(setScript)
      .catch((e) => setError(e instanceof Error ? e.message : 'Not found'))
  }, [id])

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(FONT_KEY))
    if (saved >= FONT_MIN && saved <= FONT_MAX) setFontPx(saved)
  }, [])

  useEffect(() => { if (script?.title) document.title = script.title }, [script])

  const setFont = (px: number) => {
    const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, px))
    setFontPx(clamped); window.localStorage.setItem(FONT_KEY, String(clamped))
  }

  const fontBtn = (label: string, onClick: () => void, title: string) => (
    <button onClick={onClick} title={title} style={{ minWidth: 32, height: 32, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-app, #f3f6f6)', padding: '18px 16px' }}>
      {error ? (
        <div style={{ color: 'oklch(50% 0.18 25)', fontSize: 14 }}>{error}</div>
      ) : !script ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{t('partnerScripts.loading')}</div>
      ) : (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }} className="no-print">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{script.title}</h1>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEAL, background: 'oklch(55% 0.11 193 / 0.12)', borderRadius: 5, padding: '2px 8px', marginTop: 6, display: 'inline-block' }}>
                {t(`partnerScripts.channel_${script.channel}`)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {fontBtn('A−', () => setFont(fontPx - 2), t('partnerScripts.fontSmaller'))}
              {fontBtn('A+', () => setFont(fontPx + 2), t('partnerScripts.fontLarger'))}
              {fontBtn('⤢', () => setFont(FONT_DEFAULT), t('partnerScripts.fontReset'))}
              <button onClick={() => window.print()} style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('partnerScripts.print')}</button>
              <button onClick={() => window.close()} style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('partnerScripts.close')}</button>
            </div>
          </div>
          <div
            className="rich-editor-area"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', fontSize: fontPx, lineHeight: 1.7, color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: script.bodyHtml }}
          />
        </div>
      )}
    </div>
  )
}
