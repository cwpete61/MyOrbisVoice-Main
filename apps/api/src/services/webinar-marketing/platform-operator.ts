/**
 * Platform-owned "operator" AffiliateAccount for the ADMIN Webinar Marketing tool.
 *
 * The webinar-marketing data model scopes every list to an AffiliateAccount
 * (partnerId). The admin tool isn't a real partner, so we resolve a single
 * dedicated internal account that all platform admins share as one workspace.
 *
 * It's created lazily on first use, keyed on a well-known referralCode, tied to
 * a login-less system User (no passwordHash → cannot authenticate), and marked
 * DISABLED. listAffiliates() excludes it by referralCode so it never shows up
 * in the partner admin lists / leaderboards.
 */
import { prisma } from '../../lib/prisma.js'

const PLATFORM_OPS_EMAIL = 'webinar-ops@myorbisvoice.internal'
export const PLATFORM_WEBINAR_REFERRAL = 'PLATFORM-WEBINAR-OPS'
const PLATFORM_WEBINAR_SLUG = 'platform-webinar-ops'

let cachedId: string | null = null

/** Resolve (create on first use) the shared platform Webinar Marketing account id. */
export async function getPlatformWebinarPartnerId(): Promise<string> {
  if (cachedId) return cachedId

  const existing = await prisma.affiliateAccount.findUnique({
    where:  { referralCode: PLATFORM_WEBINAR_REFERRAL },
    select: { id: true },
  })
  if (existing) {
    cachedId = existing.id
    return existing.id
  }

  // Login-less system user to satisfy the required (unique) userId FK.
  const user = await prisma.user.upsert({
    where:  { email: PLATFORM_OPS_EMAIL },
    update: {},
    create: {
      email:     PLATFORM_OPS_EMAIL,
      firstName: 'Platform',
      lastName:  'Webinar Ops',
      status:    'DISABLED',
    },
    select: { id: true },
  })

  const acct = await prisma.affiliateAccount.create({
    data: {
      userId:       user.id,
      referralCode: PLATFORM_WEBINAR_REFERRAL,
      slug:         PLATFORM_WEBINAR_SLUG,
      status:       'DISABLED',
      notes:        'Internal platform-owned account backing the admin Webinar Marketing tool. Not a real affiliate — excluded from partner lists.',
    },
    select: { id: true },
  })
  cachedId = acct.id
  return acct.id
}
