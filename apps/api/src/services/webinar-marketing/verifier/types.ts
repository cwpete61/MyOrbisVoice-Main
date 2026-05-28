/**
 * Webinar Marketing verifier interface. Adapters return a normalized
 * VerificationResult regardless of upstream provider shape.
 */

export type VerificationStatus =
  | 'deliverable'
  | 'undeliverable'
  | 'risky'
  | 'unknown'
  | 'skipped'

export interface VerificationResult {
  /** Normalized status — used by promotion gate. */
  status: VerificationStatus
  /** 0..1, optional confidence from provider. */
  confidence?: number
  /** Provider's raw reason string for audit. */
  reason: string
  /** Slug for WebinarEmailVerification.provider column. */
  provider: string
  /** Whether the address is on a known disposable domain (provider knowledge). */
  disposable: boolean
  /** Syntactic validity per provider's parsing. */
  syntaxValid: boolean
  /** Domain has MX records (provider's check). */
  mxValid: boolean
}

export interface VerificationProvider {
  readonly name: string
  /** Verify one email. Should never throw for ordinary failures —
   *  prefer returning {status:'unknown', reason} so worker can move on. */
  verify(email: string): Promise<VerificationResult>
}
