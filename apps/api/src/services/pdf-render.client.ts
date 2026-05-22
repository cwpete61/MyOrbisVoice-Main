/**
 * Thin client for the Playwright PDF render service. The API never runs a
 * browser itself — it POSTs report HTML here and gets PDF bytes back. When
 * RENDER_URL is unset (e.g. local dev without the service), returns null so the
 * caller falls back to the pdfkit PDF.
 */
const RENDER_URL = process.env['PDF_RENDER_URL'] || ''
const RENDER_TOKEN = process.env['PDF_RENDER_TOKEN'] || ''

export function renderServiceConfigured(): boolean {
  return Boolean(RENDER_URL)
}

export async function renderPdfFromHtml(html: string): Promise<Buffer | null> {
  if (!RENDER_URL) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 45_000)
    const res = await fetch(`${RENDER_URL.replace(/\/$/, '')}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Render-Token': RENDER_TOKEN },
      body: JSON.stringify({ html }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
    if (!res.ok) {
      console.error('[pdf-render] service returned', res.status)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('[pdf-render] call failed:', (err as Error)?.message)
    return null
  }
}
