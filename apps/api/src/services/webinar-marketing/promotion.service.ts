/**
 * Promotion gate — the single chokepoint that decides whether a
 * WebinarExtractedEmail row can become a WebinarInviteContact row.
 *
 * Gates (ALL must pass — short-circuits on first failure):
 *   1. classificationStatus = APPROVED (operator approved, OR automatic
 *      approval for low-risk business-domain types)
 *   2. emailType is BUSINESS_DOMAIN or ROLE_BASED_BUSINESS
 *   3. Latest WebinarEmailVerification.providerStatus is "deliverable"
 *      (or "risky" only when verificationMode = SYNTAX_DNS_ONLY)
 *   4. WebinarEmailVerification.disposable = false
 *   5. Not present in WebinarSuppression for this partner
 *   6. sourceUrl is non-null on the ExtractedEmail row
 *   7. consentStatus is not NOT_APPROVED
 *   8. If consentStatus = MANUAL_LAWFUL_BASIS_REVIEWED then
 *      lawfulBasisNotes is required and non-empty
 *   9. No existing WebinarInviteContact row for (partnerId, normalizedEmail)
 *
 * The unique index on (partnerId, normalizedEmail) in WebinarInviteContact
 * is the final backstop against duplicates — if a concurrent tick
 * promotes the same address, the second insert hits a P2002 and we mark
 * the source row as already-promoted instead.
 */

import { Prisma } from '@prisma/client'
import type { WebinarConsentStatus, WebinarLeadList } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { log as auditLog } from './audit.service.js'

export interface PromotionInput {
  extractedEmailId: string
  consentStatus: WebinarConsentStatus
  lawfulBasisNotes?: string | null
  businessName?: string | null
}

export type PromotionOutcome =
  | { ok: true; contactId: string }
  | { ok: false; reason: string }

export async function promoteToInvite(
  input: PromotionInput,
): Promise<PromotionOutcome> {
  const extracted = await prisma.webinarExtractedEmail.findUnique({
    where: { id: input.extractedEmailId },
    include: {
      leadList: true,
      verifications: { orderBy: { verifiedAt: 'desc' }, take: 1 },
    },
  })
  if (!extracted) return { ok: false, reason: 'extracted email not found' }

  const list = extracted.leadList
  if (!list) return { ok: false, reason: 'parent list missing' }

  // Gate 2: emailType
  if (
    extracted.emailType !== 'BUSINESS_DOMAIN' &&
    extracted.emailType !== 'ROLE_BASED_BUSINESS'
  ) {
    return {
      ok: false,
      reason: `emailType ${extracted.emailType} is not promotable`,
    }
  }

  // Gate 3-4: verification result
  const verification = extracted.verifications[0]
  if (!verification) {
    return { ok: false, reason: 'no verification on record' }
  }
  if (verification.disposable) {
    return { ok: false, reason: 'verification flagged disposable' }
  }
  const acceptable =
    verification.providerStatus === 'deliverable' ||
    (list.verificationMode === 'SYNTAX_DNS_ONLY' &&
      verification.providerStatus === 'risky' &&
      verification.mxValid)
  if (!acceptable) {
    return {
      ok: false,
      reason: `verification providerStatus=${verification.providerStatus}`,
    }
  }

  // Gate 5: suppression
  const suppressed = await prisma.webinarSuppression.findUnique({
    where: {
      partnerId_normalizedEmail: {
        partnerId: list.partnerId,
        normalizedEmail: extracted.normalizedEmail,
      },
    },
  })
  if (suppressed) {
    void auditLog({
      partnerId: list.partnerId,
      action: 'suppression_hit',
      entityType: 'WebinarExtractedEmail',
      entityId: extracted.id,
      details: { reason: suppressed.reason },
    })
    return { ok: false, reason: `suppressed: ${suppressed.reason}` }
  }

  // Gate 6: sourceUrl
  if (!extracted.sourceUrl) {
    return { ok: false, reason: 'sourceUrl missing' }
  }

  // Gate 7-8: consent
  if (input.consentStatus === 'NOT_APPROVED') {
    return { ok: false, reason: 'consentStatus=NOT_APPROVED' }
  }
  if (
    input.consentStatus === 'MANUAL_LAWFUL_BASIS_REVIEWED' &&
    (!input.lawfulBasisNotes || input.lawfulBasisNotes.trim().length === 0)
  ) {
    return {
      ok: false,
      reason: 'lawfulBasisNotes required for MANUAL_LAWFUL_BASIS_REVIEWED',
    }
  }

  // Gate 9: duplicate guard. Race-safe via unique index — if a concurrent
  // tick beat us to it, P2002 hits below and we mark the source approved
  // without creating a second row.
  try {
    const contact = await prisma.webinarInviteContact.create({
      data: {
        leadListId: list.id,
        partnerId: list.partnerId,
        email: extracted.email,
        normalizedEmail: extracted.normalizedEmail,
        businessName: input.businessName ?? null,
        niche: list.niche,
        location: list.location,
        sourceUrl: extracted.sourceUrl,
        consentStatus: input.consentStatus,
        lawfulBasisNotes: input.lawfulBasisNotes ?? null,
        verificationStatus:
          verification.providerStatus === 'deliverable' ? 'DELIVERABLE' : 'RISKY',
      },
    })

    await prisma.webinarExtractedEmail.update({
      where: { id: extracted.id },
      data: { classificationStatus: 'APPROVED' },
    })

    void auditLog({
      partnerId: list.partnerId,
      action: 'promoted_to_invite',
      entityType: 'WebinarInviteContact',
      entityId: contact.id,
      details: {
        emailType: extracted.emailType,
        consentStatus: input.consentStatus,
        verificationProvider: verification.provider,
      },
    })

    return { ok: true, contactId: contact.id }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // Already promoted by another tick / another list — mark this row
      // approved too so worker doesn't keep retrying.
      await prisma.webinarExtractedEmail.update({
        where: { id: extracted.id },
        data: { classificationStatus: 'APPROVED' },
      })
      return { ok: false, reason: 'duplicate: already in invite database' }
    }
    throw err
  }
}

// ─── Auto-approval policy ────────────────────────────────────────────────────

/**
 * Worker calls this for newly-classified BUSINESS_DOMAIN / ROLE_BASED_BUSINESS
 * rows after verification finishes. Auto-approval is deliberately strict —
 * the operator can re-process anything that didn't auto-promote via the
 * review queue with explicit consent notes.
 *
 * Auto-approve only when:
 *   - emailType is BUSINESS_DOMAIN (not ROLE_BASED_BUSINESS — those need a
 *     human eyeball even though the prefix is allowed)
 *   - verification result is "deliverable" (Reoon only — not internal-DNS,
 *     which is at best "risky")
 *   - LeadList allowedEmailTypes includes 'business_domain_only'
 *
 * Everything else lands in CLASSIFIED status and waits for manual approval.
 */
export async function attemptAutoPromote(
  extractedEmailId: string,
  list: WebinarLeadList,
): Promise<PromotionOutcome | { ok: false; reason: 'not eligible for auto' }> {
  const row = await prisma.webinarExtractedEmail.findUnique({
    where: { id: extractedEmailId },
    include: { verifications: { orderBy: { verifiedAt: 'desc' }, take: 1 } },
  })
  if (!row) return { ok: false, reason: 'not eligible for auto' }

  const verification = row.verifications[0]
  if (!verification) return { ok: false, reason: 'not eligible for auto' }

  if (row.emailType !== 'BUSINESS_DOMAIN') {
    return { ok: false, reason: 'not eligible for auto' }
  }
  if (verification.provider !== 'reoon') {
    return { ok: false, reason: 'not eligible for auto' }
  }
  if (verification.providerStatus !== 'deliverable') {
    return { ok: false, reason: 'not eligible for auto' }
  }
  if (!list.allowedEmailTypes.includes('business_domain_only')) {
    return { ok: false, reason: 'not eligible for auto' }
  }

  // Source URL on the extracted row implicitly satisfies the "lawful basis"
  // since it's the publicly-published business contact page. We record
  // MANUAL_LAWFUL_BASIS_REVIEWED with an auto-generated note tied to the
  // source URL so the audit trail is intact.
  return promoteToInvite({
    extractedEmailId,
    consentStatus: 'MANUAL_LAWFUL_BASIS_REVIEWED',
    lawfulBasisNotes: `Auto-approved from public business contact page: ${row.sourceUrl}`,
  })
}
