/**
 * Internal DNS-only verifier — fallback used when:
 *   - LeadList.verificationMode = SYNTAX_DNS_ONLY (operator opt-out from external)
 *   - Reoon quota exhausted for the day
 *   - Reoon key missing in System Settings
 *
 * Returns lower-confidence results than Reoon (cannot detect catch-all or
 * actual mailbox existence) but covers syntax + DNS + MX deterministically.
 * Score impact handled by promotion gate.
 */

import { checkDomainDns } from '../dns-checker.service.js'
import type { VerificationProvider, VerificationResult } from './types.js'

const SYNTAX_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i

export class InternalDnsAdapter implements VerificationProvider {
  readonly name = 'internal_dns'

  async verify(email: string): Promise<VerificationResult> {
    const lower = email.toLowerCase().trim()
    const syntaxValid = SYNTAX_REGEX.test(lower)
    if (!syntaxValid) {
      return {
        status: 'undeliverable',
        reason: 'syntax fail',
        provider: 'internal_dns',
        disposable: false,
        syntaxValid: false,
        mxValid: false,
      }
    }

    const domain = (lower.split('@')[1] ?? '').toLowerCase()
    const dnsResult = await checkDomainDns(domain)

    if (!dnsResult.hasA && !dnsResult.hasMx) {
      return {
        status: 'undeliverable',
        reason: 'no A and no MX records',
        provider: 'internal_dns',
        disposable: false,
        syntaxValid: true,
        mxValid: false,
      }
    }
    if (!dnsResult.hasMx) {
      return {
        status: 'risky',
        reason: 'no MX records (A only)',
        provider: 'internal_dns',
        disposable: false,
        syntaxValid: true,
        mxValid: false,
      }
    }

    // DNS+MX both present. Can't probe the mailbox safely — paid verifier
    // would do SMTP RCPT here. We mark as "risky" (medium confidence) so the
    // promotion gate quarantines it for operator review unless operator
    // explicitly accepts SYNTAX_DNS_ONLY mode (then promotion treats this as
    // deliverable per spec — see promotion.service.ts).
    return {
      status: 'risky',
      reason: 'mx valid; mailbox unverified (in-house)',
      provider: 'internal_dns',
      disposable: false,
      syntaxValid: true,
      mxValid: true,
    }
  }
}
