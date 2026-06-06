import { prisma } from '../lib/prisma.js'

/**
 * MyOrbis Account Hub sync (Phase 1a) — best-effort, NON-FATAL.
 *
 * On new-tenant signup, mirror the tenant's identity into the parent-brand
 * Account Hub (canonical id == Voice tenant id). Purely additive: if the Hub is
 * unconfigured or unreachable, this no-ops/logs and Voice signup is unaffected.
 *
 * Entitlement/billing reconciliation is owned by a later phase (Stripe → Hub);
 * here we push a baseline VOICE entitlement reflecting the tenant's free/trial
 * state at signup. Never throws.
 */
const HUB_URL = process.env.HUB_URL
const HUB_TOKEN = process.env.HUB_SERVICE_TOKEN

async function hubPut(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${HUB_URL}${path}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${HUB_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`hub PUT ${path} -> ${res.status}`)
}

export async function syncTenantToHub(tenantId: string): Promise<void> {
  if (!HUB_URL || !HUB_TOKEN) return // Hub integration not configured — skip silently
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { businessProfile: true, stripeCustomerRef: true },
    })
    if (!tenant) return

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

    await hubPut(`/v1/tenants/${tenant.id}/entitlements/VOICE`, {
      plan: 'FREE',
      status: tenant.status === 'ACTIVE' ? 'ACTIVE' : 'TRIALING',
    })

    if (tenant.stripeCustomerRef?.stripeCustomerId) {
      await hubPut(`/v1/tenants/${tenant.id}/stripe-customer`, {
        stripeCustomerId: tenant.stripeCustomerRef.stripeCustomerId,
      })
    }
  } catch (err) {
    console.warn('[hub-sync] tenant sync failed (non-fatal):', tenantId, (err as Error).message)
  }
}
