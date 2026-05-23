import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'
import { isPublishableFilename } from '../services/marketing-kit.service.js'

const router: IRouter = Router()

// The set of serveable marketing-kit files is driven by the MarketingKitVideo
// table (admin-managed). A row with a non-null `filename` = serveable. Admins
// add or delete rows from the admin UI ("Content > Marketing Kit"); deleting a
// row revokes the public asset URL immediately. There is no longer any code-
// level whitelist.

router.get('/public/marketing-asset/:filename', asyncHandler(async (req, res) => {
  const filename = req.params['filename'] as string | undefined
  if (!filename) { res.status(400).json({ error: 'filename required' }); return }

  // Defense in depth: reject anything that could escape marketing-kit/ on
  // Bunny via path traversal or directory confusion.
  if (filename.includes('/') || filename.includes('..')) {
    res.status(400).json({ error: 'invalid filename' })
    return
  }
  if (!(await isPublishableFilename(filename))) { res.status(404).json({ error: 'not found' }); return }

  const config = await getBunnyConfig()
  if (!config) { res.status(503).json({ error: 'storage not configured' }); return }

  const host = storageHostForRegion(config.storageRegion)
  const upstreamUrl = `https://${host}/${config.storageZone}/marketing-kit/${filename}`

  // Forward Range header so the browser can seek the video efficiently.
  const headers: Record<string, string> = { AccessKey: config.storagePassword }
  const range = req.headers['range']
  if (typeof range === 'string') headers['Range'] = range

  const upstream = await fetch(upstreamUrl, { headers })
  if (!upstream.ok && upstream.status !== 206) {
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'upstream error' })
    return
  }

  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'video/mp4')
  const cl = upstream.headers.get('Content-Length'); if (cl) res.setHeader('Content-Length', cl)
  const cr = upstream.headers.get('Content-Range');  if (cr) res.setHeader('Content-Range',  cr)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
  // Defense-in-depth: prevent any browser MIME-sniffing override of our
  // Content-Type. We serve only video/mp4 from this endpoint.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Allow cross-origin embedding from app.myorbisvoice.com — helmet's default
  // (`same-origin`) blocks <video src="…api.myorbisvoice.com…"> with
  // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin in the partner marketing-kit grid.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  const { Readable } = await import('stream')
  const nodeStream = Readable.fromWeb(upstream.body as any)
  nodeStream.pipe(res)
}))

export default router
