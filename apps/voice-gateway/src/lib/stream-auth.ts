import crypto from 'node:crypto'

/**
 * Verify the signed tenant-auth parameters the API attaches to a Twilio <Stream>.
 *
 * The inbound/outbound WebSocket endpoints are internet-facing (Twilio must
 * reach them) and derive the acting tenant from client-supplied customParameters.
 * Without a signature, a forged stream could set any tenantId and operate Orby
 * as that tenant. The API signs (tenantId, exp) with the shared
 * GATEWAY_INTERNAL_TOKEN; here we recompute the HMAC and require a match plus a
 * non-expired timestamp. When the secret is unset (local dev) we skip the check,
 * mirroring the API side which then also omits the signature.
 */
export function verifyStreamAuth(tenantId: string, params: Record<string, string>): boolean {
  const secret = process.env['GATEWAY_INTERNAL_TOKEN']
  if (!secret) return true // dev: secret not configured → skip (matches API mint)
  const exp = Number(params['authExp'] ?? '')
  const sig = params['authSig'] ?? ''
  if (!Number.isFinite(exp) || exp <= 0 || Date.now() > exp || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(`${tenantId}.${exp}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
