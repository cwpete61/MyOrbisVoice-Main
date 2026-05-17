/**
 * Booking sender identity — resolves WHO an appointment communication is
 * "from", so confirmation emails, reminder emails, and reminder SMS all speak
 * with one consistent voice.
 *
 * Partner-routed bookings (Appointment.partnerId set) are answered by the
 * partner's own Orby agent, land on the partner's calendar, and surface on the
 * partner portal — so every message about that booking must name the PARTNER,
 * their Orby agent, and the MyOrbisVoice platform, not the platform demo
 * tenant that hosts the row. Tenant-routed bookings keep the tenant's own
 * brand exactly as before.
 */
import { prisma } from '../lib/prisma.js'

/** Platform brand line — stays English in both locales (universal reference). */
export const BOOKING_BRAND = 'MyOrbisVoice'

export type BookingIdentity = {
  /** True when the booking is partner-routed (Appointment.partnerId set). */
  isPartner:         boolean
  /** Name the recipient sees as "you booked with X" — partner business /
   *  display name, or the tenant brand. */
  bookingWithName:   string
  /** The AI agent that handled the booking — the partner's Orby, or "Orby". */
  agentName:         string
  /** Reply-to / "contact us" email shown in the footer. */
  contactEmail:      string | null
  /** Partner's public phone, shown in the footer alongside the email. */
  contactPhone:      string | null
  /** Partner's own Twilio number — used as the SMS sending number so reminder
   *  texts come from the partner's caller ID. Null for tenant bookings or a
   *  partner with no number yet. */
  partnerNumberE164: string | null
}

export async function resolveBookingIdentity(
  tenantId: string,
  partnerId: string | null,
): Promise<BookingIdentity> {
  if (partnerId) {
    const [partner, orby, number] = await Promise.all([
      prisma.affiliateAccount.findUnique({
        where:  { id: partnerId },
        select: {
          displayName:  true,
          businessName: true,
          partnerPhone: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.agentProfile.findFirst({
        where:  { partnerId, agentRoleType: 'ORCHESTRATOR' },
        select: { displayName: true },
      }),
      prisma.phoneNumber.findFirst({
        where:  { partnerId, isInboundEnabled: true },
        select: { e164Number: true },
      }),
    ])
    const fullName = [partner?.user?.firstName, partner?.user?.lastName]
      .filter(Boolean).join(' ').trim()
    const bookingWithName =
      partner?.businessName?.trim() ||
      partner?.displayName?.trim()  ||
      fullName                      ||
      'your host'
    return {
      isPartner:         true,
      bookingWithName,
      agentName:         orby?.displayName?.trim() || 'Orby',
      contactEmail:      partner?.user?.email ?? null,
      contactPhone:      partner?.partnerPhone ?? null,
      partnerNumberE164: number?.e164Number ?? null,
    }
  }

  const [tenant, profile] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } }),
    prisma.businessProfile.findUnique({
      where:  { tenantId },
      select: { brandName: true, fallbackNotificationEmail: true },
    }),
  ])
  return {
    isPartner:         false,
    bookingWithName:   profile?.brandName || tenant?.displayName || 'our team',
    agentName:         'Orby',
    contactEmail:      profile?.fallbackNotificationEmail ?? null,
    contactPhone:      null,
    partnerNumberE164: null,
  }
}
