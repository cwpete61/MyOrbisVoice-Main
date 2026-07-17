/**
 * MyOrbisWebinar — webinar/session CRUD + registration (Phase 1).
 *
 * Registration is where the spine starts: resolve the person (D4), create the
 * Registrant, and append the REGISTERED event (which seeds their EngagementScore).
 * Reminders/booking-CTA come in Phase 2 (they route through Voice compliance).
 */
import type { WebinarSessionKind } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { resolvePerson } from './identity.service.js'
import { appendEvent } from './events.service.js'
import { createAppointment } from '../appointment.service.js'
import { createContact } from '../contact.service.js'
import { processOptIn } from '../opt-out.service.js'
import { webinarWhiteLabel } from './entitlement.js'
import { parseVideoUrlOrThrow, assertSafeHttpUrl } from './video.js'

/**
 * Translate the tenant's pasted `videoUrl` into the two columns that store it.
 *
 * Callers never set videoProvider/videoAssetRef directly: they are two halves of one
 * fact, and a provider without a ref (or the reverse) renders a broken player. One
 * owner keeps them in lockstep.
 *
 * Tri-state on purpose:
 *   undefined → field absent from the patch; leave the video alone
 *   null / '' → tenant cleared it; unset BOTH columns
 *   a string  → parse strictly, or 422
 */
function videoColumns(videoUrl: string | null | undefined) {
  if (videoUrl === undefined) return {}
  if (videoUrl === null || videoUrl.trim() === '') return { videoProvider: null, videoAssetRef: null }
  const { provider, ref } = parseVideoUrlOrThrow(videoUrl)
  return { videoProvider: provider, videoAssetRef: ref }
}

/** Same tri-state for a tenant-supplied outbound link. Empty clears it. */
function safeUrlColumn(url: string | null | undefined, field: string): string | null | undefined {
  if (url === undefined) return undefined
  if (url === null || url.trim() === '') return null
  return assertSafeHttpUrl(url, field)
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'webinar'
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base)
  let slug = root
  let n = 1
  // Small bounded loop — collisions are rare at this scale.
  while (await prisma.webinar.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1
    slug = `${root}-${n}`
  }
  return slug
}

export async function createWebinar(input: {
  tenantId: string
  title: string
  titleEs?: string | null
  description?: string | null
  descriptionEs?: string | null
  vertical?: string | null
  videoUrl?: string | null
  ctaLabel?: string | null
  ctaLabelEs?: string | null
  ctaUrl?: string | null
  resourceUrl?: string | null
  createdBy?: string | null
}) {
  const slug = await uniqueSlug(input.title)
  // Every webinar gets a default evergreen session so it's registrable the
  // moment it's published (registration needs status=PUBLISHED + an OPEN session).
  return prisma.webinar.create({
    data: {
      tenantId:      input.tenantId,
      slug,
      title:         input.title,
      titleEs:       input.titleEs ?? null,
      description:   input.description ?? null,
      descriptionEs: input.descriptionEs ?? null,
      vertical:      input.vertical ?? null,
      ctaLabel:      input.ctaLabel ?? null,
      ctaLabelEs:    input.ctaLabelEs ?? null,
      ctaUrl:        safeUrlColumn(input.ctaUrl, 'CTA link') ?? null,
      resourceUrl:   safeUrlColumn(input.resourceUrl, 'Lead magnet link') ?? null,
      createdBy:     input.createdBy ?? null,
      ...videoColumns(input.videoUrl),
      sessions:      { create: { tenantId: input.tenantId, kind: 'EVERGREEN', status: 'OPEN' } },
    },
    include: { sessions: true },
  })
}

export async function updateWebinar(tenantId: string, id: string, patch: {
  title?: string; titleEs?: string | null; description?: string | null
  descriptionEs?: string | null; vertical?: string | null; coverImageUrl?: string | null
  videoUrl?: string | null; ctaLabel?: string | null; ctaLabelEs?: string | null
  ctaUrl?: string | null; resourceUrl?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}) {
  const existing = await prisma.webinar.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) throw new AppError('NOT_FOUND', 'Webinar not found', 404)

  // videoUrl is an input, not a column — strip it and expand into the real pair.
  // Passing the patch straight through would make Prisma throw on the unknown key.
  const { videoUrl, ctaUrl, resourceUrl, ...rest } = patch
  return prisma.webinar.update({
    where: { id },
    data: {
      ...rest,
      ...videoColumns(videoUrl),
      ...(ctaUrl      !== undefined ? { ctaUrl:      safeUrlColumn(ctaUrl, 'CTA link') } : {}),
      ...(resourceUrl !== undefined ? { resourceUrl: safeUrlColumn(resourceUrl, 'Lead magnet link') } : {}),
    },
  })
}

/**
 * A webinar is publishable only if it can actually do its job.
 *
 * Publishing without a video ships a play button over nothing — which is exactly the
 * bug this feature exists to kill, and worse than a 404 because it still emits WATCHED
 * heartbeats and scores the lead on fiction.
 *
 * Publishing without a CTA is quieter but just as broken: CTA_CLICKED is the hero
 * rule's trigger, so a webinar with no offer can never produce a booking or a call.
 * On a product measured by pipeline, that is a webinar that cannot pay for itself.
 *
 * Both are cheap to fix and the tenant is standing right there in the editor.
 */
export async function assertPublishable(tenantId: string, id: string): Promise<void> {
  const w = await prisma.webinar.findFirst({
    where:  { id, tenantId },
    select: { videoProvider: true, videoAssetRef: true, ctaUrl: true },
  })
  if (!w) throw new AppError('NOT_FOUND', 'Webinar not found', 404)

  const missing: string[] = []
  if (!w.videoProvider || !w.videoAssetRef) missing.push('a video (paste a YouTube or Vimeo link)')
  if (!w.ctaUrl) missing.push('a CTA link (where the button sends them)')
  if (missing.length) {
    throw new AppError('VALIDATION_ERROR', `Can't publish yet — add ${missing.join(' and ')}.`, 422)
  }
}

/** Attendee-facing engagement event (watch heartbeat, poll, CTA, question) keyed
 *  by the registrant's opaque joinToken — no login. Server-authoritative event
 *  types (REGISTERED/BOOKED/PURCHASED) are rejected here. */
const ATTENDEE_EVENTS = new Set(['JOINED', 'WATCHED', 'POLL_ANSWERED', 'QUESTION_ASKED', 'CTA_CLICKED', 'DOWNLOADED', 'REPLAY_WATCHED'])
export async function recordEngagement(input: {
  joinToken: string
  type: string
  meta?: Record<string, unknown> | null
  traceId?: string | null
}) {
  if (!ATTENDEE_EVENTS.has(input.type)) {
    throw new AppError('VALIDATION_ERROR', `Event type ${input.type} cannot be reported by an attendee`, 422)
  }
  const reg = await prisma.registrant.findUnique({
    where:  { joinToken: input.joinToken },
    select: { personId: true, webinarId: true, sessionId: true, tenantId: true },
  })
  if (!reg) throw new AppError('NOT_FOUND', 'Registration not found', 404)

  // Mark attendance timestamp on first JOINED.
  if (input.type === 'JOINED') {
    await prisma.registrant.updateMany({
      where: { joinToken: input.joinToken, attendedAt: null },
      data:  { attendedAt: new Date() },
    })
  }

  // Accumulate watch time on the registrant. The player sends WATCHED heartbeats
  // carrying `seconds`; without this the total lives only inside event metaJson and
  // Registrant.watchSeconds stays 0 forever. Increment (not set) — each heartbeat
  // reports its own interval, not a running total.
  if (input.type === 'WATCHED') {
    const seconds = Number((input.meta as { seconds?: unknown } | undefined)?.seconds)
    if (Number.isFinite(seconds) && seconds > 0) {
      await prisma.registrant.update({
        where: { joinToken: input.joinToken },
        data:  { watchSeconds: { increment: Math.round(seconds) } },
      })
    }
  }
  return appendEvent({
    personId:  reg.personId,
    tenantId:  reg.tenantId,
    type:      input.type as never,
    source:    'WEBINAR',
    webinarId: reg.webinarId,
    sessionId: reg.sessionId,
    traceId:   input.traceId ?? null,
    meta:      input.meta ?? null,
  })
}

export async function listWebinars(tenantId: string) {
  return prisma.webinar.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { registrants: true, sessions: true } } },
  })
}

export async function getWebinar(tenantId: string, id: string) {
  const webinar = await prisma.webinar.findFirst({
    where:   { id, tenantId },
    include: { sessions: { orderBy: { createdAt: 'asc' } }, _count: { select: { registrants: true } } },
  })
  if (!webinar) throw new AppError('NOT_FOUND', 'Webinar not found', 404)
  return webinar
}

/**
 * Public registration-page payload (safe subset, no tenant internals).
 *
 * Includes the HOSTING TENANT'S brand, because this page is seen by the tenant's
 * prospects — not by us and not by our customers. Acme Roofing's registrants must see
 * "Acme Roofing". Branding it MyOrbisWebinar (or, as it was hardcoded, MyOrbisAgents)
 * would be like Mailchimp stamping its logo on a business's own emails. White-label by
 * default; a "powered by" footer would be a tier/pricing decision, not a default.
 *
 * Only brandName + logoUrl cross the wire — everything else on BusinessProfile is
 * tenant-internal and must not leak to an unauthenticated page.
 */
export async function getPublicWebinarBySlug(slug: string) {
  const webinar = await prisma.webinar.findFirst({
    where:  { slug, status: 'PUBLISHED' },
    select: {
      id: true, slug: true, title: true, titleEs: true, description: true,
      descriptionEs: true, coverImageUrl: true, tenantId: true,
      // The webinar itself. videoAssetRef is a provider-native id, safe to expose:
      // the page rebuilds the embed URL from it via a fixed template.
      videoProvider: true, videoAssetRef: true,
      ctaLabel: true, ctaLabelEs: true, ctaUrl: true, resourceUrl: true,
      sessions: {
        where:   { status: 'OPEN' },
        orderBy: { startsAt: 'asc' },
        select:  { id: true, kind: true, startsAt: true, timezone: true },
      },
    },
  })
  if (!webinar) throw new AppError('NOT_FOUND', 'Webinar not found', 404)

  // Webinar.tenantId has no FK relation, so this is a second lookup rather than an
  // include. BusinessProfile is 1:1 per tenant (tenantId @unique); fall back to the
  // Tenant's displayName when a profile hasn't been filled in yet.
  const [profile, tenant] = await Promise.all([
    prisma.businessProfile.findUnique({
      where:  { tenantId: webinar.tenantId },
      select: { brandName: true, logoUrl: true },
    }),
    prisma.tenant.findUnique({
      where:  { id: webinar.tenantId },
      select: { displayName: true },
    }),
  ])

  // Lower tiers carry a "Powered by MyOrbis" mark; paid tiers buy it away. Resolved
  // server-side so the client can't just not-render it.
  const whiteLabel = await webinarWhiteLabel(webinar.tenantId)

  const { tenantId: _tenantId, ...safe } = webinar // don't expose the tenant id publicly
  return {
    ...safe,
    brand: {
      name:    profile?.brandName ?? tenant?.displayName ?? null,
      logoUrl: profile?.logoUrl ?? null,
    },
    poweredBy: !whiteLabel,
  }
}

export async function createSession(input: {
  tenantId: string
  webinarId: string
  kind?: WebinarSessionKind
  startsAt?: Date | null
  timezone?: string
}) {
  const webinar = await prisma.webinar.findFirst({ where: { id: input.webinarId, tenantId: input.tenantId }, select: { id: true } })
  if (!webinar) throw new AppError('NOT_FOUND', 'Webinar not found', 404)
  return prisma.webinarSession.create({
    data: {
      webinarId: input.webinarId,
      tenantId:  input.tenantId,
      kind:      input.kind ?? 'EVERGREEN',
      startsAt:  input.startsAt ?? null,
      timezone:  input.timezone ?? 'America/New_York',
    },
  })
}

/**
 * Register a person for a webinar (public). Idempotent per (webinar, email):
 * a repeat registration returns the existing Registrant without double-logging.
 */
/**
 * Ensure a WebinarPerson has a Voice CRM Contact, creating one if needed, and apply
 * the consent posture. Returns the contactId.
 *
 * THE COMPLIANCE WALL. createContact() defaults optedOutVoice=false (opted IN), which
 * is wrong for a webinar lead — so a Contact born here is forced opted OUT of voice and
 * SMS, matching every other cold-lead path in this codebase (lead-engine, partner-crm,
 * public, gmb-evaluation). Only an explicit, user-ticked consent re-opens a channel, via
 * processOptIn (which clears the flag AND writes the OptOutLog proof).
 *
 * Why a Contact exists at REGISTRATION and not only at booking: the hero rule chases
 * people who clicked the CTA and did NOT book. OutboundCallAttempt.contactId is a
 * required FK and optedOutVoice lives only on Contact — so with no Contact those people
 * are both un-callable and un-gateable, and the rule could never fire for its own target.
 */
async function ensureContactForPerson(input: {
  tenantId: string
  personId: string
  name: string
  email: string
  phone?: string | null
  voiceConsent?: boolean | undefined
  smsConsent?: boolean | undefined
  source: string
}): Promise<string> {
  const person = await prisma.webinarPerson.findUnique({
    where:  { id: input.personId },
    select: { contactId: true },
  })
  let contactId = person?.contactId ?? null

  if (!contactId) {
    const [firstName, ...rest] = input.name.trim().split(/\s+/)
    const contact = await createContact(input.tenantId, {
      firstName: firstName ?? input.name,
      lastName:  rest.length ? rest.join(' ') : undefined,
      email:     input.email,
      phoneE164: input.phone ?? undefined,
      source:    input.source,
    })
    // The wall goes up first; consent (below) is the only thing that lowers it.
    await prisma.contact.update({
      where: { id: contact.id },
      data:  { optedOutVoice: true, optedOutVoiceAt: new Date(), optedOutSms: true, optedOutSmsAt: new Date() },
    })
    contactId = contact.id
    await prisma.webinarPerson.update({ where: { id: input.personId }, data: { contactId } })
  }

  // Explicit consent only. processOptIn writes the flag + the audit trail together.
  if (input.voiceConsent) await processOptIn(input.tenantId, contactId, 'VOICE', 'MANUAL')
  if (input.smsConsent)   await processOptIn(input.tenantId, contactId, 'SMS',   'MANUAL')

  return contactId
}

export async function registerForSession(input: {
  slug: string
  name: string
  email: string
  phone?: string | null
  locale?: string
  sessionId?: string | null
  voiceConsent?: boolean | undefined
  smsConsent?: boolean | undefined
}) {
  const webinar = await prisma.webinar.findFirst({
    where:  { slug: input.slug, status: 'PUBLISHED' },
    select: { id: true, tenantId: true },
  })
  if (!webinar) throw new AppError('NOT_FOUND', 'Webinar not found', 404)

  const person = await resolvePerson({
    tenantId: webinar.tenantId,
    email:    input.email,
    phone:    input.phone,
    fullName: input.name,
  })

  // Contact + consent BEFORE the already-registered short-circuit: it's idempotent,
  // and a repeat registration is exactly when someone re-submits the form with the
  // consent box ticked. Running it after the early return would strand every existing
  // registrant without a Contact — and no Contact means the hero rule can never reach
  // them (OutboundCallAttempt.contactId is a required FK).
  await ensureContactForPerson({
    tenantId:     webinar.tenantId,
    personId:     person.id,
    name:         input.name,
    email:        input.email,
    phone:        input.phone ?? null,
    voiceConsent: input.voiceConsent,
    smsConsent:   input.smsConsent,
    source:       'webinar-registration',
  })

  const existing = await prisma.registrant.findUnique({
    where:  { webinarId_email: { webinarId: webinar.id, email: input.email.trim().toLowerCase() } },
    select: { id: true, joinToken: true },
  })
  if (existing) {
    return { registrantId: existing.id, joinToken: existing.joinToken, alreadyRegistered: true }
  }

  const registrant = await prisma.registrant.create({
    data: {
      webinarId: webinar.id,
      sessionId: input.sessionId ?? null,
      tenantId:  webinar.tenantId,
      personId:  person.id,
      name:      input.name,
      email:     input.email.trim().toLowerCase(),
      phone:     input.phone ?? null,
      locale:    input.locale === 'es' ? 'es' : 'en',
    },
    select: { id: true, joinToken: true },
  })

  // Seed the spine — REGISTERED event (idempotent via traceId).
  await appendEvent({
    personId:  person.id,
    tenantId:  webinar.tenantId,
    type:      'REGISTERED',
    source:    'WEBINAR',
    webinarId: webinar.id,
    sessionId: input.sessionId ?? null,
    traceId:   `reg:${registrant.id}`,
  })

  return { registrantId: registrant.id, joinToken: registrant.joinToken, alreadyRegistered: false }
}

/**
 * BOOKED producer — the booking-first CTA. An attendee books a call straight from
 * the watch page; we create a real Voice Appointment and emit BOOKED.
 *
 * Why a Contact is created here: Appointment.contactId is optional, but
 * AppointmentReminder.contactId is REQUIRED — no Contact means no reminders, and
 * createAppointment's 10-minute dedupe guard degrades to nothing (it keys on
 * conversationId|contactId), so duplicate bookings become possible. A Contact also
 * carries the opt-out flags, which is where consent lives.
 *
 * COMPLIANCE WALL (deliberate, matches lead-engine.service.ts / partner-crm.ts /
 * public.ts / gmb-evaluation.service.ts): a Contact born here is opted OUT of voice.
 * createContact() defaults optedOutVoice=false (opted IN) — booking a slot is consent
 * to THAT appointment, not blanket consent to be auto-dialed. The hero rule
 * (CTA-no-book → AI call) must never dial someone who never agreed to a call, so the
 * default stays closed until an explicit consent checkbox is captured on the CTA.
 * SMS follows the same rule, opened only by an explicit smsConsent (the precedent is
 * Appointment.smsConsentAt on the public booking page).
 */
export async function bookFromWebinar(input: {
  joinToken: string
  startAt: string
  endAt: string
  timezone: string
  notes?: string | undefined
  smsConsent?: boolean | undefined
  voiceConsent?: boolean | undefined
}) {
  const reg = await prisma.registrant.findUnique({
    where:  { joinToken: input.joinToken },
    select: { personId: true, webinarId: true, sessionId: true, tenantId: true, name: true, email: true, phone: true },
  })
  if (!reg) throw new AppError('NOT_FOUND', 'Registration not found', 404)

  // Same wall + consent path as registration (usually a no-op here — the Contact
  // already exists from registration; this also applies any consent ticked at booking).
  const contactId = await ensureContactForPerson({
    tenantId:     reg.tenantId,
    personId:     reg.personId,
    name:         reg.name,
    email:        reg.email,
    phone:        reg.phone,
    voiceConsent: input.voiceConsent,
    smsConsent:   input.smsConsent,
    source:       'webinar-booking',
  })

  const appointment = await createAppointment(reg.tenantId, null, {
    contactId,
    appointmentType: 'Webinar consultation',
    startAt:         input.startAt,
    endAt:           input.endAt,
    timezone:        input.timezone,
    attendeeEmail:   reg.email,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.smsConsent ? { smsConsentAt: new Date() } : {}),
  })

  // traceId keys on the appointment so a retried booking can't double-count the
  // score (createAppointment's own dedupe returns the same row within 10 min).
  await appendEvent({
    personId:  reg.personId,
    tenantId:  reg.tenantId,
    type:      'BOOKED',
    source:    'WEBINAR',
    webinarId: reg.webinarId,
    sessionId: reg.sessionId,
    meta:      { appointmentId: appointment.id },
    traceId:   `webinar:booked:${appointment.id}`,
  })

  return { appointmentId: appointment.id, contactId }
}
