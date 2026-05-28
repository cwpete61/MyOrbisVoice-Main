/**
 * Verifier picker. Chooses the right adapter for a given LeadList +
 * partner quota state. Worker calls pickVerifier() and then .verify(email).
 */

import type { WebinarVerificationMode } from '@prisma/client'
import { canCallReoon } from '../quota.service.js'
import { ReoonAdapter } from './reoon.adapter.js'
import { InternalDnsAdapter } from './internal-dns.adapter.js'
import type { VerificationProvider } from './types.js'

export async function pickVerifier(
  partnerId: string,
  mode: WebinarVerificationMode,
): Promise<VerificationProvider> {
  if (mode === 'SYNTAX_DNS_ONLY') return new InternalDnsAdapter()
  // External provider mode — try Reoon, fall back to internal if quota
  // exhausted or key missing.
  const reoonAvailable = await canCallReoon(partnerId)
  return reoonAvailable ? new ReoonAdapter() : new InternalDnsAdapter()
}

export type { VerificationProvider, VerificationResult, VerificationStatus } from './types.js'
