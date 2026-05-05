/**
 * Website pre-flight checker for Twilio A2P 10DLC and Voice Integrity approval.
 *
 * Best-effort HTML inspection — fetches the URL and a couple of common
 * sub-pages (e.g. privacy, terms), looks for the elements Twilio's reviewers
 * audit. Designed to be conservative: if we can't determine something, we
 * return "unknown" rather than a false positive/negative.
 *
 * Limitations (documented to the user in the UI):
 *   - JS-only sites that render content client-side won't be fully crawled
 *   - PDF policies aren't downloaded
 *   - Some sites block server-side scrapers (Cloudflare, etc.)
 */

const MAX_BYTES = 1_500_000  // cap ~1.5 MB per page so we don't OOM on giant sites
const TIMEOUT_MS = 15_000
const USER_AGENT = 'OrbisVoiceWebsiteChecker/1.0 (+https://myorbisvoice.com)'

export type WebsiteFinding = {
  ok: boolean | null    // true = passes, false = fails, null = couldn't determine
  label: string         // human-readable check name
  detail: string        // why we reached this conclusion
}

export type WebsiteCheckResult = {
  url: string
  reachable: boolean
  finalUrl?: string     // after redirects
  fetchError?: string
  contentType?: string
  findings: WebsiteFinding[]
  pagesChecked: string[]
}

async function fetchWithTimeout(url: string): Promise<{ html: string; finalUrl: string; status: number; contentType: string } | { error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('text/html')) {
      return { error: `Server returned ${contentType || 'unknown content type'}, not HTML` }
    }
    if (!res.ok) {
      return { error: `HTTP ${res.status} ${res.statusText}` }
    }
    // Read up to MAX_BYTES so we don't OOM on giant pages
    const reader = res.body?.getReader()
    if (!reader) return { error: 'No response body' }
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let html = ''
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BYTES) { reader.cancel(); break }
      html += decoder.decode(value, { stream: true })
    }
    return { html, finalUrl: res.url, status: res.status, contentType }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: controller.signal.aborted ? `Request timed out after ${TIMEOUT_MS / 1000}s` : msg }
  } finally {
    clearTimeout(timer)
  }
}

/** Extract anchor tags as { href, text } pairs. Crude but works for the body text+href patterns Twilio looks at. */
function extractAnchors(html: string): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = []
  // Strip script/style content first to avoid garbage
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  // Greedy regex for <a ... href="...">text</a>
  const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for (let m = re.exec(cleaned); m !== null; m = re.exec(cleaned)) {
    const href = (m[1] ?? '').trim()
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (href) results.push({ href, text })
  }
  return results
}

/** Strip tags and collapse whitespace — for keyword matching against visible text. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try { return new URL(href, baseUrl).toString() } catch { return null }
}

function findLinkMatching(anchors: Array<{ href: string; text: string }>, baseUrl: string, patterns: RegExp[]): { url: string; via: 'text' | 'href' } | null {
  for (const a of anchors) {
    const t = a.text.toLowerCase()
    if (patterns.some(p => p.test(t))) {
      const u = resolveUrl(a.href, baseUrl)
      if (u) return { url: u, via: 'text' }
    }
  }
  for (const a of anchors) {
    const h = a.href.toLowerCase()
    if (patterns.some(p => p.test(h))) {
      const u = resolveUrl(a.href, baseUrl)
      if (u) return { url: u, via: 'href' }
    }
  }
  return null
}

export async function checkWebsite(rawUrl: string): Promise<WebsiteCheckResult> {
  // Normalize the URL — accept "myorbisvoice.com" and assume https
  let url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  let parsed: URL
  try { parsed = new URL(url) }
  catch { return { url: rawUrl, reachable: false, fetchError: 'Invalid URL', findings: [], pagesChecked: [] } }

  const findings: WebsiteFinding[] = []
  const pagesChecked: string[] = []

  // Check 1: HTTPS
  findings.push({
    ok: parsed.protocol === 'https:',
    label: 'HTTPS (secure connection)',
    detail: parsed.protocol === 'https:' ? `Site loaded over ${parsed.protocol}` : `Site uses ${parsed.protocol} — Twilio rejects http:// for Voice Integrity`,
  })

  // Fetch the home page
  const home = await fetchWithTimeout(url)
  if ('error' in home) {
    findings.push({
      ok: false,
      label: 'Site reachable',
      detail: `Could not fetch the home page: ${home.error}. The site may be blocking server-side requests, down, or behind a firewall. If you know the site is live, you may need to verify the rest of these checks manually.`,
    })
    return { url, reachable: false, fetchError: home.error, findings, pagesChecked: [url] }
  }
  pagesChecked.push(home.finalUrl)
  findings.push({ ok: true, label: 'Site reachable', detail: `Loaded successfully (${home.contentType})` })

  const anchors = extractAnchors(home.html)
  const homeText = visibleText(home.html)

  // Check 2: Has a Privacy Policy link
  const privacyLink = findLinkMatching(anchors, home.finalUrl, [/privacy/i])
  if (privacyLink) {
    findings.push({ ok: true, label: 'Privacy Policy link present', detail: `Found via link ${privacyLink.via}: ${privacyLink.url}` })
  } else {
    findings.push({ ok: false, label: 'Privacy Policy link present', detail: 'No link with "Privacy" in the text or URL was found on the home page. Twilio rejects 10DLC submissions without a published Privacy Policy.' })
  }

  // Check 3: Has a Terms / TOS link
  const termsLink = findLinkMatching(anchors, home.finalUrl, [/\bterms\b/i, /conditions/i, /\btos\b/i, /terms[-\s]of[-\s](use|service)/i])
  if (termsLink) {
    findings.push({ ok: true, label: 'Terms & Conditions link present', detail: `Found via link ${termsLink.via}: ${termsLink.url}` })
  } else {
    findings.push({ ok: false, label: 'Terms & Conditions link present', detail: 'No link with "Terms" or "Conditions" in the text or URL was found on the home page.' })
  }

  // Check 4: Mention of contact info on the homepage (phone, email, or address)
  const phoneOnHome  = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(homeText)
  const emailOnHome  = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(homeText)
  if (phoneOnHome || emailOnHome) {
    findings.push({ ok: true, label: 'Contact info visible on home page', detail: `Found ${phoneOnHome ? 'phone' : ''}${phoneOnHome && emailOnHome ? ' and ' : ''}${emailOnHome ? 'email' : ''} on the home page` })
  } else {
    findings.push({ ok: null, label: 'Contact info visible on home page', detail: 'Could not detect a phone number or email address. Twilio expects visible contact info, but it may be on your Contact page (we did not crawl that). Verify manually.' })
  }

  // Check 5: Privacy Policy mentions SMS / mobile / messaging
  if (privacyLink) {
    const privacyResp = await fetchWithTimeout(privacyLink.url)
    if (!('error' in privacyResp)) {
      pagesChecked.push(privacyResp.finalUrl)
      const privacyText = visibleText(privacyResp.html)
      const mentionsSms      = /\b(sms|text message|text messages|mobile message|messaging)\b/.test(privacyText)
      const mentionsNotShare = /(not\s+(?:be\s+)?(?:sold|shared|sold or shared|shared with|disclosed)|will not\s+(?:share|sell|disclose)|do not (?:share|sell|disclose))/.test(privacyText)
      if (mentionsSms && mentionsNotShare) {
        findings.push({ ok: true, label: 'Privacy Policy includes SMS clause', detail: 'Privacy Policy mentions SMS / messaging AND a "do not share" clause. Looks compliant.' })
      } else if (mentionsSms) {
        findings.push({ ok: false, label: 'Privacy Policy includes SMS clause', detail: 'Privacy Policy mentions SMS but does not appear to include the required "mobile data not shared with third parties" clause. Twilio specifically requires this.' })
      } else {
        findings.push({ ok: false, label: 'Privacy Policy includes SMS clause', detail: 'Privacy Policy does not mention SMS, text messaging, or mobile messaging. Twilio requires an SMS Communications section.' })
      }
    } else {
      findings.push({ ok: null, label: 'Privacy Policy includes SMS clause', detail: `Could not fetch the Privacy Policy page: ${privacyResp.error}. May be a PDF or behind auth — verify manually.` })
    }
  }

  // Check 6: SMS-related keyword on the home or contact page (a hint that opt-in language exists somewhere)
  const smsHintOnHome = /\b(sms|text message|text us|opt in|opt-in)\b/i.test(homeText)
  if (smsHintOnHome) {
    findings.push({ ok: true, label: 'SMS opt-in language hint found', detail: 'Home page contains SMS / opt-in language. We could not verify a real opt-in checkbox without rendering forms, but the language is present.' })
  } else {
    findings.push({ ok: null, label: 'SMS opt-in checkbox', detail: 'No SMS-related keywords found on the home page. The opt-in checkbox is usually on a contact or booking page (we did not crawl those). If you have the checkbox in place, verify manually using the template in Step 3.' })
  }

  return { url: rawUrl, reachable: true, finalUrl: home.finalUrl, contentType: home.contentType, findings, pagesChecked }
}
