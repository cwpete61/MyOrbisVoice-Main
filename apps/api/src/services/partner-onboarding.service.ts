/**
 * Partner onboarding wizard — answers "what's left to set up?" for the
 * /partner-portal/getting-started checklist. Mirrors the tenant onboarding
 * service: each step reads the actual underlying resource so the wizard is
 * always truthful — configure something on the real page, come back, and the
 * step flips to complete.
 *
 * Two completion signals per step (whichever is true):
 *   1. Data-based — the underlying resource is genuinely configured.
 *   2. User-marked — the partner clicked "Back to Get Started" on a step page
 *      and explicitly flagged it. Stored in AffiliateAccount.onboardingMarkedDone.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export type PartnerOnboardingStepKey =
  | 'profile' | 'page' | 'payouts' | 'calendar' | 'booking' | 'share' | 'number'

export const PARTNER_ONBOARDING_STEP_KEYS: readonly PartnerOnboardingStepKey[] =
  ['profile', 'page', 'payouts', 'calendar', 'booking', 'share', 'number']

export interface PartnerOnboardingStep {
  key:        PartnerOnboardingStepKey
  href:       string
  completed:  boolean
  optional?:  boolean
}

const SHORT_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export async function getPartnerOnboardingStatus(partnerId: string): Promise<{
  steps:          PartnerOnboardingStep[]
  completedCount: number
  totalCount:     number
  allComplete:    boolean
  showWizard:     boolean   // computed — banner visibility (incomplete OR override)
  wizardEnabled:  boolean   // raw override flag — drives the profile toggle
}> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: {
      displayName:            true,
      businessName:           true,
      avatarUrl:              true,
      partnerPageActive:      true,
      integrationConnectionId: true,
      bookingHoursJson:       true,
      stripeConnectAccountId: true,
      onboardingMarkedDone:   true,
      showOnboardingWizard:   true,
    },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const [customLinkCount, purchasedNumberCount] = await Promise.all([
    prisma.affiliateCustomLink.count({ where: { affiliateAccountId: partnerId } }),
    prisma.phoneNumber.count({ where: { partnerId, purchaseStatus: 'PURCHASED' } }),
  ])

  const markedDone = (partner.onboardingMarkedDone ?? {}) as Record<string, boolean>
  const isMarked = (k: PartnerOnboardingStepKey) => markedDone[k] === true

  // ── Data-based completion signals ────────────────────────────────────────
  const profileDone = isMarked('profile')
    || (!!partner.displayName && !!partner.businessName && !!partner.avatarUrl)

  const pageDone = isMarked('page') || partner.partnerPageActive === true

  // Payouts: completes once a Stripe Connect account is linked. Whether Stripe
  // has fully enabled payouts yet is tracked separately (payoutMethodJson, shown
  // on the payouts page) and does not gate this onboarding step.
  const payoutsDone = isMarked('payouts') || !!partner.stripeConnectAccountId

  const calendarDone = isMarked('calendar') || !!partner.integrationConnectionId

  // Booking: at least one weekday has open/close hours configured.
  const bookingConfigured = (() => {
    const h = partner.bookingHoursJson as Record<string, unknown> | null
    if (!h) return false
    return SHORT_DAYS.some(d => {
      const v = h[d]
      return v && typeof v === 'object'
    })
  })()
  const bookingDone = isMarked('booking') || bookingConfigured

  const shareDone  = isMarked('share')  || customLinkCount > 0
  const numberDone = isMarked('number') || purchasedNumberCount > 0

  const steps: PartnerOnboardingStep[] = [
    { key: 'profile',  href: '/partner-portal/profile',    completed: profileDone },
    { key: 'page',     href: '/partner-portal/profile',    completed: pageDone },
    { key: 'payouts',  href: '/partner-portal/payouts',    completed: payoutsDone },
    { key: 'calendar', href: '/partner-portal/profile',    completed: calendarDone },
    { key: 'booking',  href: '/partner-portal/profile',    completed: bookingDone },
    { key: 'share',    href: '/partner-portal/referrals',  completed: shareDone },
    { key: 'number',   href: '/partner-portal/phone-numbers', completed: numberDone, optional: true },
  ]

  // Progress counts REQUIRED steps only — optional steps (e.g. the phone
  // number) never count toward "X of Y" and never block completion. The
  // wizard is "all complete" once every required step passes.
  const requiredSteps   = steps.filter(s => !s.optional)
  const completedCount  = requiredSteps.filter(s => s.completed).length
  const totalCount      = requiredSteps.length
  const allRequiredDone = requiredSteps.every(s => s.completed)

  // The dashboard banner shows while the wizard is incomplete OR the partner
  // has manually re-enabled it after completing setup.
  const wizardEnabled = partner.showOnboardingWizard === true
  const showWizard    = !allRequiredDone || wizardEnabled

  return { steps, completedCount, totalCount, allComplete: allRequiredDone, showWizard, wizardEnabled }
}

/** Flip the manual "re-show the onboarding wizard" override. */
export async function setPartnerShowWizard(partnerId: string, show: boolean): Promise<void> {
  await prisma.affiliateAccount.update({
    where: { id: partnerId },
    data:  { showOnboardingWizard: show },
  })
}

export async function markPartnerOnboardingStep(
  partnerId: string,
  stepKey:   PartnerOnboardingStepKey,
): Promise<Record<string, boolean>> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { id: partnerId },
    select: { onboardingMarkedDone: true },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'Partner not found', 404)

  const current = (partner.onboardingMarkedDone ?? {}) as Record<string, boolean>
  const next = { ...current, [stepKey]: true }
  await prisma.affiliateAccount.update({
    where: { id: partnerId },
    data:  { onboardingMarkedDone: next },
  })
  return next
}
