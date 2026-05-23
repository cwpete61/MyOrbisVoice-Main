// Render-service client. Calls the dedicated Remotion render container over
// the internal docker network. The api never speaks to Chromium directly —
// every still/video render flows through here, keeping the api container
// lean (no browser deps).
//
// Env:
//   RENDER_SERVICE_URL   default http://render:4600  (internal network alias)
//   RENDER_TOKEN         shared secret; required if the render service has one
//
// The render container is NOT publicly reachable; the only thing exposed via
// caddy is api/web/gateway/n8n. Compromise of api ≠ compromise of render.

import { AppError } from '@voiceautomation/shared'

const RENDER_URL   = process.env['RENDER_SERVICE_URL'] || 'http://render:4600'
const RENDER_TOKEN = process.env['RENDER_TOKEN']       || ''

export interface RenderRequest {
  compositionId: string
  props?:        Record<string, unknown>
  format?:       'png' | 'jpeg'   // stills only
}

export async function renderStill(req: RenderRequest): Promise<Buffer> {
  return postRender('still', req)
}

export async function renderVideo(req: RenderRequest): Promise<Buffer> {
  return postRender('video', req)
}

async function postRender(kind: 'still' | 'video', req: RenderRequest): Promise<Buffer> {
  const url = `${RENDER_URL}/${kind}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (RENDER_TOKEN) headers['X-Render-Token'] = RENDER_TOKEN
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(req) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPSTREAM_ERROR', `render service ${res.status}: ${text.slice(0, 200)}`, 502)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function renderHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${RENDER_URL}/health`)
    if (!res.ok) return false
    const json = await res.json() as { ok?: boolean }
    return !!json.ok
  } catch { return false }
}
