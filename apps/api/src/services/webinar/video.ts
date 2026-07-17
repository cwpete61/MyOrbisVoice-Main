/**
 * MyOrbisWebinar — video source parsing.
 *
 * A tenant pastes whatever their browser bar says. We turn that into a
 * (provider, native id) pair and store ONLY that. The watch page rebuilds the embed
 * URL from a fixed per-provider template, so the tenant's string never reaches an
 * iframe src.
 *
 * That indirection is the whole security design, and it is why this file exists
 * rather than a `videoUrl String` column:
 *
 *   - Storing the raw URL and rendering <iframe src={w.videoUrl}> makes any tenant
 *     (or anyone who can write a webinar) a stored-XSS author: `javascript:…`,
 *     `data:text/html,…`, or an attacker-controlled origin inside our page.
 *   - z.string().url() does NOT save you — it delegates to the URL parser, which
 *     happily accepts `javascript:alert(1)`. Protocol has to be checked explicitly.
 *   - An id that matched /^[A-Za-z0-9_-]{11}$/ cannot express a scheme, a host, or a
 *     quote. The template is a constant. There is nothing left to inject.
 *
 * Parse strictly and reject: a "not a supported video URL" message costs a tenant ten
 * seconds; a permissive fallback costs everyone.
 */
import { AppError } from '@voiceautomation/shared'

export type VideoProvider = 'YOUTUBE' | 'VIMEO'

export interface ParsedVideo {
  provider: VideoProvider
  /** The provider's native id. Never a URL. */
  ref: string
}

/** YouTube ids are exactly 11 chars of base64url. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
/** Vimeo ids are numeric. */
const VIMEO_ID = /^[0-9]{6,12}$/

// youtube-nocookie.com is here because "Share → Embed → privacy-enhanced mode" hands
// you that host — and because it is the host WE render. Omitting it meant our own
// preview's embed code was a URL we refused to accept.
const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtu.be', 'www.youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

/** youtube.com/<kind>/<id> forms. /watch carries the id in ?v= instead. */
const YOUTUBE_PATH_KINDS = new Set(['embed', 'v', 'live', 'shorts'])

function parseYouTube(u: URL): string | null {
  // youtu.be/<id>
  if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be') {
    return u.pathname.slice(1).split('/')[0] ?? null
  }
  // youtube.com/watch?v=<id>
  const v = u.searchParams.get('v')
  if (v) return v

  // youtube.com/{embed,v,live,shorts}/<id>
  const [kind, id] = u.pathname.split('/').filter(Boolean)
  if (kind && id && YOUTUBE_PATH_KINDS.has(kind)) return id

  return null
}

function parseVimeo(u: URL): string | null {
  // vimeo.com/<id>, vimeo.com/channels/<name>/<id>, vimeo.com/groups/<g>/videos/<id>,
  // player.vimeo.com/video/<id>. In every form the id is the last numeric segment —
  // NOT simply the last segment, since /<id>/<unlisted-hash> also exists.
  const segments = u.pathname.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]!
    if (VIMEO_ID.test(s)) return s
  }
  return null
}

/**
 * Pull the src out of a pasted <iframe> blob.
 *
 * "Share → Embed" on YouTube and Vimeo gives a full `<iframe width="560" src="…">`, and
 * that is the most natural thing for someone to paste into a field asking for a video.
 * Refusing it is technically correct and practically useless.
 *
 * This does NOT weaken anything: we take the src and run it through exactly the same
 * host + protocol + id checks as a hand-typed URL. The iframe's own attributes are
 * discarded — we rebuild the embed from our template regardless. So the worst a hostile
 * blob can do is supply a URL that then fails the same gate it would have failed alone.
 */
function srcFromIframe(raw: string): string | null {
  if (!/<\s*iframe/i.test(raw)) return null
  const m = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(raw)
  return m?.[1] ?? null
}

/**
 * Parse a pasted video URL. Returns null for anything we can't confidently identify —
 * the caller decides whether that's a validation error or a cleared field.
 *
 * Accepts a plain URL or a full <iframe> embed blob; both end up in the same checks.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  const raw = (srcFromIframe(input) ?? input).trim()
  if (!raw) return null

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null // not a URL at all. We deliberately do NOT accept a bare id: "dQw4w9WgXcQ"
  }               // and a Vimeo id are indistinguishable from a typo.

  // Scheme check FIRST. `new URL('javascript:alert(1)')` parses fine.
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null

  const host = u.hostname.toLowerCase()

  if (YOUTUBE_HOSTS.has(host)) {
    const ref = parseYouTube(u)
    return ref && YOUTUBE_ID.test(ref) ? { provider: 'YOUTUBE', ref } : null
  }
  if (VIMEO_HOSTS.has(host)) {
    const ref = parseVimeo(u)
    return ref && VIMEO_ID.test(ref) ? { provider: 'VIMEO', ref } : null
  }
  return null
}

/** Parse or throw a 422 the tenant can act on. */
export function parseVideoUrlOrThrow(input: string): ParsedVideo {
  const parsed = parseVideoUrl(input)
  if (!parsed) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Paste a YouTube or Vimeo link (e.g. https://youtu.be/dQw4w9WgXcQ or https://vimeo.com/76979871).',
      422,
    )
  }
  return parsed
}

/**
 * Validate a tenant-supplied outbound link (CTA / lead magnet).
 *
 * These land in an href rather than an iframe src, but `javascript:` in an href is
 * still script execution in our origin on click. http(s) only, same reasoning as above.
 */
export function assertSafeHttpUrl(input: string, field: string): string {
  const raw = input.trim()
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new AppError('VALIDATION_ERROR', `${field} must be a full URL starting with https://`, 422)
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new AppError('VALIDATION_ERROR', `${field} must start with https:// — "${u.protocol}" is not allowed`, 422)
  }
  return u.toString()
}
