import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for the double-decrypt bug: sendViaPostmark/Resend/Brevo used
// to call systemConfig.decrypt() on a value getConfigValue() had ALREADY
// decrypted. The second decrypt threw "Invalid ciphertext format" on every
// send, silently forcing the local-SMTP fallback — Postmark (chosen for
// password-reset deliverability) never actually ran.
//
// getConfigValue returns plaintext. These tests assert the ESP send functions
// use that plaintext directly and never re-decrypt.

const { getConfigValue, decrypt, checkSuppression } = vi.hoisted(() => ({
  getConfigValue: vi.fn(),
  decrypt:        vi.fn(),
  checkSuppression: vi.fn(),
}))

vi.mock('./system-config.service.js', () => ({ getConfigValue, decrypt }))
vi.mock('./email-suppression.service.js', () => ({ checkSuppression }))

const { sendEmail } = await import('./email.service.js')

// A real Postmark server token is a UUID-shaped string with no colons. If the
// old double-decrypt code ran, decrypt() would split on ':' and throw.
const POSTMARK_TOKEN_PLAINTEXT = 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d'

beforeEach(() => {
  vi.clearAllMocks()
  checkSuppression.mockResolvedValue({ suppressed: false })
  vi.stubGlobal('fetch', vi.fn())
})

describe('sendEmail — Postmark provider (transactional)', () => {
  it('sends with the plaintext token from getConfigValue, never re-decrypting', async () => {
    getConfigValue.mockResolvedValue(POSTMARK_TOKEN_PLAINTEXT)
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ MessageID: 'pm-msg-1' }),
    })

    const result = await sendEmail({
      to: 'partner@example.com',
      subject: 'Reset your MyOrbisVoice password',
      html: '<p>reset</p>',
      kind: 'transactional',
    })

    // decrypt must NOT be called — getConfigValue already returned plaintext.
    expect(decrypt).not.toHaveBeenCalled()

    // The Postmark request must carry the exact plaintext token.
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('postmarkapp.com')
    expect((init.headers as Record<string, string>)['X-Postmark-Server-Token']).toBe(POSTMARK_TOKEN_PLAINTEXT)

    expect(result).toEqual({ sent: true, provider: 'postmark', providerMessageId: 'pm-msg-1' })
  })

  it('throws "token unset" (caught → SMTP fallback) when the token is missing', async () => {
    getConfigValue.mockResolvedValue(null)        // postmark token absent
    // smtp_host also absent → SMTP fallback fails too → no_provider
    const result = await sendEmail({
      to: 'partner@example.com',
      subject: 'Reset your password',
      html: '<p>reset</p>',
      kind: 'transactional',
    })
    expect(result.sent).toBe(false)
  })

  it('skips the send entirely when the address is suppressed', async () => {
    checkSuppression.mockResolvedValue({ suppressed: true, scope: 'global', reason: 'hard_bounce' })
    const result = await sendEmail({
      to: 'dead@example.com',
      subject: 'Reset your password',
      html: '<p>reset</p>',
      kind: 'transactional',
    })
    expect(result).toEqual({ sent: false, skipped: 'suppressed', reason: 'global:hard_bounce' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
