import jwt from 'jsonwebtoken'
import type { TokenPayload } from '@voiceautomation/types'
import { getEnv } from '@voiceautomation/config'

const ACCESS_TOKEN_TTL = '15m'

export function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getEnv().AUTH_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getEnv().AUTH_SECRET) as TokenPayload
}

/**
 * Signup-invite token — a partner converts a saved lead/contact into a
 * prefilled signup link. The token (not an open email lookup) is what
 * authorizes pulling the contact's prefill data, so no PII leaks to anyone
 * who guesses an email. Short-lived; carries only the contact id.
 */
const INVITE_TTL = '14d'

export function signInviteToken(contactId: string): string {
  return jwt.sign({ cid: contactId, typ: 'invite' }, getEnv().AUTH_SECRET, { expiresIn: INVITE_TTL })
}

export function verifyInviteToken(token: string): string {
  const p = jwt.verify(token, getEnv().AUTH_SECRET) as { cid?: string; typ?: string }
  if (p.typ !== 'invite' || !p.cid) throw new Error('not an invite token')
  return p.cid
}
