import { prisma } from './prisma.js'
import type { PartnerContext } from './prompt-resolver.js'

/**
 * Load a partner's identity so Orby speaks AS that partner (first name,
 * business name, contact details). Used by BOTH inbound and outbound voice
 * paths when the call's number is partner-owned. Returns null on any miss so
 * the call falls back to the generic platform agent rather than failing.
 */
export async function loadPartnerContext(partnerId: string): Promise<PartnerContext | null> {
  try {
    const acct = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      select: {
        slug:         true,
        displayName:  true,
        businessName: true,
        partnerPhone: true,
        avatarUrl:    true,
        bio:          true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    if (!acct || !acct.slug) return null
    const firstName = acct.user?.firstName ?? ''
    const lastName  = acct.user?.lastName ?? ''
    const displayName = acct.displayName?.trim()
      || [firstName, lastName].filter(Boolean).join(' ').trim()
      || acct.slug
    return {
      slug:         acct.slug,
      firstName,
      lastName,
      displayName,
      businessName: acct.businessName,
      partnerEmail: acct.user?.email,
      partnerPhone: acct.partnerPhone,
      avatarUrl:    acct.avatarUrl,
      bio:          acct.bio,
    }
  } catch (err) {
    console.error('[partner-context] loadPartnerContext failed (non-fatal):', (err as Error).message)
    return null
  }
}
