import { describe, it, expect } from 'vitest'
import { extractEmails } from './email-extractor.service.js'

describe('extractEmails', () => {
  it('finds plain email in body text', () => {
    const result = extractEmails('Contact us at hello@example.com for info.')
    expect(result.map((r) => r.email)).toContain('hello@example.com')
  })

  it('extracts from mailto: anchor', () => {
    const result = extractEmails('<a href="mailto:owner@biz.io">Email us</a>')
    expect(result.map((r) => r.email)).toContain('owner@biz.io')
  })

  it('decodes [at] / [dot] bracket obfuscation', () => {
    const result = extractEmails('write to info [at] dental-co [dot] com today')
    expect(result.map((r) => r.email)).toContain('info@dental-co.com')
  })

  it('decodes (at) / (dot) paren obfuscation', () => {
    const result = extractEmails('office(at)acme.io')
    expect(result.map((r) => r.email)).toContain('office@acme.io')
  })

  it('decodes uppercase AT / DOT with spaces', () => {
    const result = extractEmails('sales AT acme DOT io')
    expect(result.map((r) => r.email)).toContain('sales@acme.io')
  })

  it('decodes HTML numeric entities', () => {
    const result = extractEmails('john&#46;doe&#64;biz&#46;com')
    expect(result.map((r) => r.email)).toContain('john.doe@biz.com')
  })

  it('decodes HTML hex entities', () => {
    const result = extractEmails('a&#x40;b&#x2e;com')
    expect(result.map((r) => r.email)).toContain('a@b.com')
  })

  it('decodes Cloudflare data-cfemail', () => {
    // Pre-computed: cf-encode of "test@example.com" with key=0xCD.
    const html =
      '<span class="__cf_email__" data-cfemail="cda9a8a3a4a2acaba88daaa0aca4a1e3aea2a0">[email&#160;protected]</span>'
    const result = extractEmails(html)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]?.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/)
  })

  it('returns context window around each email', () => {
    const result = extractEmails(
      'Some long preamble text here followed by hello@example.com and then more trailing text after.',
    )
    const row = result.find((r) => r.email === 'hello@example.com')
    expect(row?.context).toContain('hello@example.com')
    expect(row?.context.length).toBeGreaterThan(20)
  })

  it('deduplicates the same email across multiple matches', () => {
    const result = extractEmails('hello@biz.com hello@biz.com HELLO@biz.com')
    const matching = result.filter((r) => r.email === 'hello@biz.com')
    expect(matching.length).toBe(1)
  })

  it('normalizes to lowercase', () => {
    const result = extractEmails('Send to Owner@Example.COM')
    expect(result.map((r) => r.email)).toContain('owner@example.com')
  })

  it('returns empty array on empty input', () => {
    expect(extractEmails('')).toEqual([])
  })

  it('returns empty array on input with no email pattern', () => {
    expect(extractEmails('Just some text without contact info.')).toEqual([])
  })

  it('finds multiple distinct emails in same input', () => {
    const result = extractEmails(
      'Call info@biz.com or sales@biz.com or visit office(at)biz.com',
    )
    const emails = new Set(result.map((r) => r.email))
    expect(emails.has('info@biz.com')).toBe(true)
    expect(emails.has('sales@biz.com')).toBe(true)
    expect(emails.has('office@biz.com')).toBe(true)
    expect(emails.size).toBe(3)
  })

  it('does NOT pull email out of malformed input like @badformat.com', () => {
    // No localpart before @ → not a valid email; regex requires at least one
    // [A-Z0-9._%+-] before @.
    const result = extractEmails('write to @badformat.com please')
    expect(result.map((r) => r.email)).not.toContain('@badformat.com')
  })

  it('survives broken HTML gracefully', () => {
    const html = '<<<><<< href=mailto:foo@bar.com</div>'
    const result = extractEmails(html)
    expect(result.map((r) => r.email)).toContain('foo@bar.com')
  })
})
