import { prisma } from '../lib/prisma.js'

// Report Voice affiliate commissions up to the Account Hub's cross-product partner
// ledger so the MyOrbisResults partner home shows one roll-up. Best-effort /
// non-fatal: no-ops when unconfigured, never throws into the commission flow.
const HUB_URL = process.env.HUB_URL
const HUB_SVC = process.env.HUB_SERVICE_TOKEN

// Voice has a HOLD state the ledger doesn't — fold it into PENDING (not yet payable).
const STATUS_MAP: Record<string, string> = { PENDING: 'PENDING', APPROVED: 'APPROVED', HOLD: 'PENDING', PAID: 'PAID', REVERSED: 'REVERSED' }

export async function syncCommissionToHub(commissionId: string): Promise<void> {
  if (!HUB_URL || !HUB_SVC) return
  try {
    const c = await prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
      include: { affiliateConversion: true, affiliateAccount: { include: { user: true } } },
    })
    const email = c?.affiliateAccount?.user?.email
    if (!c || !email) return
    await fetch(`${HUB_URL}/v1/partners/commissions`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${HUB_SVC}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        partnerEmail: email,
        productCode: 'VOICE',
        sourceId: c.id,
        tenantId: c.tenantId,
        amountMinor: c.amountMinor,
        currency: c.currency,
        status: STATUS_MAP[c.status] ?? 'PENDING',
        occurredAt: (c.affiliateConversion?.occurredAt ?? c.createdAt).toISOString(),
        paidAt: c.paidAt ? c.paidAt.toISOString() : undefined,
      }),
    })
  } catch (err) {
    console.warn('[partner-sync] commission sync failed (non-fatal):', commissionId, (err as Error).message)
  }
}

export async function syncCommissionsToHub(ids: string[]): Promise<void> {
  for (const id of ids) await syncCommissionToHub(id)
}
