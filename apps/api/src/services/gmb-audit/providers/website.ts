/**
 * Website analyzer — fetches the homepage plus a few auto-discovered key pages
 * (top service page, a location/contact page) and parses on-page, schema, NAP,
 * and service/location signals via regex (no browser dependency — portable).
 *
 * Bounded: max 5 fetches, 1.5 MB + 12s per fetch. JS-only sites parse thin;
 * that's reflected honestly in the scores, never faked.
 */
import type { PageSignals, WebsiteData } from '../types.js'

const MAX_BYTES = 1_500_000
const TIMEOUT_MS = 12_000
const MAX_PAGES = 5
const UA = 'OrbisLocalAudit/1.0 (+https://myorbisvoice.com)'

const SERVICE_HINTS = /(service|services|repair|installation|treatment|solutions|what-we-do|practice-areas?)/i
const LOCATION_HINTS = /(location|locations|areas?-served|service-area|cities|neighborhoods?|contact|directions|near)/i
const CONTACT_HINTS = /(contact|directions|find-us|visit)/i

function normUrl(raw: string): string {
  let u = raw.trim()
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  return u
}

async function fetchPage(url: string): Promise<{ status: number; html: string; finalUrl: string } | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    }).finally(() => clearTimeout(timer))
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return { status: res.status, html: '', finalUrl: res.url || url }
    const buf = await res.arrayBuffer()
    const html = Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8')
    return { status: res.status, html, finalUrl: res.url || url }
  } catch {
    return null
  }
}

function textBetween(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m && m[1] ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) : null
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function jsonLdBlocks(html: string): string[] {
  const out: string[] = []
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) if (m[1]) out.push(m[1])
  return out
}

function parsePage(url: string, kind: PageSignals['kind'], status: number, html: string): PageSignals {
  const text = visibleText(html)
  const ld = jsonLdBlocks(html).join(' ').toLowerCase()
  return {
    url,
    kind,
    status,
    title: textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    hasJsonLdLocalBusiness: /"@type"\s*:\s*"?(localbusiness|[a-z]*business|store|restaurant|professionalservice|attorney|dentist|medicalbusiness|homeandconstructionbusiness|plumber|electrician|locksmith)"?/i.test(ld),
    hasJsonLdService: /"@type"\s*:\s*"?service"?/i.test(ld),
    hasFaqSchema: /"@type"\s*:\s*"?faqpage"?/i.test(ld),
    napPhonePresent: /(\+?\d[\d\s().-]{7,}\d)/.test(text),
    napAddressPresent: /\b\d{1,6}\s+[A-Za-z0-9.\s]+\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|suite|ste|unit)\b/i.test(text),
    clickToCall: /href\s*=\s*["']tel:/i.test(html),
    wordCount: text.split(' ').filter(Boolean).length,
  }
}

/** Pull internal links (same host) with their anchor text. */
function internalLinks(html: string, baseUrl: string): Array<{ href: string; anchor: string }> {
  let host = ''
  try { host = new URL(baseUrl).host } catch { return [] }
  const out: Array<{ href: string; anchor: string }> = []
  const re = /<a\s+[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()
  while ((m = re.exec(html)) !== null) {
    let href = m[1]!.trim()
    const anchor = (m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    try {
      const abs = new URL(href, baseUrl)
      if (abs.host !== host) continue
      href = abs.toString()
      if (seen.has(href) || href === baseUrl) continue
      seen.add(href)
      out.push({ href, anchor })
    } catch { /* skip bad href */ }
  }
  return out
}

export async function analyzeWebsite(rawUrl: string | undefined, city: string): Promise<WebsiteData> {
  const base: WebsiteData = {
    attempted: false, reachable: false, finalUrl: null, https: false,
    pages: [], servicePageCount: 0, locationPageCount: 0,
    cityMentioned: false, hasSchema: false,
  }
  if (!rawUrl) return base
  base.attempted = true

  const homeUrl = normUrl(rawUrl)
  const home = await fetchPage(homeUrl)
  if (!home || !home.html) {
    return { ...base, error: home ? `non-html status ${home.status}` : 'unreachable' }
  }
  base.reachable = true
  base.finalUrl = home.finalUrl
  base.https = home.finalUrl.startsWith('https://')

  const homeSignals = parsePage(home.finalUrl, 'home', home.status, home.html)
  const pages: PageSignals[] = [homeSignals]

  // Classify internal links → count service/location pages, pick a few to fetch.
  const links = internalLinks(home.html, home.finalUrl)
  const serviceLinks = links.filter((l) => SERVICE_HINTS.test(l.href) || SERVICE_HINTS.test(l.anchor))
  const locationLinks = links.filter((l) => LOCATION_HINTS.test(l.href) || LOCATION_HINTS.test(l.anchor))
  base.servicePageCount = serviceLinks.length
  base.locationPageCount = locationLinks.length

  const toFetch: Array<{ href: string; kind: PageSignals['kind'] }> = []
  if (serviceLinks[0]) toFetch.push({ href: serviceLinks[0].href, kind: 'service' })
  const contactLink = locationLinks.find((l) => CONTACT_HINTS.test(l.href) || CONTACT_HINTS.test(l.anchor))
  if (contactLink) toFetch.push({ href: contactLink.href, kind: 'contact' })
  else if (locationLinks[0]) toFetch.push({ href: locationLinks[0].href, kind: 'location' })

  for (const t of toFetch.slice(0, MAX_PAGES - 1)) {
    const p = await fetchPage(t.href)
    if (p && p.html) pages.push(parsePage(p.finalUrl, t.kind, p.status, p.html))
  }

  base.pages = pages
  base.hasSchema = pages.some((p) => p.hasJsonLdLocalBusiness || p.hasJsonLdService || p.hasFaqSchema)

  const cityLc = city.split(/[,\s]+/)[0]?.toLowerCase() ?? ''
  if (cityLc) {
    const blob = `${homeSignals.title ?? ''} ${homeSignals.h1 ?? ''} ${visibleText(home.html).slice(0, 5000)}`.toLowerCase()
    base.cityMentioned = blob.includes(cityLc)
  }
  return base
}
