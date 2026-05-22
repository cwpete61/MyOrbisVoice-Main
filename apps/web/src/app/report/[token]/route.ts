/**
 * Customer-facing shareable report — app.myorbisvoice.com/report/<token>.
 * Public (the unguessable token is the access key). Server-side it fetches the
 * fully-rendered HTML report from the API's public endpoint and returns it, so
 * the prospect opens an interactive 3D presentation with no login.
 *
 * (/r/[code] is the affiliate referral route, so this lives at /report/[token].)
 */
import { NextRequest } from 'next/server'

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const locale = new URL(req.url).searchParams.get('locale') === 'es' ? 'es' : 'en'
  try {
    const res = await fetch(`${API}/api/public/gmb-report/${encodeURIComponent(token)}?locale=${locale}`, {
      cache: 'no-store',
    })
    if (!res.ok) return new Response('Report not found', { status: res.status === 404 ? 404 : 502 })
    const html = await res.text()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  } catch {
    return new Response('Report temporarily unavailable', { status: 502 })
  }
}
