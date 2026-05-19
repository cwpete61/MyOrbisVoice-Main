/**
 * Public cold-email unsubscribe endpoint — no auth (hit by email recipients).
 *
 * Two callers:
 *   - POST  — the one-click unsubscribe (List-Unsubscribe-Post header), and
 *             the friendly /unsubscribe web page's confirm call.
 *   - GET   — fallback for a plain mail client that just opens the header URL.
 *
 * The visible footer link points at the web page; this endpoint is what the
 * web page and the one-click POST both hit.
 */
import { Router, type IRouter, type Request, type Response } from 'express'
import { unsubscribeByToken, recordClick } from '../services/cold-email.service.js'

const router: IRouter = Router()

const WEB_BASE_URL = (process.env['WEB_BASE_URL'] || 'https://app.myorbisvoice.com').replace(/\/$/, '')

function tokenFrom(req: Request): string {
  const q = req.query['token']
  const b = (req.body as { token?: unknown } | undefined)?.token
  return String((typeof q === 'string' ? q : null) ?? (typeof b === 'string' ? b : '') ?? '')
}

router.post('/public/unsubscribe', async (req: Request, res: Response) => {
  const result = await unsubscribeByToken(tokenFrom(req))
  res.json({ data: { ok: result.ok } })
})

router.get('/public/unsubscribe', async (req: Request, res: Response) => {
  const result = await unsubscribeByToken(tokenFrom(req))
  res.set('Content-Type', 'text/html; charset=utf-8')
  const body = result.ok
    ? '<h2>Unsubscribed</h2><p>You will not be emailed again. / No volveremos a enviarte correos.</p>'
    : '<h2>Link expired</h2><p>This unsubscribe link is no longer valid. / Este enlace ya no es válido.</p>'
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:64px auto;padding:0 24px;text-align:center;color:#1a1a1a">${body}</body></html>`)
})

/** Click-tracked booking CTA — records the click, then 302s to the partner's
 *  public booking page. Falls back to the app home if the token is unknown. */
router.get('/public/cl/:token', async (req: Request, res: Response) => {
  const { slug } = await recordClick(String(req.params['token'] ?? ''))
  res.redirect(302, slug ? `${WEB_BASE_URL}/book/${encodeURIComponent(slug)}` : WEB_BASE_URL)
})

export default router
