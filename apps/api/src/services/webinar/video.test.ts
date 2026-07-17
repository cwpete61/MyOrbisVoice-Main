import { describe, it, expect } from 'vitest'
import { parseVideoUrl, parseVideoUrlOrThrow, assertSafeHttpUrl } from './video.js'

/**
 * This parser is the boundary between "a tenant pasted a string" and "that string is
 * inside our page". The rejection tests below matter more than the happy path: every
 * one of them is a payload that, with a naive `videoUrl String` column rendered into
 * an iframe src, would execute in our origin.
 */
describe('YouTube — every form a browser bar actually produces', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ',            'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',          'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ',                           'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc123',                 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ',              'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ',               'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ',             'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ',              'dQw4w9WgXcQ'],
    ['  https://youtu.be/dQw4w9WgXcQ  ',                       'dQw4w9WgXcQ'],  // pasted with whitespace
    ['https://www.youtube.com/watch?v=_-aBcD12345',            '_-aBcD12345'],  // base64url charset
  ])('%s → %s', (url, ref) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'YOUTUBE', ref })
  })
})

describe('Vimeo — including the forms where the id is not the last segment', () => {
  it.each([
    ['https://vimeo.com/76979871',                          '76979871'],
    ['https://www.vimeo.com/76979871',                      '76979871'],
    ['https://player.vimeo.com/video/76979871',             '76979871'],
    ['https://vimeo.com/channels/staffpicks/76979871',      '76979871'],
    ['https://vimeo.com/groups/motion/videos/76979871',     '76979871'],
    // Unlisted links carry a hash AFTER the id — taking the last segment would break.
    ['https://vimeo.com/76979871/a1b2c3d4e5',               '76979871'],
  ])('%s → %s', (url, ref) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'VIMEO', ref })
  })
})

describe('rejects — these are the reason this file exists', () => {
  it.each([
    // Script execution. `new URL()` accepts all of these, so z.string().url() would too.
    ['javascript:alert(document.cookie)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
    ['file:///etc/passwd'],
    // Not a video host — an attacker-controlled origin framed inside our page.
    ['https://evil.example.com/watch?v=dQw4w9WgXcQ'],
    // Lookalike hosts. Substring matching on "youtube.com" would pass both.
    ['https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'],
    ['https://notyoutube.com/watch?v=dQw4w9WgXcQ'],
    ['https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ'],
    // Right host, junk id — must not become a template hole.
    ['https://www.youtube.com/watch?v='],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/watch?v=waaaaaaaaaaytoolong'],
    ['https://www.youtube.com/watch?v=abc"><script>alert(1)</script>'],
    ['https://vimeo.com/not-a-number'],
    ['https://www.youtube.com/'],
    ['https://vimeo.com/'],
    // Bare ids are refused on purpose — indistinguishable from a typo.
    ['dQw4w9WgXcQ'],
    ['76979871'],
    [''],
    ['   '],
    ['not a url at all'],
  ])('rejects %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull()
  })

  it('throws a 422 the tenant can act on', () => {
    expect(() => parseVideoUrlOrThrow('https://evil.example/x')).toThrow(/YouTube or Vimeo/)
  })
})

describe('assertSafeHttpUrl — CTA and lead-magnet links', () => {
  it('accepts a real booking link', () => {
    expect(assertSafeHttpUrl('https://cal.com/orbis/intro', 'CTA link')).toBe('https://cal.com/orbis/intro')
  })

  it('accepts http for a local/legacy destination', () => {
    expect(assertSafeHttpUrl('http://example.com/x', 'CTA link')).toBe('http://example.com/x')
  })

  // An href, not an iframe — but javascript: in an href is still execution on click.
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd'])(
    'rejects %s',
    (url) => { expect(() => assertSafeHttpUrl(url, 'CTA link')).toThrow(/not allowed/) },
  )

  it('rejects a bare word', () => {
    expect(() => assertSafeHttpUrl('cal.com/orbis', 'CTA link')).toThrow(/full URL/)
  })
})
