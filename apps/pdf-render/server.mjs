/**
 * PDF render service — isolates headless Chromium (Playwright) so the lean API
 * stays browser-free. Internal-only: the API POSTs report HTML, this renders it
 * to PDF (waiting for ECharts/echarts-gl to finish, incl. WebGL 3D) and streams
 * the bytes back.
 *
 *   POST /render   { html, landscape? }  ->  application/pdf
 *   GET  /health                          ->  200 ok
 *
 * Auth: X-Render-Token must match RENDER_TOKEN (shared secret, internal net).
 */
import http from 'node:http'
import { chromium } from 'playwright'

const PORT = Number(process.env.PORT || 4500)
const RENDER_TOKEN = process.env.RENDER_TOKEN || ''
const MAX_BODY = 4 * 1024 * 1024 // 4 MB of HTML is plenty

// One long-lived browser; a fresh context/page per request.
let browser
async function getBrowser() {
  if (browser && browser.isConnected()) return browser
  browser = await chromium.launch({
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
  })
  return browser
}

async function renderPdf(html, landscape) {
  const b = await getBrowser()
  const ctx = await b.newContext({ viewport: { width: 960, height: 1400 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForFunction('window.__chartsReady===true', { timeout: 12000 }).catch(() => {})
    await page.waitForTimeout(2200) // let WebGL 3D settle
    return await page.pdf({ format: 'Letter', landscape: !!landscape, printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } })
  } finally {
    await ctx.close()
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200).end('ok'); return }
  if (req.method !== 'POST' || !req.url?.startsWith('/render')) { res.writeHead(404).end('not found'); return }
  if (RENDER_TOKEN && req.headers['x-render-token'] !== RENDER_TOKEN) { res.writeHead(401).end('unauthorized'); return }

  let body = ''
  let aborted = false
  req.on('data', (c) => {
    body += c
    if (body.length > MAX_BODY) { aborted = true; res.writeHead(413).end('too large'); req.destroy() }
  })
  req.on('end', async () => {
    if (aborted) return
    try {
      const { html, landscape } = JSON.parse(body)
      if (!html || typeof html !== 'string') { res.writeHead(400).end('html required'); return }
      const pdf = await renderPdf(html, landscape)
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length }).end(pdf)
    } catch (err) {
      console.error('[render] error:', err?.message)
      res.writeHead(500).end('render failed')
    }
  })
})

server.listen(PORT, () => console.log(`[pdf-render] listening on ${PORT}`))

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { try { await browser?.close() } catch {} process.exit(0) })
}
