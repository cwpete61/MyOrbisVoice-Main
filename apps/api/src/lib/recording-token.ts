import crypto from 'node:crypto'
import { getEnv } from '@voiceautomation/config'

// Short-lived signed token that lets an AUTHENTICATED admin surface (Call QA)
// replay a demo call's recording through the otherwise-public recording route,
// bypassing the prospect-facing expiry / claimed guards. The token is minted
// server-side inside an authed endpoint (listDemoCallQa) and rides on the raw
// <audio> request as ?t=… — needed because a cross-origin <audio crossOrigin=
// "anonymous"> element carries no auth cookie of its own.
//
// Scope is deliberately tight: the HMAC binds to ONE conversationId and a hard
// expiry, so a leaked token unlocks exactly that one recording for a few hours,
// nothing else. No token → the recording route keeps its full prospect guards.

const TTL_MS = 6 * 60 * 60 * 1000 // 6h — comfortably spans an admin session

export function signRecordingToken(conversationId: string, now = Date.now()): string {
  const exp = now + TTL_MS
  const sig = crypto.createHmac('sha256', getEnv().AUTH_SECRET).update(`${conversationId}.${exp}`).digest('hex')
  return `${exp}.${sig}`
}

export function verifyRecordingToken(conversationId: string, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const exp = Number(token.slice(0, dot))
  const sig = token.slice(dot + 1)
  if (!Number.isFinite(exp) || exp < now) return false
  const expected = crypto.createHmac('sha256', getEnv().AUTH_SECRET).update(`${conversationId}.${exp}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
