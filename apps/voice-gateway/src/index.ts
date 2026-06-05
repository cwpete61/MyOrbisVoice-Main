import 'dotenv/config'
import http from 'http'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { WebSocketServer } from 'ws'
import { env } from './lib/env.js'
import { initSentry } from './lib/sentry.js'
import { handleWidgetSession } from './session.js'
import { handleInboundCall } from './inbound.js'
import { handleOutboundCall } from './outbound.js'

// Error monitoring — armed before the server starts. No-ops without a DSN.
initSentry()

const WIDGET_JS = path.resolve(process.cwd(), 'apps/voice-gateway/widget/orbisvoice-widget.js')

// Widget JS is served raw from disk so edits propagate without a rebuild. We
// gzip it (Samsung/mobile pays full uncompressed bytes over cellular otherwise:
// ~40 KB → ~10 KB) and cache the compressed copy keyed by file mtime, so the
// gzip cost is paid once per deploy, not once per request. A deploy rewrites
// the file → new mtime → re-read + re-gzip on the next hit.
let _widgetCache: { mtimeMs: number; raw: Buffer; gz: Buffer } | null = null
function loadWidget() {
  const stat = fs.statSync(WIDGET_JS)
  if (!_widgetCache || _widgetCache.mtimeMs !== stat.mtimeMs) {
    const raw = fs.readFileSync(WIDGET_JS)
    _widgetCache = { mtimeMs: stat.mtimeMs, raw, gz: zlib.gzipSync(raw) }
  }
  return _widgetCache
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const server = http.createServer((req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (req.url === '/widget/orbisvoice-widget.js') {
    try {
      const w = loadWidget()
      const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '')
      const headers: Record<string, string> = {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Vary': 'Accept-Encoding',
        ...CORS_HEADERS,
      }
      if (acceptsGzip) {
        headers['Content-Encoding'] = 'gzip'
        res.writeHead(200, headers)
        res.end(w.gz)
      } else {
        res.writeHead(200, headers)
        res.end(w.raw)
      }
    } catch {
      res.writeHead(404, CORS_HEADERS)
      res.end('Widget not found')
    }
    return
  }

  res.writeHead(404, CORS_HEADERS)
  res.end()
})

const wss         = new WebSocketServer({ noServer: true })
const wssInbound  = new WebSocketServer({ noServer: true })
const wssOutbound = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '', 'http://localhost')
  if (url.pathname === '/ws/widget') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } else if (url.pathname === '/ws/inbound') {
    wssInbound.handleUpgrade(req, socket, head, (ws) => wssInbound.emit('connection', ws, req))
  } else if (url.pathname === '/ws/outbound') {
    wssOutbound.handleUpgrade(req, socket, head, (ws) => wssOutbound.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws, req) => {
  const url   = new URL(req.url ?? '', `http://localhost`)
  const token = url.searchParams.get('token')

  if (!token) {
    ws.close(1008, 'Missing session token')
    return
  }

  handleWidgetSession(ws, token).catch((err) => {
    console.error('[gateway] unhandled widget session error:', err)
    ws.close(1011, 'Internal error')
  })
})

wssInbound.on('connection', (ws) => {
  handleInboundCall(ws).catch((err) => {
    console.error('[gateway] unhandled inbound call error:', err)
    ws.close(1011, 'Internal error')
  })
})

wssOutbound.on('connection', (ws) => {
  handleOutboundCall(ws).catch((err) => {
    console.error('[gateway] unhandled outbound call error:', err)
    ws.close(1011, 'Internal error')
  })
})

server.listen(env.PORT, () => {
  console.log(`[voice-gateway] listening on port ${env.PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
