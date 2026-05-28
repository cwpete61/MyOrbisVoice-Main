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
  // findFirst + deletedAt: null so soft-deleted partners return null.
  // Public partner page (/p/<slug>/) callers turn that into a 404; the
  // page disappears the moment the admin soft-deletes the partner.
  return prisma.affiliateAccount.findFirst({
    where: { slug, deletedAt: null },
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
  notifyAppointmentsEnabled?: boolean
  // Phase F.5 — partner public mailing address. Optional everywhere.
  partnerStreet?: string | null
  partnerUnit?: string | null
  partnerCity?: string | null
  partnerState?: string | null
  partnerPostalCode?: string | null
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

  const updated = await prisma.affiliateAccount.update({
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
      notifyAppointmentsEnabled: data.notifyAppointmentsEnabled,
      partnerStreet:         data.partnerStreet,
      partnerUnit:           data.partnerUnit,
      partnerCity:           data.partnerCity,
      partnerState:          data.partnerState,
      partnerPostalCode:     data.partnerPostalCode,
    },
  })

  // Phase E.11 — fire-and-forget regen + FTP publish of this partner's 6
  // landing pages whenever their profile saves AND the page is active. Any
  // visible field (name / photo / phone / email / business / slug) might
  // have changed, so we always republish rather than diff. Failures are
  // logged but never block the profile save.
  if (updated.partnerPageActive) {
    (async () => {
      try {
        const { publishPartnerPages } = await import('./partner-page-publisher.service.js')
        const result = await publishPartnerPages(partner.id)
        if (result.ok) {
          console.log(`[partner-page-publisher] ${partner.id} published — uploaded=${result.uploaded} generated=${result.generated}`)
        } else {
          console.warn(`[partner-page-publisher] ${partner.id} partial/failed — ${result.detail.join(', ').slice(0, 300)}`)
        }
      } catch (err) {
        console.warn(`[partner-page-publisher] ${partner.id} crashed: ${(err as Error).message}`)
      }
    })()
  }

  return updated
}

// ─── Booking preferences (Phase E.3) ─────────────────────────────────────────
// Partner-side knobs that constrain when a prospect can book: working hours,
// slot length, min notice, max advance window, and pre/post buffers. Consumed
// by searchAvailability() when called with a partnerId, and by the public
// /p/<slug>/book page (E.4).

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayKey = (typeof DAY_NAMES)[number]
// Optional mid-day closed window. Both ends set or both omitted (no break).
type DayHours = { open: string; close: string; breakStart?: string; breakEnd?: string }
type BookingHoursMap = Partial<Record<DayKey, DayHours | null>>

export interface PartnerBookingPreferences {
  bookingHoursJson: BookingHoursMap | null
  bookingSlotDurationMin: number
  bookingMinNoticeMin: number
  bookingMaxAdvanceDays: number
  bookingBufferBeforeMin: number
  bookingBufferAfterMin: number
  bookingTimezone: string | null
}

export async function getPartnerBookingPreferences(
  userId: string,
): Promise<PartnerBookingPreferences> {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { userId },
    select: {
      bookingHoursJson:       true,
      bookingSlotDurationMin: true,
      bookingMinNoticeMin:    true,
      bookingMaxAdvanceDays:  true,
      bookingBufferBeforeMin: true,
      bookingBufferAfterMin:  true,
      bookingTimezone:        true,
    },
  })
  if (!partner) {
    throw new AppError('NOT_FOUND', 'No partner record for this user', 404)
  }
  return {
    bookingHoursJson:       (partner.bookingHoursJson as BookingHoursMap | null) ?? null,
    bookingSlotDurationMin: partner.bookingSlotDurationMin,
    bookingMinNoticeMin:    partner.bookingMinNoticeMin,
    bookingMaxAdvanceDays:  partner.bookingMaxAdvanceDays,
    bookingBufferBeforeMin: partner.bookingBufferBeforeMin,
    bookingBufferAfterMin:  partner.bookingBufferAfterMin,
    bookingTimezone:        partner.bookingTimezone,
  }
}

function validateHHmm(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

function sanitizeBookingHours(input: unknown): BookingHoursMap | null {
  if (input === null) return null
  if (!input || typeof input !== 'object') {
    throw new AppError('BAD_REQUEST', 'bookingHoursJson must be an object or null', 400)
  }
  const out: BookingHoursMap = {}
  const src = input as Record<string, unknown>
  for (const day of DAY_NAMES) {
    if (!(day in src)) continue
    const v = src[day]
    if (v === null) { out[day] = null; continue }
    if (!v || typeof v !== 'object') {
      throw new AppError('BAD_REQUEST', `bookingHoursJson.${day} must be { open, close } or null`, 400)
    }
    const obj = v as { open?: unknown; close?: unknown; breakStart?: unknown; breakEnd?: unknown }
    if (typeof obj.open !== 'string' || typeof obj.close !== 'string' ||
        !validateHHmm(obj.open) || !validateHHmm(obj.close)) {
      throw new AppError(
        'BAD_REQUEST',
        `bookingHoursJson.${day} open/close must be "HH:mm" 24-hour strings`,
        400,
      )
    }
    if (obj.open >= obj.close) {
      throw new AppError('BAD_REQUEST', `bookingHoursJson.${day}: open must be earlier than close`, 400)
    }

    // Optional break window — both ends required, must fit inside [open, close)
    // and be a positive interval. Pass-through if neither is set (no break).
    const hasBreakStart = obj.breakStart !== undefined && obj.breakStart !== null && obj.breakStart !== ''
    const hasBreakEnd   = obj.breakEnd   !== undefined && obj.breakEnd   !== null && obj.breakEnd   !== ''
    const next: DayHours = { open: obj.open, close: obj.close }
    if (hasBreakStart !== hasBreakEnd) {
      throw new AppError('BAD_REQUEST', `bookingHoursJson.${day}: breakStart and breakEnd must both be set or both omitted`, 400)
    }
    if (hasBreakStart && hasBreakEnd) {
      if (typeof obj.breakStart !== 'string' || typeof obj.breakEnd !== 'string' ||
          !validateHHmm(obj.breakStart) || !validateHHmm(obj.breakEnd)) {
        throw new AppError('BAD_REQUEST', `bookingHoursJson.${day}: breakStart/breakEnd must be "HH:mm" 24-hour strings`, 400)
      }
      if (obj.breakStart >= obj.breakEnd) {
        throw new AppError('BAD_REQUEST', `bookingHoursJson.${day}: breakStart must be earlier than breakEnd`, 400)
      }
      if (obj.breakStart < obj.open || obj.breakEnd > obj.close) {
        throw new AppError('BAD_REQUEST', `bookingHoursJson.${day}: break window must fall within open/close`, 400)
      }
      next.breakStart = obj.breakStart
      next.breakEnd   = obj.breakEnd
    }
    out[day] = next
  }
  return out
}

export interface PartnerBookingPreferencesUpdate {
  bookingHoursJson?:       unknown
  bookingSlotDurationMin?: number
  bookingMinNoticeMin?:    number
  bookingMaxAdvanceDays?:  number
  bookingBufferBeforeMin?: number
  bookingBufferAfterMin?:  number
  bookingTimezone?:        string | null
}

export async function updatePartnerBookingPreferences(
  userId: string,
  data: PartnerBookingPreferencesUpdate,
): Promise<PartnerBookingPreferences> {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!partner) {
    throw new AppError('NOT_FOUND', 'No partner record for this user', 404)
  }

  const update: Record<string, unknown> = {}

  if (data.bookingHoursJson !== undefined) {
    update.bookingHoursJson = sanitizeBookingHours(data.bookingHoursJson) ?? null
  }
  const numField = (
    name: keyof PartnerBookingPreferencesUpdate,
    min: number,
    max: number,
  ) => {
    if (data[name] === undefined) return
    const v = data[name] as number
    if (!Number.isInteger(v) || v < min || v > max) {
      throw new AppError('BAD_REQUEST', `${name} must be an integer in [${min}, ${max}]`, 400)
    }
    update[name] = v
  }
  numField('bookingSlotDurationMin', 5, 480)
  numField('bookingMinNoticeMin', 0, 60 * 24 * 7)
  numField('bookingMaxAdvanceDays', 1, 365)
  numField('bookingBufferBeforeMin', 0, 240)
  numField('bookingBufferAfterMin', 0, 240)

  if (data.bookingTimezone !== undefined) {
    const tz = data.bookingTimezone
    if (tz !== null) {
      if (typeof tz !== 'string' || tz.length > 64) {
        throw new AppError('BAD_REQUEST', 'bookingTimezone must be a string IANA zone or null', 400)
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz })
      } catch {
        throw new AppError('BAD_REQUEST', `Unknown IANA timezone: ${tz}`, 400)
      }
    }
    update.bookingTimezone = tz
  }

  await prisma.affiliateAccount.update({ where: { id: partner.id }, data: update })
  return getPartnerBookingPreferences(userId)
}

// ─── Reminder preferences (Phase E.12) ───────────────────────────────────────
// Per-partner control over the reminder cadence + channels for partner-routed
// bookings. The reminder runner (apps/api/src/services/reminder.service.ts)
// prefers these over BusinessProfile defaults when Appointment.partnerId set.

export interface PartnerReminderPreferences {
  reminderEnabled:       boolean
  reminderOffsetsMin:    number[]
  reminderEmailEnabled:  boolean
  reminderSmsEnabled:    boolean
}

export async function getPartnerReminderPreferences(userId: string): Promise<PartnerReminderPreferences> {
  const partner = await prisma.affiliateAccount.findUnique({
    where:  { userId },
    select: {
      partnerReminderEnabled:      true,
      partnerReminderOffsetsMin:   true,
      partnerReminderEmailEnabled: true,
      partnerReminderSmsEnabled:   true,
    },
  })
  if (!partner) throw new AppError('NOT_FOUND', 'No partner record for this user', 404)
  return {
    reminderEnabled:       partner.partnerReminderEnabled,
    reminderOffsetsMin:    partner.partnerReminderOffsetsMin,
    reminderEmailEnabled:  partner.partnerReminderEmailEnabled,
    reminderSmsEnabled:    partner.partnerReminderSmsEnabled,
  }
}

export interface PartnerReminderPreferencesUpdate {
  reminderEnabled?:       boolean
  reminderOffsetsMin?:    unknown  // validated to number[] below
  reminderEmailEnabled?:  boolean
  reminderSmsEnabled?:    boolean
}

export async function updatePartnerReminderPreferences(
  userId: string,
  data: PartnerReminderPreferencesUpdate,
): Promise<PartnerReminderPreferences> {
  const partner = await prisma.affiliateAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!partner) throw new AppError('NOT_FOUND', 'No partner record for this user', 404)

  const update: Record<string, unknown> = {}

  if (data.reminderEnabled !== undefined) {
    if (typeof data.reminderEnabled !== 'boolean') throw new AppError('BAD_REQUEST', 'reminderEnabled must be a boolean', 400)
    update['partnerReminderEnabled'] = data.reminderEnabled
  }
  if (data.reminderEmailEnabled !== undefined) {
    if (typeof data.reminderEmailEnabled !== 'boolean') throw new AppError('BAD_REQUEST', 'reminderEmailEnabled must be a boolean', 400)
    update['partnerReminderEmailEnabled'] = data.reminderEmailEnabled
  }
  if (data.reminderSmsEnabled !== undefined) {
    if (typeof data.reminderSmsEnabled !== 'boolean') throw new AppError('BAD_REQUEST', 'reminderSmsEnabled must be a boolean', 400)
    update['partnerReminderSmsEnabled'] = data.reminderSmsEnabled
  }
  if (data.reminderOffsetsMin !== undefined) {
    if (!Array.isArray(data.reminderOffsetsMin)) {
      throw new AppError('BAD_REQUEST', 'reminderOffsetsMin must be an array of integers (minutes before)', 400)
    }
    const arr = data.reminderOffsetsMin as unknown[]
    if (arr.length > 8) throw new AppError('BAD_REQUEST', 'reminderOffsetsMin: at most 8 offsets allowed', 400)
    const cleaned: number[] = []
    for (const v of arr) {
      if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 60 * 24 * 30) {
        throw new AppError('BAD_REQUEST', 'reminderOffsetsMin entries must be integers in [1, 43200] minutes', 400)
      }
      cleaned.push(v as number)
    }
    update['partnerReminderOffsetsMin'] = Array.from(new Set(cleaned)).sort((a, b) => b - a)
  }

  if (Object.keys(update).length > 0) {
    await prisma.affiliateAccount.update({ where: { id: partner.id }, data: update })
  }
  return getPartnerReminderPreferences(userId)
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
  // Lock to Tier 1's current commission rate for life (see commission-tier.service.ts).
  const { getSignupCommissionSnapshot } = await import('./commission-tier.service.js')
  const commissionSnapshot = await getSignupCommissionSnapshot()

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
        ...commissionSnapshot,
      },
    })

    return { user, partner }
  })
}

// ─── Outbound: sendPartnerEmail ──────────────────────────────────────────────

const PARTNER_DOMAIN = 'myorbisresults.com'
const MARKETING_BASE_URL = 'https://myorbisvoice.com'
const APP_BASE_URL = 'https://app.myorbisvoice.com'

/**
 * Build an email-client-safe signature block from a partner's profile fields.
 * Table-based layout with inline styles — works in Gmail / Outlook / iOS Mail
 * without CSS support. No flexbox, no external CSS, no JS.
 *
 * Pulls (all optional, gracefully omitted if missing):
 *   - avatarUrl  → 64×64 circular image on the left
 *   - displayName / firstName+lastName / slug — bold name line
 *   - businessName → secondary line under name
 *   - <slug>@myorbisresults.com → mailto link
 *   - partnerPhone → tel link (E.164-normalized)
 *   - landing page URL (myorbisvoice.com/p/<slug>/) → link
 *
 * Partners can still override with custom HTML via AffiliateAccount.emailSignature
 * — when that field is non-empty the override wins. When empty (default), this
 * auto-generated block is appended at send time.
 */
type SignaturePartner = {
  slug:          string | null
  displayName:   string | null
  businessName:  string | null
  avatarUrl:     string | null
  partnerPhone:  string | null
  referralCode:  string | null
  user: { firstName: string | null; lastName: string | null; email: string }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildPartnerSignatureHtml(p: SignaturePartner, customLinkSlug?: string | null): string {
  if (!p.slug) return ''  // no slug = no platform identity = no signature

  // Partner signature: avatar (top), name, agency, email, phone, referral link.
  // Single source of truth — appended at send time.
  const name = (p.displayName?.trim())
    || [p.user.firstName, p.user.lastName].filter(Boolean).join(' ').trim()
    || p.slug
  const business = p.businessName?.trim() || ''
  const email    = `${p.slug}@${PARTNER_DOMAIN}`
  const phone    = p.partnerPhone?.trim() || ''
  const avatar   = p.avatarUrl?.trim() || ''
  const refCode    = p.referralCode?.trim() || ''
  const customSlug = customLinkSlug?.trim() || ''
  // Prefer the partner's custom link (/r/<slug>) once they've set one up;
  // otherwise fall back to the raw primary referral link (/?ref=<code>).
  const refLink    = customSlug
    ? `${APP_BASE_URL}/r/${encodeURIComponent(customSlug)}`
    : (refCode ? `${MARKETING_BASE_URL}/?ref=${encodeURIComponent(refCode)}` : '')

  const avatarLine = avatar
    ? `<div style="margin-bottom:8px;"><img src="${esc(avatar)}" width="64" height="64" alt="" style="border-radius:50%;display:block;border:0;outline:0;text-decoration:none;" /></div>`
    : ''
  const businessLine = business
    ? `<div style="font-size:13px;color:#555;line-height:1.4;">${esc(business)}</div>`
    : ''
  const emailLine = `<div style="font-size:13px;margin-top:6px;line-height:1.5;"><a href="mailto:${esc(email)}" style="color:#0a7a8a;text-decoration:none;">${esc(email)}</a></div>`
  const phoneLine = phone
    ? `<div style="font-size:13px;margin-top:6px;line-height:1.5;"><a href="tel:${esc(phone.replace(/[^+\d]/g, ''))}" style="color:#0a7a8a;text-decoration:none;">${esc(phone)}</a></div>`
    : ''
  const refLine = refLink
    ? `<div style="font-size:13px;margin-top:6px;line-height:1.5;"><a href="${esc(refLink)}" target="_blank" rel="noopener noreferrer" style="color:#0a7a8a;text-decoration:none;">${esc(refLink)}</a></div>`
    : ''

  return [
    '<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.4;">',
    '  <tr>',
    '    <td valign="top">',
    avatarLine,
    `      <div style="font-size:15px;font-weight:bold;color:#111;line-height:1.4;">${esc(name)}</div>`,
    businessLine,
    emailLine,
    phoneLine,
    refLine,
    '    </td>',
    '  </tr>',
    '</table>',
  ].filter(Boolean).join('\n')
}

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
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      customLinks: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { slug: true } },
    },
  })
  if (!partner)       throw new AppError('NOT_FOUND', 'Partner not found', 404)
  if (!partner.slug)  throw new AppError('VALIDATION_ERROR', 'Partner has no slug yet — cannot send', 422)

  const fromAddr = `${partner.slug}@${PARTNER_DOMAIN}`
  const fromName = partner.displayName
                 ?? [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ').trim()
                 ?? partner.slug
  const fromHeader = `${fromName} <${fromAddr}>`

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]

  // Compose final HTML body. Signature precedence:
  //   1. partner.emailSignature (custom HTML override) — if non-empty
  //   2. auto-generated signature from profile fields — always present once
  //      slug is set
  // The wrapping <div> visually separates the signature with a thin border.
  const customSig = partner.emailSignature?.trim()
  const sigInner  = customSig && customSig.length > 0
    ? customSig
    : buildPartnerSignatureHtml(partner, partner.customLinks[0]?.slug ?? null)
  const html = sigInner
    ? `${opts.html}\n<br><br>\n<div style="border-top:1px solid #eee;padding-top:12px;margin-top:24px;">${sigInner}</div>`
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

