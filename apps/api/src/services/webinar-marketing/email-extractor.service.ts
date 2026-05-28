/**
 * Email extractor + obfuscation decoder.
 *
 * Given raw HTML (or already-decoded text), returns the unique business
 * emails found in plain or obfuscated form, plus a short context snippet
 * for each so the manual-review queue can show humans where each email
 * came from.
 *
 * Decodes:
 *   - "name [at] domain [dot] com"     — bracket-spaced
 *   - "name(at)domain(dot)com"         — paren-no-space
 *   - "name AT domain DOT com"         — caps + spaces
 *   - "name &#64; domain &#46; com"    — HTML entity-encoded
 *   - "name@domain.com" wrapped in <a href="mailto:...">
 *   - Cloudflare-encoded /cdn-cgi/l/email-protection (decoded)
 *
 * Does NOT:
 *   - Execute JS
 *   - Submit forms
 *   - Decode JavaScript-built email strings beyond the cf-email pattern
 */

import * as cheerio from 'cheerio'

export interface ExtractedEmail {
  email: string
  /** ~200-char text window around the email in the source. */
  context: string
}

const EMAIL_REGEX = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi

export function extractEmails(html: string): ExtractedEmail[] {
  // 1. Decode HTML entities + obfuscation tokens to plaintext.
  const decoded = decodeAll(html)

  // 2. Pull all email-looking strings out.
  const seen = new Set<string>()
  const out: ExtractedEmail[] = []

  // Cheerio pass — also catches mailto: hrefs explicitly + handles
  // Cloudflare-encoded /cdn-cgi/l/email-protection.
  try {
    const $ = cheerio.load(html)
    $('a[href^="mailto:"]').each((_i, el) => {
      const href = $(el).attr('href') ?? ''
      const email = href.replace(/^mailto:/i, '').split('?')[0]?.trim()
      if (email) collect(email, $(el).text() || email, seen, out)
    })
    $('a.__cf_email__, span.__cf_email__').each((_i, el) => {
      const encoded = $(el).attr('data-cfemail')
      if (encoded) {
        const decoded2 = decodeCfEmail(encoded)
        if (decoded2) collect(decoded2, $(el).text() || decoded2, seen, out)
      }
    })
  } catch {
    // Cheerio failure on weird input — fall through to regex scan.
  }

  // Regex scan on decoded plaintext for everything else.
  let m: RegExpExecArray | null
  EMAIL_REGEX.lastIndex = 0
  while ((m = EMAIL_REGEX.exec(decoded))) {
    const email = m[1] ?? ''
    if (!email) continue
    const start = Math.max(0, m.index - 80)
    const end = Math.min(decoded.length, m.index + email.length + 80)
    const context = decoded.slice(start, end).replace(/\s+/g, ' ').trim()
    collect(email, context, seen, out)
  }

  return out
}

function collect(
  emailRaw: string,
  context: string,
  seen: Set<string>,
  out: ExtractedEmail[],
): void {
  const email = emailRaw.toLowerCase().trim()
  if (!email || !/^[^\s]+@[^\s]+\.[^\s]+$/.test(email)) return
  if (seen.has(email)) return
  seen.add(email)
  out.push({ email, context })
}

/**
 * Decode common obfuscation tokens AND HTML entities to plaintext, so the
 * regex scan can find the underlying address. We replace in-place rather
 * than re-parse — order matters (entity decode before token decode).
 */
function decodeAll(input: string): string {
  let s = input

  // HTML entity decode — & quot/lt/gt/amp/#NN/#xNN.
  s = s.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
    String.fromCharCode(parseInt(n, 16)),
  )
  s = s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'")
  s = s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&nbsp;', ' ')

  // Obfuscation tokens — variations of (at)/[at]/ AT /(dot)/[dot]/ DOT.
  // Order from most-specific to least so we don't mangle valid email chars.
  const atVariants = [
    /\s*\[\s*at\s*\]\s*/gi,
    /\s*\(\s*at\s*\)\s*/gi,
    /\s+at\s+/gi, // bare " AT " surrounded by spaces
  ]
  const dotVariants = [
    /\s*\[\s*dot\s*\]\s*/gi,
    /\s*\(\s*dot\s*\)\s*/gi,
    /\s+dot\s+/gi,
  ]
  for (const r of atVariants) s = s.replace(r, '@')
  for (const r of dotVariants) s = s.replace(r, '.')

  return s
}

/**
 * Cloudflare email-protection decoder. data-cfemail is hex; first byte is
 * the XOR key, remaining bytes are the encoded address.
 * Reference: https://usamaejaz.com/cloudflare-email-decoder/
 */
function decodeCfEmail(encoded: string): string | null {
  try {
    const hex = encoded.trim()
    if (hex.length < 4 || hex.length % 2 !== 0) return null
    const key = parseInt(hex.substring(0, 2), 16)
    let out = ''
    for (let i = 2; i < hex.length; i += 2) {
      const byte = parseInt(hex.substring(i, i + 2), 16) ^ key
      out += String.fromCharCode(byte)
    }
    return /^[^\s]+@[^\s]+\.[^\s]+$/.test(out) ? out.toLowerCase() : null
  } catch {
    return null
  }
}
