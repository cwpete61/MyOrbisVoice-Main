import { prisma } from '../lib/prisma.js'

/**
 * MyOrbis Account Hub sync — best-effort, NON-FATAL.
 *
 * Mirrors a tenant's identity + current VOICE entitlement + Stripe customer into
 * the parent-brand Account Hub (canonical id == Voice tenant id). Called on
 * signup (Phase 1a) and after any entitlement change (Phase 1b, via
 * syncEntitlementsFromPlan), so the Hub tracks Voice's billing state.
 *
 * Purely additive: no-ops when HUB_URL/HUB_SERVICE_TOKEN are unset; all failures
 * caught + logged; never throws into the caller. Runs outside DB transactions.
 */
const HUB_URL = process.env.HUB_URL
const HUB_TOKEN = process.env.HUB_SERVICE_TOKEN

// Voice plan code -> portfolio plan name.
const PLAN_MAP: Record<string, string> = {
  free: 'FREE',
  basic_monthly: 'BASIC',
  pro_monthly: 'PRO',
  premier_monthly: 'PREMIER',
  enterprise_monthly: 'ENTERPRISE',
  ltd: 'LTD',
}
const SUB_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
}

async function hubPut(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${HUB_URL}${path}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${HUB_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`hub PUT ${path} -> ${res.status}`)
}

/** Derive the tenant's current VOICE entitlement from its subscriptions
 *  (active preferred, else most recent), falling back to the free tier. */
async function deriveVoiceEntitlement(tenantId: string, tenantStatus: string) {
  let sub = await prisma.subscription.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  })
  if (!sub) {
    sub = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })
  }
  if (!sub?.plan) {
    return { plan: 'FREE', status: tenantStatus === 'ACTIVE' ? 'ACTIVE' : 'TRIALING' }
  }
  return {
    plan: PLAN_MAP[sub.plan.code] ?? sub.plan.code.toUpperCase(),
    status: SUB_STATUS_MAP[sub.status] ?? 'TRIALING',
  }
}

export async function syncTenantToHub(tenantId: string): Promise<void> {
  if (!HUB_URL || !HUB_TOKEN) return // Hub integration not configured — skip silently
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { businessProfile: true, stripeCustomerRef: true },
    })
    if (!tenant) return
    // Skip test/automation tenants (deploy smoke signups etc.) — don't pollute the Hub.
    if (/(@orbisvoice\.test$)|(\.test$)|(^e2e-)/i.test(tenant.registrationEmail ?? '')) return

    await hubPut(`/v1/tenants/${tenant.id}`, {
      slug: tenant.slug,
      status: tenant.status,
      profile: {
        legalName: tenant.legalName ?? tenant.displayName ?? undefined,
        dbaName: tenant.displayName ?? undefined,
        email: tenant.publicEmail ?? tenant.registrationEmail ?? undefined,
        phone: tenant.publicPhone ?? undefined,
        website: tenant.website ?? undefined,
        timezone: tenant.timezone ?? undefined,
      },
    })

    const ent = await deriveVoiceEntitlement(tenant.id, tenant.status)
    await hubPut(`/v1/tenants/${tenant.id}/entitlements/VOICE`, ent)

    if (tenant.stripeCustomerRef?.stripeCustomerId) {
      await hubPut(`/v1/tenants/${tenant.id}/stripe-customer`, {
        stripeCustomerId: tenant.stripeCustomerRef.stripeCustomerId,
      })
    }
  } catch (err) {
    console.warn('[hub-sync] tenant sync failed (non-fatal):', tenantId, (err as Error).message)
  }
}

/** Mirror a Voice affiliate into the Hub Partner table so the parent storefront
 *  (which checks the Hub, not the Voice AffiliateAccount) recognizes them as a
 *  partner. Without this a new affiliate lands in the tenant dashboard. Best-effort:
 *  no-ops when the Hub is unconfigured; never throws into the signup path. */
export async function syncPartnerToHub(userId: string): Promise<void> {
  if (!HUB_URL || !HUB_TOKEN) return
  try {
    const acct = await prisma.affiliateAccount.findFirst({
      where: { userId },
      select: { id: true, slug: true, status: true, user: { select: { email: true } } },
    })
    if (!acct?.user?.email) return
    await hubPut('/v1/partners', {
      email: acct.user.email.toLowerCase(),
      voiceAffiliateId: acct.id,
      ...(acct.slug ? { slug: acct.slug } : {}),
      status: acct.status,
    })
  } catch (e) {
    console.warn('[hub-sync] partner sync failed (non-fatal):', (e as Error).message)
  }
}
