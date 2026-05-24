// Render service — Express + Remotion programmatic renderer. Bundles the
// composition graph once at startup; each request just renders a still or
// video from a known compositionId + inputProps.
//
// Endpoints:
//   GET  /health                              → { ok: true }
//   POST /still  { compositionId, props }     → image/png (or image/jpeg)
//   POST /video  { compositionId, props }     → video/mp4
//
// Auth: every non-health route checks `X-Render-Token: <RENDER_TOKEN>`. The
// service is bound only to the internal docker network (no caddy edge), so
// the token is defense-in-depth against the api container being compromised.

import express from 'express'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderStill, renderMedia } from '@remotion/renderer'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT          = Number(process.env.PORT || 4600)
const RENDER_TOKEN  = process.env.RENDER_TOKEN || ''
const MAX_BODY      = '16mb' // JSON body size cap; props can carry base64 image bg (gpt-image-1 ≈ 3 MB)

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
// Bundler entry = index.ts which calls registerRoot(RemotionRoot). Resolved
// relative to the compiled server location.
const ROOT_TSX = join(__dirname, '../src/index.ts')

const app = express()
app.use(express.json({ limit: MAX_BODY }))

// Bundle once at boot. Remotion writes the bundle to a temp dir; we keep the
// URL for the lifetime of the process.
let bundleLocation: string | null = null
let bundleErr: Error | null = null
const bootBundle = (async () => {
  try {
    console.log('[render] bundling compositions…')
    bundleLocation = await bundle({ entryPoint: ROOT_TSX })
    console.log('[render] bundle ready:', bundleLocation)
  } catch (err) {
    bundleErr = err as Error
    console.error('[render] bundle failed:', err)
  }
})()

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!RENDER_TOKEN) return next() // open in dev/local
  if (req.header('x-render-token') === RENDER_TOKEN) return next()
  res.status(401).json({ error: 'invalid render token' })
}

app.get('/health', async (_req, res) => {
  await bootBundle
  if (bundleErr) { res.status(503).json({ ok: false, error: bundleErr.message }); return }
  res.json({ ok: true, bundleReady: !!bundleLocation })
})

app.post('/still', auth, async (req, res) => {
  await bootBundle
  if (!bundleLocation) { res.status(503).json({ error: 'bundle not ready' }); return }
  const { compositionId, props, format } = req.body as { compositionId: string; props?: Record<string, unknown>; format?: 'png' | 'jpeg' }
  if (!compositionId) { res.status(400).json({ error: 'compositionId required' }); return }
  const tmp = mkdtempSync(join(tmpdir(), 'render-still-'))
  const out = join(tmp, `still.${format ?? 'png'}`)
  try {
    const comp = await selectComposition({
      serveUrl: bundleLocation,
      id:        compositionId,
      inputProps: props ?? {},
    })
    await renderStill({
      composition: comp,
      serveUrl:    bundleLocation,
      output:      out,
      imageFormat: format ?? 'png',
      inputProps:  props ?? {},
    })
    const buf = readFileSync(out)
    res.setHeader('Content-Type', format === 'jpeg' ? 'image/jpeg' : 'image/png')
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

app.post('/video', auth, async (req, res) => {
  await bootBundle
  if (!bundleLocation) { res.status(503).json({ error: 'bundle not ready' }); return }
  const { compositionId, props } = req.body as { compositionId: string; props?: Record<string, unknown> }
  if (!compositionId) { res.status(400).json({ error: 'compositionId required' }); return }
  const tmp = mkdtempSync(join(tmpdir(), 'render-video-'))
  const out = join(tmp, 'video.mp4')
  try {
    const comp = await selectComposition({
      serveUrl: bundleLocation,
      id:        compositionId,
      inputProps: props ?? {},
    })
    await renderMedia({
      composition: comp,
      serveUrl:    bundleLocation,
      codec:       'h264',
      outputLocation: out,
      inputProps:  props ?? {},
    })
    const buf = readFileSync(out)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

app.listen(PORT, () => {
  console.log(`[render] listening on :${PORT}`)
})
