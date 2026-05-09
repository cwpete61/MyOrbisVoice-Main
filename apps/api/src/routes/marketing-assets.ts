import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { getBunnyConfig, storageHostForRegion } from '../services/bunny.service.js'

const router: IRouter = Router()

// Whitelist of partner-portal marketing-kit assets that may be served publicly.
// Adding here is the only way to expose a Bunny path through this proxy.
const ASSETS: Record<string, { path: string; contentType: string }> = {
  'promo-horizontal.mp4':            { path: 'marketing-kit/promo-horizontal.mp4',            contentType: 'video/mp4' },
  'promo-vertical.mp4':              { path: 'marketing-kit/promo-vertical.mp4',              contentType: 'video/mp4' },
  'partner-recruiting-en.mp4':       { path: 'marketing-kit/partner-recruiting-en.mp4',       contentType: 'video/mp4' },
  'social-cut-01-85-percent.mp4':    { path: 'marketing-kit/social-cut-01-85-percent.mp4',    contentType: 'video/mp4' },
  'social-cut-02-five-minute.mp4':   { path: 'marketing-kit/social-cut-02-five-minute.mp4',   contentType: 'video/mp4' },
  'social-cut-03-daily-math.mp4':    { path: 'marketing-kit/social-cut-03-daily-math.mp4',    contentType: 'video/mp4' },
}

router.get('/public/marketing-asset/:filename', asyncHandler(async (req, res) => {
  const filename = req.params['filename'] as string | undefined
  if (!filename) { res.status(400).json({ error: 'filename required' }); return }

  const asset = ASSETS[filename]
  if (!asset) { res.status(404).json({ error: 'not found' }); return }

  const config = await getBunnyConfig()
  if (!config) { res.status(503).json({ error: 'storage not configured' }); return }

  const host = storageHostForRegion(config.storageRegion)
  const upstreamUrl = `https://${host}/${config.storageZone}/${asset.path}`

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
  res.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? asset.contentType)
  const cl = upstream.headers.get('Content-Length'); if (cl) res.setHeader('Content-Length', cl)
  const cr = upstream.headers.get('Content-Range');  if (cr) res.setHeader('Content-Range',  cr)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
  // Defense-in-depth: prevent any browser MIME-sniffing override of our
  // Content-Type. We serve only video/mp4 from this whitelisted endpoint,
  // and the asset whitelist is hardcoded — no chance of a content-type
  // confusion attack today, but the header costs nothing.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Allow cross-origin embedding from app.myorbisvoice.com — helmet's default
  // is `same-origin` which blocks <video src="…api.myorbisvoice.com…"> with
  // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin in the partner marketing-kit grid.
  // The whitelist above ensures only public marketing assets can be fetched
  // through this proxy, so cross-origin is safe here.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  const { Readable } = await import('stream')
  const nodeStream = Readable.fromWeb(upstream.body as any)
  nodeStream.pipe(res)
}))

export default router
