'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface Channel {
  id: string
  channelType: string
  isEnabled: boolean
  publicKey: string | null
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'https://gateway.myorbisvoice.com'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
      style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9l4 4 8-8" /></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" /></svg>
          Copy
        </>
      )}
    </button>
  )
}

export default function WidgetTestPage() {
  const t = useT()
  const { data: channels, loading } = useApi<Channel[]>('/api/channels')
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const widgetLoaded = useRef(false)

  const widgetChannel = channels?.find((c) => c.channelType === 'WIDGET')
  const publicKey = widgetChannel?.publicKey
  const isEnabled = widgetChannel?.isEnabled

  const embedCode = publicKey
    ? `<script src="${GATEWAY_URL}/widget/orbisvoice-widget.js"></script>\n<script>OrbisVoice.init({ publicKey: "${publicKey}" })</script>`
    : ''

  // Inject and init the live widget for preview
  useEffect(() => {
    if (!publicKey || widgetLoaded.current) return
    widgetLoaded.current = true

    const existing = document.getElementById('orbisvoice-widget-script')
    if (!existing) {
      const s = document.createElement('script')
      s.id = 'orbisvoice-widget-script'
      s.src = `${GATEWAY_URL}/widget/orbisvoice-widget.js`
      s.onload = () => {
        if (typeof (window as any).OrbisVoice !== 'undefined') {
          ;(window as any).OrbisVoice.init({ publicKey })
        }
      }
      document.body.appendChild(s)
    } else if (typeof (window as any).OrbisVoice !== 'undefined') {
      ;(window as any).OrbisVoice.init({ publicKey })
    }
  }, [publicKey])

  async function runHealthCheck() {
    setTestStatus('loading')
    setTestMsg('')
    try {
      const res = await fetch(`${GATEWAY_URL}/health`)
      if (res.ok) {
        const json = await res.json()
        setTestStatus('ok')
        setTestMsg(`Gateway healthy — ${JSON.stringify(json)}`)
      } else {
        setTestStatus('error')
        setTestMsg(`Gateway returned HTTP ${res.status}`)
      }
    } catch (err) {
      setTestStatus('error')
      setTestMsg(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  async function createTestSession() {
    setTestStatus('loading')
    setTestMsg('')
    try {
      const data = await apiFetch<{ token: string }>('/api/widget/session', { method: 'POST' })
      setTestStatus('ok')
      setTestMsg(`Session token issued: ${data.token.slice(0, 16)}… (gateway will use this when you click the widget mic button)`)
    } catch (err) {
      setTestStatus('error')
      setTestMsg(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>

  const sectionStyle = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Widget Test</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Test the live voice widget and grab the embed code for your website.
      </p>

      {/* Status bar */}
      <div className={isEnabled ? 'alert-success mb-6' : 'alert-error mb-6'}>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: isEnabled ? 'oklch(65% 0.16 145)' : 'oklch(70% 0.14 75)' }} />
          <div className="text-sm">
            {isEnabled
              ? 'Widget channel is enabled. The mic button is live in the bottom-right corner of this page.'
              : 'Widget channel is disabled. Enable it in Channels to activate the mic button and get your embed code.'}
          </div>
        </div>
      </div>

      {/* Gateway health */}
      <section className="mb-8 rounded-xl p-6" style={sectionStyle}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Gateway connectivity</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{GATEWAY_URL}</p>
          </div>
          <button onClick={runHealthCheck} disabled={testStatus === 'loading'}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {testStatus === 'loading' ? 'Checking…' : 'Check health'}
          </button>
        </div>
        {testMsg && (
          <div className={testStatus === 'ok' ? 'alert-success' : 'alert-error'}>
            {testMsg}
          </div>
        )}
      </section>

      {/* Session test */}
      <section className="mb-8 rounded-xl p-6" style={sectionStyle}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Session token test</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Verifies the API can issue a short-lived widget session</p>
          </div>
          <button onClick={createTestSession} disabled={testStatus === 'loading'}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {testStatus === 'loading' ? 'Working…' : 'Issue session'}
          </button>
        </div>
        {testMsg && testStatus !== 'loading' && (
          <div className={testStatus === 'ok' ? 'alert-success' : 'alert-error'}>
            {testMsg}
          </div>
        )}
      </section>

      {/* Embed code */}
      {publicKey && (
        <section className="mb-8 rounded-xl p-6" style={sectionStyle}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Embed code</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Paste this before the closing &lt;/body&gt; tag on your website</p>
            </div>
            <CopyButton text={embedCode} />
          </div>
          <pre className="text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
            style={{ background: 'oklch(15% 0.02 193)', color: 'oklch(75% 0.15 145)' }}>
            {embedCode}
          </pre>
        </section>
      )}

      {/* WordPress plugin download — easier install path for tenants on WP. */}
      {publicKey && (
        <section className="mb-8 rounded-xl p-6" style={sectionStyle}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(55% 0.11 193)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20" />
                </svg>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('widgetWp.title')}</h2>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {t('widgetWp.subtitle')}
              </p>
            </div>
            <a
              href="/downloads/orbisvoice-widget.zip"
              download="orbisvoice-widget.zip"
              className="px-4 py-2 text-sm rounded-lg transition-colors flex-shrink-0 inline-flex items-center gap-1.5"
              style={{ background: 'oklch(55% 0.11 193)', color: 'white', fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1v10m0 0l4-4m-4 4l-4-4M2 13h12" />
              </svg>
              {t('widgetWp.download')}
            </a>
          </div>
          <ol className="text-xs space-y-1 mt-3 ml-1" style={{ color: 'var(--text-secondary)' }}>
            <li>{t('widgetWp.step1')}</li>
            <li>{t('widgetWp.step2')}</li>
            <li>{t('widgetWp.step3')}</li>
          </ol>
        </section>
      )}

      {/* Public key display */}
      {publicKey && (
        <section className="rounded-xl p-6" style={sectionStyle}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Public key</h2>
            <CopyButton text={publicKey} />
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>This key identifies your widget channel. It is safe to include in public HTML.</p>
          <code className="text-xs font-mono px-3 py-2 rounded-lg block"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
            {publicKey}
          </code>
        </section>
      )}

      {!publicKey && !loading && (
        <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
          Enable the Widget channel to generate your public key and embed code.
        </div>
      )}
    </div>
  )
}
