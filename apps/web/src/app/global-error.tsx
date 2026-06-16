'use client'

import { useEffect } from 'react'

/**
 * Root error boundary. Primary job: auto-heal stale-chunk crashes after a deploy.
 * When a tab opened before a deploy lazy-loads a chunk hash that no longer exists,
 * React throws ChunkLoadError and renders this boundary (the head-script
 * window.onerror handler never sees it because React swallows it). We detect that
 * specific error and force ONE full reload to pull the current bundle.
 * sessionStorage guard prevents a reload loop if the fresh load also fails.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunk = /ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk/i.test(error?.message || '')

  useEffect(() => {
    if (!isChunk) return
    try {
      const k = 'mov_chunk_reload'
      const last = Number(sessionStorage.getItem(k)) || 0
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(k, String(Date.now()))
        window.location.reload()
      }
    } catch { window.location.reload() }
  }, [isChunk])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f7', color: '#0a201f', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
            {isChunk ? 'Updating to the latest version…' : 'Something went wrong.'}
          </h1>
          <p style={{ fontSize: 14, color: '#3f615f', lineHeight: 1.5, margin: '0 0 16px' }}>
            {isChunk
              ? 'A new version just shipped. Reloading automatically — if nothing happens, tap below.'
              : 'Please reload the page. If it keeps happening, contact support.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(100deg, #0e8f8f, #0c6f6e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
