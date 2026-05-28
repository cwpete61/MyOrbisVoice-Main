/**
 * Reoon Email Verifier adapter.
 *
 * Wraps the existing apps/api/src/services/reoon.service.ts (which the
 * cold-email + contact-import flows already use) and normalizes its
 * EmailStatus into the Webinar Marketing VerificationResult shape.
 *
 * Reoon mapping:
 *   valid       → deliverable
 *   risky       → risky
 *   role_based  → risky      (we treat role_based as risky; classifier
 *                              already decides whether the prefix is an
 *                              ALLOWED business role)
 *   disposable  → undeliverable + disposable=true
 *   invalid     → undeliverable
 *   unchecked   → unknown (no key / network failure / timeout)
 */

import { verifyEmail as reoonVerifyEmail } from '../../reoon.service.js'
import type { VerificationProvider, VerificationResult } from './types.js'

export class ReoonAdapter implements VerificationProvider {
  readonly name = 'reoon'

  async verify(email: string): Promise<VerificationResult> {
    const result = await reoonVerifyEmail(email)

    let status: VerificationResult['status']
    let disposable = false
    switch (result.status) {
      case 'valid':
        status = 'deliverable'
        break
      case 'risky':
      case 'role_based':
        status = 'risky'
        break
      case 'disposable':
        status = 'undeliverable'
        disposable = true
        break
      case 'invalid':
        status = 'undeliverable'
        break
      case 'unchecked':
      default:
        status = 'unknown'
        break
    }

    return {
      status,
      reason: result.raw,
      provider: 'reoon',
      disposable,
      // Reoon doesn't expose granular syntaxValid/mxValid in our wrapper, but
      // if it returned a non-unknown status it must have parsed the syntax
      // and resolved MX. We backfill conservatively.
      syntaxValid: status !== 'unknown',
      mxValid: status === 'deliverable' || status === 'risky',
    }
  }
}
