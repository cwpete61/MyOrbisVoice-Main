import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const updateTenantSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  legalName: z.string().max(200).optional().nullable(),
  timezone: z.string().max(60).optional(),
  publicEmail: z.string().email().optional().nullable(),
  publicPhone: z.string().max(30).optional().nullable(),
  website: z.string().url().optional().nullable(),
  industryVertical: z.string().optional(),
})

export const updateBusinessProfileSchema = z.object({
  brandName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  serviceAreasJson: z.unknown().optional().nullable(),
  businessHoursJson: z.unknown().optional().nullable(),
  fallbackNotificationEmail: z.string().email().optional().nullable(),
  // Marketing voice intensity — see docs/marketing-style-guide.md
  aggressionTier: z.enum(['conservative', 'balanced', 'direct', 'aggressive']).optional(),
})

export async function getTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, slug: true, displayName: true, legalName: true,
      status: true, timezone: true, registrationEmail: true,
      publicEmail: true, publicPhone: true, website: true,
      industryVertical: true, createdAt: true, updatedAt: true,
    },
  })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)
  return tenant
}

export async function updateTenant(tenantId: string, data: z.infer<typeof updateTenantSchema>) {
  const { industryVertical, ...rest } = data
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { ...rest, ...(industryVertical ? { industryVertical: industryVertical as any } : {}) },
    select: {
      id: true, slug: true, displayName: true, legalName: true,
      status: true, timezone: true, publicEmail: true, publicPhone: true,
      website: true, industryVertical: true, updatedAt: true,
    },
  })
}

export async function getBusinessProfile(tenantId: string) {
  const profile = await prisma.businessProfile.findUnique({ where: { tenantId } })
  if (!profile) throw new AppError('NOT_FOUND', 'Business profile not found', 404)
  return profile
}

export async function upsertBusinessProfile(tenantId: string, data: z.infer<typeof updateBusinessProfileSchema>) {
  const toJson = (v: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined =>
    v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue)

  const fields = {
    ...data,
    serviceAreasJson: toJson(data.serviceAreasJson),
    businessHoursJson: toJson(data.businessHoursJson),
  }

  return prisma.businessProfile.upsert({
    where: { tenantId },
    update: fields,
    create: { tenantId, brandName: data.brandName ?? 'My Business', ...fields },
  })
}

// ─── Booking preferences (Phase E.5) ─────────────────────────────────────────
// Tenant-side counterpart to AffiliateAccount.booking* (E.3). Lives on
// BusinessProfile alongside businessHoursJson. searchAvailability consumes
// these whenever a booking is NOT partner-routed.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayKey = (typeof DAY_KEYS)[number]
type DayHours = { open: string; close: string }
type BookingHoursMap = Partial<Record<DayKey, DayHours | null>>

export interface TenantBookingPreferences {
  businessHoursJson:       BookingHoursMap | null
  bookingSlotDurationMin:  number
  bookingMinNoticeMin:     number
  bookingMaxAdvanceDays:   number
  bookingBufferBeforeMin:  number
  bookingBufferAfterMin:   number
  timezone:                string | null
  // Phase E.6 — reminder configuration
  reminderEnabled:         boolean
  reminderOffsetsMin:      number[]
  reminderEmailEnabled:    boolean
  reminderSmsEnabled:      boolean
  // Phase E.8 — optional reminder copy templates (null = use defaults)
  reminderEmailSubject:    string | null
  reminderEmailIntro:      string | null
  reminderSmsBody:         string | null
}

export async function getTenantBookingPreferences(tenantId: string): Promise<TenantBookingPreferences> {
  const [profile, tenant] = await Promise.all([
    prisma.businessProfile.findUnique({
      where:  { tenantId },
      select: {
        businessHoursJson:      true,
        bookingSlotDurationMin: true,
        bookingMinNoticeMin:    true,
        bookingMaxAdvanceDays:  true,
        bookingBufferBeforeMin: true,
        bookingBufferAfterMin:  true,
        reminderEnabled:        true,
        reminderOffsetsMin:     true,
        reminderEmailEnabled:   true,
        reminderSmsEnabled:     true,
        reminderEmailSubject:   true,
        reminderEmailIntro:     true,
        reminderSmsBody:        true,
      },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
  ])
  return {
    businessHoursJson:      (profile?.businessHoursJson as BookingHoursMap | null) ?? null,
    bookingSlotDurationMin: profile?.bookingSlotDurationMin ?? 30,
    bookingMinNoticeMin:    profile?.bookingMinNoticeMin    ?? 60,
    bookingMaxAdvanceDays:  profile?.bookingMaxAdvanceDays  ?? 60,
    bookingBufferBeforeMin: profile?.bookingBufferBeforeMin ?? 0,
    bookingBufferAfterMin:  profile?.bookingBufferAfterMin  ?? 0,
    timezone:               tenant?.timezone ?? null,
    reminderEnabled:        profile?.reminderEnabled        ?? true,
    reminderOffsetsMin:     profile?.reminderOffsetsMin     ?? [1440, 60],
    reminderEmailEnabled:   profile?.reminderEmailEnabled   ?? true,
    reminderSmsEnabled:     profile?.reminderSmsEnabled     ?? true,
    reminderEmailSubject:   profile?.reminderEmailSubject   ?? null,
    reminderEmailIntro:     profile?.reminderEmailIntro     ?? null,
    reminderSmsBody:        profile?.reminderSmsBody        ?? null,
  }
}

function validateHHmm(v: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) }

function sanitizeBookingHours(input: unknown): BookingHoursMap | null {
  if (input === null) return null
  if (!input || typeof input !== 'object') {
    throw new AppError('BAD_REQUEST', 'businessHoursJson must be an object or null', 400)
  }
  const out: BookingHoursMap = {}
  const src = input as Record<string, unknown>
  for (const day of DAY_KEYS) {
    if (!(day in src)) continue
    const v = src[day]
    if (v === null) { out[day] = null; continue }
    if (!v || typeof v !== 'object') {
      throw new AppError('BAD_REQUEST', `businessHoursJson.${day} must be { open, close } or null`, 400)
    }
    const obj = v as { open?: unknown; close?: unknown }
    if (typeof obj.open !== 'string' || typeof obj.close !== 'string' ||
        !validateHHmm(obj.open) || !validateHHmm(obj.close)) {
      throw new AppError('BAD_REQUEST',
        `businessHoursJson.${day} open/close must be "HH:mm" 24-hour strings`, 400)
    }
    if (obj.open >= obj.close) {
      throw new AppError('BAD_REQUEST', `businessHoursJson.${day}: open must be earlier than close`, 400)
    }
    out[day] = { open: obj.open, close: obj.close }
  }
  return out
}

export interface TenantBookingPreferencesUpdate {
  businessHoursJson?:      unknown
  bookingSlotDurationMin?: number
  bookingMinNoticeMin?:    number
  bookingMaxAdvanceDays?:  number
  bookingBufferBeforeMin?: number
  bookingBufferAfterMin?:  number
  timezone?:               string | null
  reminderEnabled?:        boolean
  reminderOffsetsMin?:     unknown  // validated to number[] below
  reminderEmailEnabled?:   boolean
  reminderSmsEnabled?:     boolean
  reminderEmailSubject?:   string | null
  reminderEmailIntro?:     string | null
  reminderSmsBody?:        string | null
}

export async function updateTenantBookingPreferences(
  tenantId: string,
  data: TenantBookingPreferencesUpdate,
): Promise<TenantBookingPreferences> {
  const profileUpdate: Record<string, unknown> = {}

  if (data.businessHoursJson !== undefined) {
    const sanitized = sanitizeBookingHours(data.businessHoursJson)
    profileUpdate['businessHoursJson'] = sanitized === null ? Prisma.JsonNull : (sanitized as Prisma.InputJsonValue)
  }
  const numField = (name: keyof TenantBookingPreferencesUpdate, min: number, max: number) => {
    if (data[name] === undefined) return
    const v = data[name] as number
    if (!Number.isInteger(v) || v < min || v > max) {
      throw new AppError('BAD_REQUEST', `${name} must be an integer in [${min}, ${max}]`, 400)
    }
    profileUpdate[name] = v
  }
  numField('bookingSlotDurationMin', 5, 480)
  numField('bookingMinNoticeMin', 0, 60 * 24 * 7)
  numField('bookingMaxAdvanceDays', 1, 365)
  numField('bookingBufferBeforeMin', 0, 240)
  numField('bookingBufferAfterMin', 0, 240)

  // Phase E.6 — reminder config validation
  if (data.reminderEnabled !== undefined) {
    if (typeof data.reminderEnabled !== 'boolean') {
      throw new AppError('BAD_REQUEST', 'reminderEnabled must be a boolean', 400)
    }
    profileUpdate['reminderEnabled'] = data.reminderEnabled
  }
  if (data.reminderEmailEnabled !== undefined) {
    if (typeof data.reminderEmailEnabled !== 'boolean') {
      throw new AppError('BAD_REQUEST', 'reminderEmailEnabled must be a boolean', 400)
    }
    profileUpdate['reminderEmailEnabled'] = data.reminderEmailEnabled
  }
  if (data.reminderSmsEnabled !== undefined) {
    if (typeof data.reminderSmsEnabled !== 'boolean') {
      throw new AppError('BAD_REQUEST', 'reminderSmsEnabled must be a boolean', 400)
    }
    profileUpdate['reminderSmsEnabled'] = data.reminderSmsEnabled
  }
  // Phase E.8 — reminder template overrides. Length-capped to match the DB
  // VarChar widths; null clears the override and reverts to the default.
  const strField = (
    name: 'reminderEmailSubject' | 'reminderEmailIntro' | 'reminderSmsBody',
    max: number,
  ) => {
    if (data[name] === undefined) return
    const v = data[name]
    if (v === null) { profileUpdate[name] = null; return }
    if (typeof v !== 'string') {
      throw new AppError('BAD_REQUEST', `${name} must be a string or null`, 400)
    }
    if (v.length > max) {
      throw new AppError('BAD_REQUEST', `${name} must be ${max} characters or fewer`, 400)
    }
    profileUpdate[name] = v
  }
  strField('reminderEmailSubject', 200)
  strField('reminderEmailIntro',   1000)
  strField('reminderSmsBody',      320)

  if (data.reminderOffsetsMin !== undefined) {
    if (!Array.isArray(data.reminderOffsetsMin)) {
      throw new AppError('BAD_REQUEST', 'reminderOffsetsMin must be an array of integers (minutes before)', 400)
    }
    const arr = data.reminderOffsetsMin as unknown[]
    if (arr.length > 8) {
      throw new AppError('BAD_REQUEST', 'reminderOffsetsMin: at most 8 offsets allowed', 400)
    }
    const cleaned: number[] = []
    for (const v of arr) {
      if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 60 * 24 * 30) {
        throw new AppError('BAD_REQUEST', 'reminderOffsetsMin entries must be integers in [1, 43200] minutes', 400)
      }
      cleaned.push(v as number)
    }
    // Deduplicate and sort descending so the longest lead time fires first.
    profileUpdate['reminderOffsetsMin'] = Array.from(new Set(cleaned)).sort((a, b) => b - a)
  }

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.businessProfile.upsert({
      where:  { tenantId },
      update: profileUpdate,
      create: { tenantId, brandName: 'My Business', ...profileUpdate },
    })
  }

  if (data.timezone !== undefined) {
    const tz = data.timezone
    if (tz !== null) {
      if (typeof tz !== 'string' || tz.length > 64) {
        throw new AppError('BAD_REQUEST', 'timezone must be a string IANA zone or null', 400)
      }
      try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) }
      catch { throw new AppError('BAD_REQUEST', `Unknown IANA timezone: ${tz}`, 400) }
    }
    await prisma.tenant.update({ where: { id: tenantId }, data: { timezone: tz ?? 'UTC' } })
  }

  return getTenantBookingPreferences(tenantId)
}
