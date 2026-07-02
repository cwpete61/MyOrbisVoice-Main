import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'

/**
 * Safety net for the public DEMO sandbox tenant: block money / irreversible /
 * real-world-effect actions even if some path isn't entitlement-gated.
 * Entitlements are the primary guard (demo tenant has none of the money ones);
 * this catches the rest (plan checkout, real sends, provisioning, tenant delete).
 *
 * Cheap: only runs a DB lookup for a NON-GET request whose path matches a blocked
 * prefix — every other request passes straight through.
 */
const BLOCKED_PREFIXES = [
  '/api/payments',        // Stripe Connect (collect money)
  '/api/billing',         // plan checkout / portal / upgrade
  '/api/twilio',          // number purchase, real calls/SMS
  '/api/phone-numbers',   // number purchase
  '/api/a2p',             // carrier registration
  '/api/outbound',        // outbound campaigns / real calls
  '/api/campaigns',       // campaign dispatch
  '/api/cold-email',      // real email sends
  '/api/bulk-email',
]

function isBlockedWrite(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false
  return BLOCKED_PREFIXES.some((p) => req.path.startsWith(p))
}

export async function demoGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isBlockedWrite(req)) { next(); return }
  try {
    const auth = req.headers.authorization
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) { next(); return } // unauthenticated → the route's own auth will reject
    const payload = verifyAccessToken(token)
    if (!payload.tenantId) { next(); return }
    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId }, select: { isDemo: true } })
    if (tenant?.isDemo) {
      res.status(403).json({ error: 'demo_mode', message: "This action is disabled in the demo account. Sign up to do it for real." })
      return
    }
    next()
  } catch {
    next() // token invalid/expired → let the route's auth handle it
  }
}
