/**
 * Partner profile service.
 *
 * Partners are the people who publish branded marketing landing pages on
 * MyOrbisVoice / MyOrbisLocal / MyOrbisResults and earn commission on the
 * customers they generate. Schema-wise they live as User + AffiliateAccount
 * (the AffiliateAccount table holds both revenue-share fields AND
 * marketing-page identity fields — see prisma/schema.prisma).
 *
 * This service owns:
 *   - Slug derivation + collision handling
 *   - Partner CRUD (read, update profile)
 *   - Lookups by slug or userId
 *
 * Out of scope here (other services):
 *   - Email composition / sending (email.service.ts)
 *   - Postfix virtual_alias_maps wiring (TODO: Session 2)
 *   - Partner dashboard UI (TODO: apps/web Session 3+)
 */

import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import bcrypt from 'bcryptjs'
import { sendEmail } from './email.service.js'

// ─── Slug derivation ────────────────────────────────────────────────────────

/**
 * Convert "Alex Rivera" -> "alex.rivera" (lowercase, ASCII-only, single dots).
 *
 * Rules:
 *   - Strip accents (María → maria)
 *   - Allow only [a-z0-9.] in the output
 *   - Collapse any run of dots to a single dot
 *   - Trim leading/trailing dots
 *
 * Does NOT check for uniqueness. Use generatePartnerSlug() if you need the
 * collision-handled version that's safe to write to the DB.
 */
export function deriveSlug(firstName: string, lastName: string): string {
  return `${firstName}.${lastName}`
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9.]/g, '')                          // keep only safe chars
    .replace(/\.+/g, '.')                                // collapse multiple dots
    .replace(/^\.+|\.+$/g, '')                           // trim edge dots
}

/**
 * Returns a slug guaranteed unique against existing AffiliateAccount.slug.
 * Falls back to numeric suffix on collision: alex.rivera, alex.rivera2,
 * alex.rivera3, ...
 *
 * Edge case: empty derived slug (e.g. names with no ASCII chars) is rejected
 * with VALIDATION_ERROR so we don't write ""@myorbisresults.com aliases.
 */
export async function generatePartnerSlug(firstName: string, lastName: string): Promise<string> {
  const base = deriveSlug(firstName, lastName)
  if (!base) {
    throw new AppError('VALIDATION_ERROR', 'Partner name must contain at least one letter or digit', 422)
  }

  let candidate = base
  let n = 2
  // Bound the loop — if 50 collisions happen we have a different problem.
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.affiliateAccount.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = `${base}${n++}`
  }
  throw new AppError('INTERNAL_ERROR', 'Could not generate unique slug after 50 attempts', 500)
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

/**
 * Find a partner by their slug. Returns the joined User identity alongside
 * the AffiliateAccount marketing-page fields. Returns null if no partner
 * with that slug exists (rather than throwing — callers may want a 404 page).
 */
export async function getPartnerBySlug(slug: string) {
  return prisma.affiliateAccount.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          createdAt: true,
        },
      },
    },
  })
}

/**
 * Look up a partner by the User id. Used after auth — we know who's logged
 * in, want their partner profile. Returns null if the user isn't a partner.
 */
export async function getPartnerByUserId(userId: string) {
  return prisma.affiliateAccount.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          createdAt: true,
        },
      },
    },
  })
}

// ─── Profile updates ─────────────────────────────────────────────────────────

export interface PartnerProfileUpdate {
  displayName?: string | null
  avatarUrl?: string | null
  bio?: string | null
  partnerPhone?: string | null
  businessName?: string | null
  emailSignature?: string | null
  calendarId?: string | null
  forwardPlatformEmails?: boolean
  partnerPageActive?: boolean
  aggressionTier?: string
}

/**
 * Update mutable profile fields. Slug + status + revenue-share fields are
 * NOT touched here — those use separate endpoints (slug is immutable after
 * creation; status changes via admin; rev-share fields update on payout).
 */
export async function updatePartnerProfile(userId: string, data: PartnerProfileUpdate) {
  const partner = await prisma.affiliateAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!partner) {
    throw new AppError('NOT_FOUND', 'No partner record for this user', 404)
  }

  return prisma.affiliateAccount.update({
    where: { id: partner.id },
    data: {
      displayName:           data.displayName,
      avatarUrl:             data.avatarUrl,
      bio:                   data.bio,
      partnerPhone:          data.partnerPhone,
      businessName:          data.businessName,
      emailSignature:        data.emailSignature,
      calendarId:            data.calendarId,
      forwardPlatformEmails: data.forwardPlatformEmails,
      partnerPageActive:     data.partnerPageActive,
      aggressionTier:        data.aggressionTier,
    },
  })
}

// ─── Bootstrap helper (admin / seed only) ────────────────────────────────────

export interface BootstrapPartnerInput {
  email:        string
  username:     string
  firstName:    string
  lastName:     string
  password:     string
  /** Marketing-profile fields that get populated at creation time. */
  displayName?: string
  bio?:         string
  partnerPhone?:string
  businessName?:string
  avatarUrl?:   string
  partnerPageActive?: boolean
}

/**
 * Create a User + AffiliateAccount in one transaction. Used to seed the demo
 * "Alex Rivera" partner record and (later) by the partner signup flow.
 *
 * Slug is auto-generated from firstName + lastName. ReferralCode is also
 * auto-generated (8-char base36) — required by existing schema constraint.
 */
export async function bootstrapPartner(input: BootstrapPartnerInput) {
  // Check for existing user with this email or username — fail loud rather
  // than silently overwriting.
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } } }),
    prisma.user.findFirst({ where: { username: { equals: input.username, mode: 'insensitive' } } }),
  ])
  if (existingEmail) throw new AppError('CONFLICT', `User with email ${input.email} already exists`, 409)
  if (existingUsername) throw new AppError('CONFLICT', `Username ${input.username} already taken`, 409)

  const slug         = await generatePartnerSlug(input.firstName, input.lastName)
  const referralCode = Math.random().toString(36).slice(2, 10).toUpperCase()
  const passwordHash = await bcrypt.hash(input.password, 12)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email:        input.email,
        username:     input.username,
        firstName:    input.firstName,
        lastName:     input.lastName,
        passwordHash,
      },
    })

    const partner = await tx.affiliateAccount.create({
      data: {
        userId:                user.id,
        status:                'ACTIVE',
        referralCode,
        slug,
        displayName:           input.displayName       ?? `${input.firstName} ${input.lastName}`,
        bio:                   input.bio,
        partnerPhone:          input.partnerPhone,
        businessName:          input.businessName,
        avatarUrl:             input.avatarUrl,
        partnerPageActive:     input.partnerPageActive ?? false,
        forwardPlatformEmails: true,
      },
    })

    return { user, partner }
  })
}

// ─── Outbound: sendPartnerEmail ──────────────────────────────────────────────

const PARTNER_DOMAIN = 'myorbisresults.com'

export interface SendPartnerEmailOptions {
  to:        string | string[]   // recipient(s) — can be "Name <email>" or bare email
  subject:   string
  html:      string
  text?:     string
  inReplyTo?:string             // RFC 5322 In-Reply-To (when replying to an existing thread)
  threadId?: string             // optional — links the outbound to an existing partner thread
}

/**
 * Send an email FROM a partner's personalized alias. Used by the Mailbox Compose
 * UI and any campaign automation that sends on behalf of a specific partner.
 *
 * Behavior:
 *   - From header: "{partner.displayName} <{partner.slug}@myorbisresults.com>"
 *   - Body: partner.emailSignature is appended if present
 *   - Outbound row written to Email table (direction=OUTBOUND, partnerId set)
 *   - Delivery via the platform's existing sendEmail() — which routes through
 *     the host Postfix + OpenDKIM signs with d=myorbisresults.com so the SPF/DKIM
 *     align for any reasonable recipient inbox.
 */
export async function sendPartnerEmail(partnerId: string, opts: SendPartnerEmailOptions): Promise<{ emailId: string }> {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  })
  if (!partner)       throw new AppError('NOT_FOUND', 'Partner not found', 404)
  if (!partner.slug)  throw new AppError('VALIDATION_ERROR', 'Partner has no slug yet — cannot send', 422)

  const fromAddr = `${partner.slug}@${PARTNER_DOMAIN}`
  const fromName = partner.displayName
                 ?? [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ').trim()
                 ?? partner.slug
  const fromHeader = `${fromName} <${fromAddr}>`

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]

  // Compose final HTML body. Append signature if partner has one.
  const html = partner.emailSignature
    ? `${opts.html}\n<br><br>\n<div style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">${partner.emailSignature}</div>`
    : opts.html

  // Send via platform SMTP. nodemailer in email.service handles the wire.
  // We pass through `to` as a comma-joined string for the simple sendEmail signature.
  // (For multi-recipient with per-recipient personalization, we'd batch one call per to.)
  await sendEmail({
    to:        recipients.join(', '),
    from:      fromHeader,
    replyTo:   fromAddr,           // replies route back to the partner's inbox via Postfix ingestion
    subject:   opts.subject,
    html,
    text:      opts.text,
    inReplyTo: opts.inReplyTo,
  })

  // Log to Email table as OUTBOUND
  const email = await prisma.email.create({
    data: {
      partnerId:      partner.id,
      threadId:       opts.threadId ?? null,
      messageId:      null,  // nodemailer will mint one; we don't currently round-trip it back
      inReplyTo:      opts.inReplyTo ?? null,
      direction:      'OUTBOUND',
      fromAddress:    fromHeader,
      toAddresses:    recipients,
      subject:        opts.subject,
      htmlBody:       html,
      textBody:       opts.text ?? null,
      deliveryStatus: 'sent',
      sentAt:         new Date(),
    },
  })

  return { emailId: email.id }
}

