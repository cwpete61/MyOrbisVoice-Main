'use client'

import { useState, useEffect, useRef } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

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
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Widget Test</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Test the live voice widget and grab the embed code for your website.
      </p>

      {/* Status bar */}
      <div className={`mb-6 flex items-start gap-3 p-4 rounded-xl border text-sm ${
        !isEnabled
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
          : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
      }`}>
        <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isEnabled ? 'bg-green-500' : 'bg-amber-400'}`} />
        <div>
          {isEnabled
            ? 'Widget channel is enabled. The mic button is live in the bottom-right corner of this page.'
            : 'Widget channel is disabled. Enable it in Channels to activate the mic button and get your embed code.'}
        </div>
      </div>

      {/* Gateway health */}
      <section className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gateway connectivity</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{GATEWAY_URL}</p>
          </div>
          <button onClick={runHealthCheck} disabled={testStatus === 'loading'}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {testStatus === 'loading' ? 'Checking…' : 'Check health'}
          </button>
        </div>
        {testMsg && (
          <div className={`text-xs px-3 py-2 rounded-lg ${
            testStatus === 'ok'
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
          }`}>
            {testMsg}
          </div>
        )}
      </section>

      {/* Session test */}
      <section className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session token test</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Verifies the API can issue a short-lived widget session</p>
          </div>
          <button onClick={createTestSession} disabled={testStatus === 'loading'}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {testStatus === 'loading' ? 'Working…' : 'Issue session'}
          </button>
        </div>
        {testMsg && testStatus !== 'loading' && (
          <div className={`text-xs px-3 py-2 rounded-lg ${
            testStatus === 'ok'
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
          }`}>
            {testMsg}
          </div>
        )}
      </section>

      {/* Embed code */}
      {publicKey && (
        <section className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Embed code</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Paste this before the closing &lt;/body&gt; tag on your website</p>
            </div>
            <CopyButton text={embedCode} />
          </div>
          <pre className="text-xs bg-gray-950 text-green-400 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {embedCode}
          </pre>
        </section>
      )}

      {/* Public key display */}
      {publicKey && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Public key</h2>
            <CopyButton text={publicKey} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">This key identifies your widget channel. It is safe to include in public HTML.</p>
          <code className="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg block">
            {publicKey}
          </code>
        </section>
      )}

      {!publicKey && !loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          Enable the Widget channel to generate your public key and embed code.
        </div>
      )}
    </div>
  )
}
