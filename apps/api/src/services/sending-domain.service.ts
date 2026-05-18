import { prisma } from '../lib/prisma.js'
import { getConfigValue } from './system-config.service.js'
import { createZone, getZone, writeEmailDnsRecords } from './cloudflare.service.js'
import { createDomainIdentity, getDomainIdentity } from './aws-ses.service.js'
import {
  isDomainAvailable,
  getRegistrationPriceUsd,
  registerDomain,
  getOperationStatus,
  setDomainNameservers,
  type RegistrantContact,
} from './route53-domains.service.js'

// Sending-domain orchestration — drives a partner's dedicated cold-email
// domain through provisioning. The flow is a status state machine advanced
// one step per call by a background runner, so every step is idempotent and
// retry-safe:
//
//   PENDING_PAYMENT → REGISTERING → DNS_PENDING → VERIFYING → WARMING → ACTIVE
//
// REGISTERING covers three async sub-steps, disambiguated by which fields are
// set: register the .com (Route 53) → create the Cloudflare zone → point the
// domain's name servers at Cloudflare. registrarOrderRef holds whichever
// Route 53 operation is currently in flight; cloudflareZoneId being set means
// the zone exists and the in-flight op is the name-server update.

/** Warmup ramp — daily cap by day number since warmup started. Gentle ramp
 *  protects the domain's reputation; once it reaches the target the domain
 *  goes ACTIVE. Mirrors the 50/day platform cap in email-bulk-policy. */
const WARMUP_TARGET_CAP = 50
function warmupCapForDay(day: number): number {
  if (day <= 1) return 5
  if (day === 2) return 10
  if (day === 3) return 15
  if (day === 4) return 20
  if (day === 5) return 30
  if (day === 6) return 40
  return WARMUP_TARGET_CAP
}

/** WHOIS registrant contact for Route 53 registration. Address is the
 *  platform's legal entity; phone + email come from SystemConfig and must be
 *  set before any real registration runs. WHOIS privacy hides all of it. */
export async function getRegistrantContact(): Promise<RegistrantContact> {
  const [firstName, lastName, email, phone, org] = await Promise.all([
    getConfigValue('domain_registrant_first_name'),
    getConfigValue('domain_registrant_last_name'),
    getConfigValue('domain_registrant_email'),
    getConfigValue('domain_registrant_phone'),
    getConfigValue('domain_registrant_org'),
  ])
  if (!email || !phone) {
    throw new Error(
      'Domain registrant contact incomplete — set domain_registrant_email and ' +
      'domain_registrant_phone (Route 53 format "+1.5551234567") in system config',
    )
  }
  return {
    firstName: firstName || 'MyOrbisVoice',
    lastName: lastName || 'Admin',
    organizationName: org || 'MyOrbisVoice',
    email,
    phoneNumber: phone,
    addressLine1: '716 Washington St Suite 2',
    city: 'Allentown',
    state: 'PA',
    countryCode: 'US',
    zipCode: '18102',
  }
}

export interface AvailabilityResult {
  domain: string
  available: boolean
  priceUsd: number | null
}

/** Check whether a domain can be registered, and what a .com costs. */
export async function checkAvailability(domain: string): Promise<AvailabilityResult> {
  const normalized = domain.trim().toLowerCase()
  const available = await isDomainAvailable(normalized)
  const priceUsd = available ? await getRegistrationPriceUsd('com') : null
  return { domain: normalized, available, priceUsd }
}

/** Create a draft sending domain in PENDING_PAYMENT. Enforces at most one
 *  non-FAILED domain per partner — a partner can only run one at a time. */
export async function createSendingDomainDraft(partnerId: string, domain: string) {
  const normalized = domain.trim().toLowerCase()
  const existing = await prisma.partnerSendingDomain.findFirst({
    where: { partnerId, status: { not: 'FAILED' } },
  })
  if (existing) {
    throw new Error('This partner already has a sending domain in progress or active')
  }
  return prisma.partnerSendingDomain.create({
    data: { partnerId, domain: normalized, status: 'PENDING_PAYMENT' },
  })
}

/** Mark a draft paid and release it into provisioning (→ REGISTERING). */
export async function markPaid(domainId: string, paymentIntentId: string, priceCents: number) {
  return prisma.partnerSendingDomain.update({
    where: { id: domainId },
    data: {
      status: 'REGISTERING',
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
      priceCents,
      lastError: null,
    },
  })
}

/** The partner's most recent sending domain, whatever its status — a FAILED
 *  row stays visible so a partner who paid always sees what happened. The
 *  "one active per partner" guard lives in createSendingDomainDraft, not here. */
export async function getPartnerSendingDomain(partnerId: string) {
  return prisma.partnerSendingDomain.findFirst({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
  })
}

/** Delete a partner's unpaid draft so they can start over with a different
 *  name. Only PENDING_PAYMENT rows can be cancelled — once paid, the
 *  registration is irreversible. */
export async function cancelSendingDomainDraft(partnerId: string): Promise<void> {
  const draft = await prisma.partnerSendingDomain.findFirst({
    where: { partnerId, status: 'PENDING_PAYMENT' },
  })
  if (!draft) throw new Error('No unpaid sending domain draft to cancel')
  await prisma.partnerSendingDomain.delete({ where: { id: draft.id } })
}

/** Domains mid-provisioning — the runner advances each of these per tick. */
export async function listInFlightDomains() {
  return prisma.partnerSendingDomain.findMany({
    where: { status: { in: ['REGISTERING', 'DNS_PENDING', 'VERIFYING', 'WARMING'] } },
  })
}

/** Advance one sending domain by a single state-machine step. Idempotent and
 *  retry-safe: transient errors are recorded in lastError and left for the
 *  next tick; only definitive registrar failures move the row to FAILED. */
export async function advanceProvisioning(domainId: string): Promise<void> {
  const d = await prisma.partnerSendingDomain.findUnique({ where: { id: domainId } })
  if (!d) return

  try {
    switch (d.status) {
      case 'REGISTERING':
        await stepRegistering(d)
        break
      case 'DNS_PENDING':
        await stepDnsPending(d)
        break
      case 'VERIFYING':
        await stepVerifying(d)
        break
      case 'WARMING':
        await stepWarming(d)
        break
      default:
        break
    }
  } catch (err) {
    // Transient — record it, leave status alone so the next tick retries.
    await prisma.partnerSendingDomain.update({
      where: { id: domainId },
      data: { lastError: err instanceof Error ? err.message : String(err) },
    })
  }
}

type SendingDomain = NonNullable<Awaited<ReturnType<typeof prisma.partnerSendingDomain.findUnique>>>

async function fail(id: string, message: string): Promise<void> {
  await prisma.partnerSendingDomain.update({
    where: { id },
    data: { status: 'FAILED', lastError: message },
  })
}

async function stepRegistering(d: SendingDomain): Promise<void> {
  // Sub-step 1: no zone, no in-flight op → kick off domain registration.
  if (!d.cloudflareZoneId && !d.registrarOrderRef) {
    const contact = await getRegistrantContact()
    const operationId = await registerDomain(d.domain, contact)
    await prisma.partnerSendingDomain.update({
      where: { id: d.id },
      data: { registrarOrderRef: operationId, lastError: null },
    })
    return
  }

  // Sub-step 2: no zone yet, registration op in flight → poll it.
  if (!d.cloudflareZoneId && d.registrarOrderRef) {
    const op = await getOperationStatus(d.registrarOrderRef)
    if (op.status === 'ERROR' || op.status === 'FAILED') {
      await fail(d.id, `Domain registration failed: ${op.message ?? op.status}`)
      return
    }
    if (op.status !== 'SUCCESSFUL') return // still registering

    // Registered — create the Cloudflare zone, then point name servers at it.
    const zone = await createZone(d.domain)
    const nsOperationId = await setDomainNameservers(d.domain, zone.nameServers)
    await prisma.partnerSendingDomain.update({
      where: { id: d.id },
      data: { cloudflareZoneId: zone.id, registrarOrderRef: nsOperationId, lastError: null },
    })
    return
  }

  // Sub-step 3: zone exists, name-server update op in flight → poll it.
  if (d.cloudflareZoneId && d.registrarOrderRef) {
    const op = await getOperationStatus(d.registrarOrderRef)
    if (op.status === 'ERROR' || op.status === 'FAILED') {
      await fail(d.id, `Name-server update failed: ${op.message ?? op.status}`)
      return
    }
    if (op.status !== 'SUCCESSFUL') return // still updating

    await prisma.partnerSendingDomain.update({
      where: { id: d.id },
      data: { status: 'DNS_PENDING', registrarOrderRef: null, lastError: null },
    })
  }
}

async function stepDnsPending(d: SendingDomain): Promise<void> {
  if (!d.cloudflareZoneId) {
    await fail(d.id, 'Reached DNS step with no Cloudflare zone')
    return
  }
  // Create the SES domain identity (idempotent) and write SPF/DKIM/DMARC.
  const identity = await createDomainIdentity(d.domain)
  if (identity.dkimTokens.length === 0) {
    throw new Error('SES returned no DKIM tokens yet')
  }
  await writeEmailDnsRecords(d.cloudflareZoneId, d.domain, identity.dkimTokens)
  await prisma.partnerSendingDomain.update({
    where: { id: d.id },
    data: {
      status: 'VERIFYING',
      sesDkimTokensJson: identity.dkimTokens,
      dnsConfiguredAt: new Date(),
      lastError: null,
    },
  })
}

async function stepVerifying(d: SendingDomain): Promise<void> {
  // Confirm the Cloudflare zone is live, then poll SES for DKIM verification.
  if (d.cloudflareZoneId) {
    const zone = await getZone(d.cloudflareZoneId)
    if (zone.status !== 'active') return // name servers not propagated yet
  }
  const identity = await getDomainIdentity(d.domain)
  if (!identity.verified) {
    if (identity.dkimStatus === 'FAILED') {
      await fail(d.id, 'SES DKIM verification failed')
    }
    return // still verifying
  }
  await prisma.partnerSendingDomain.update({
    where: { id: d.id },
    data: {
      status: 'WARMING',
      verified: true,
      sesVerifiedAt: new Date(),
      warmupStartedAt: new Date(),
      warmupDayCap: warmupCapForDay(1),
      lastError: null,
    },
  })
}

async function stepWarming(d: SendingDomain): Promise<void> {
  const startedAt = d.warmupStartedAt ?? new Date()
  const day = Math.floor((Date.now() - startedAt.getTime()) / 86_400_000) + 1
  const cap = warmupCapForDay(day)

  if (cap >= WARMUP_TARGET_CAP) {
    await prisma.partnerSendingDomain.update({
      where: { id: d.id },
      data: {
        status: 'ACTIVE',
        warmupDayCap: WARMUP_TARGET_CAP,
        warmupCompletedAt: new Date(),
        lastError: null,
      },
    })
    return
  }
  if (cap !== d.warmupDayCap) {
    await prisma.partnerSendingDomain.update({
      where: { id: d.id },
      data: { warmupDayCap: cap },
    })
  }
}
