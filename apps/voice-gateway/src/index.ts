import 'dotenv/config'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'
import { env } from './lib/env.js'
import { initSentry } from './lib/sentry.js'
import { handleWidgetSession } from './session.js'
import { handleInboundCall } from './inbound.js'
import { handleOutboundCall } from './outbound.js'

// Error monitoring — armed before the server starts. No-ops without a DSN.
initSentry()

const WIDGET_JS = path.resolve(process.cwd(), 'apps/voice-gateway/widget/orbisvoice-widget.js')

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
      const js = fs.readFileSync(WIDGET_JS, 'utf8')
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...CORS_HEADERS,
      })
      res.end(js)
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
