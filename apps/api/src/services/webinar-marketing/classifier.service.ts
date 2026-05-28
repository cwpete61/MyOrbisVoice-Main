/**
 * Webinar Marketing email classifier.
 *
 * Pure-function classification — no DB, no network. Input is a normalized
 * (lowercased) email; output is one of seven WebinarEmailType values. The
 * worker calls this BEFORE any DNS/MX/verifier work so we can cheaply
 * reject DISPOSABLE / NO_REPLY / INVALID without spending verifier quota.
 *
 * Notes on `disposable-email-domains`:
 *   - The npm package exports `string[]` of known disposable domains
 *     (currently ~120k entries). Lookup is O(1) via Set.
 *   - List lags real-time by 1-2 weeks; that's the in-house tradeoff.
 *     Reoon catches the rest at the verifier stage.
 */

import disposableList from 'disposable-email-domains'
import type { WebinarEmailType } from '@prisma/client'

// Convert array to Set once at module load for O(1) lookup. Re-cast since
// the npm package's typings aren't perfect.
const DISPOSABLE_DOMAINS: Set<string> = new Set(
  (disposableList as unknown as string[]).map((d) => d.toLowerCase()),
)

// Common consumer mailbox providers. Static list — anyone running their own
// business off one of these ends up in QUARANTINED, not auto-promoted.
const FREE_MAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'mail.com',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'inbox.com',
])

// Spec-mandated suppressed role prefixes — these never receive marketing
// regardless of source/domain.
const SUPPRESSED_ROLES = new Set<string>([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'abuse',
  'postmaster',
  'webmaster',
  'security',
  'legal',
  'privacy',
])

// Spec-mandated ALLOWED business role prefixes. Auto-promote eligible if
// the rest of the gates pass.
const ALLOWED_BUSINESS_ROLES = new Set<string>([
  'info',
  'contact',
  'office',
  'hello',
  'appointments',
  'scheduling',
  'admin',
  'frontdesk',
  'reception',
  'events',
  'marketing',
])

// Loose syntax check — server-side definitive validation happens before this
// is called (extractor's own regex), so this is a guard against bad inputs.
const SYNTAX_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i

export interface ClassificationInput {
  normalizedEmail: string
}

export interface ClassificationOutput {
  emailType: WebinarEmailType
  /** Localpart (before @) lowercased + trimmed. */
  localPart: string
  /** Domain lowercased + trimmed. */
  domain: string
  /** Why classifier picked this type — short string for audit. */
  reason: string
}

export function classifyEmail(input: ClassificationInput): ClassificationOutput {
  const email = (input.normalizedEmail ?? '').trim().toLowerCase()

  if (!email || !SYNTAX_REGEX.test(email)) {
    return {
      emailType: 'INVALID_FORMAT',
      localPart: '',
      domain: '',
      reason: 'failed syntax regex',
    }
  }

  const [localPart, domain] = email.split('@') as [string, string]

  // 1. Disposable domain — kill before any other check.
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      emailType: 'DISPOSABLE_DOMAIN',
      localPart,
      domain,
      reason: `disposable list: ${domain}`,
    }
  }

  // 2. Suppressed role prefix — kill regardless of domain.
  if (SUPPRESSED_ROLES.has(localPart)) {
    return {
      emailType: 'NO_REPLY_OR_SUPPRESSED',
      localPart,
      domain,
      reason: `suppressed role: ${localPart}@`,
    }
  }

  // 3. Free-mail domain — quarantine for manual review per project rule.
  //    Operator must add consentStatus + lawfulBasisNotes to promote.
  if (FREE_MAIL_DOMAINS.has(domain)) {
    return {
      emailType: 'PERSONAL_FREE_MAIL',
      localPart,
      domain,
      reason: `free-mail provider: ${domain}`,
    }
  }

  // 4. Allowed business role prefix on a business domain — auto-promote
  //    eligible but tagged so UI can show the role label.
  if (ALLOWED_BUSINESS_ROLES.has(localPart)) {
    return {
      emailType: 'ROLE_BASED_BUSINESS',
      localPart,
      domain,
      reason: `allowed business role: ${localPart}@${domain}`,
    }
  }

  // 5. Everything else on a non-disposable non-free-mail domain = business.
  return {
    emailType: 'BUSINESS_DOMAIN',
    localPart,
    domain,
    reason: `business domain: ${domain}`,
  }
}

/** Module-level helpers exported for tests / Phase 5 CLI. */
export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase())
}
export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase())
}
export function isSuppressedRole(localPart: string): boolean {
  return SUPPRESSED_ROLES.has(localPart.toLowerCase())
}
export function isAllowedBusinessRole(localPart: string): boolean {
  return ALLOWED_BUSINESS_ROLES.has(localPart.toLowerCase())
}
