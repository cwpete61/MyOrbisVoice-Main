import { prisma } from '../lib/prisma.js'

export async function syncEntitlementsFromPlan(tenantId: string, planId: string): Promise<void> {
  const entitlements = await prisma.planEntitlement.findMany({ where: { planId } })

  await prisma.$transaction(
    entitlements.map((e) =>
      prisma.tenantEntitlement.upsert({
        where: { tenantId_key: { tenantId, key: e.key } },
        create: {
          tenantId,
          key: e.key,
          valueType: e.valueType,
          booleanValue: e.booleanValue,
          integerValue: e.integerValue,
          stringValue: e.stringValue,
          sourceType: 'PLAN',
          sourceRef: planId,
        },
        update: {
          valueType: e.valueType,
          booleanValue: e.booleanValue,
          integerValue: e.integerValue,
          stringValue: e.stringValue,
          sourceType: 'PLAN',
          sourceRef: planId,
        },
      }),
    ),
  )
}

export async function getEffectiveEntitlements(tenantId: string) {
  const rows = await prisma.tenantEntitlement.findMany({ where: { tenantId } })
  const result: Record<string, boolean | number | string | null> = {}
  for (const row of rows) {
    if (row.valueType === 'BOOLEAN') result[row.key] = row.booleanValue ?? false
    else if (row.valueType === 'INTEGER') result[row.key] = row.integerValue ?? 0
    else result[row.key] = row.stringValue ?? null
  }
  return result
}

export async function checkEntitlement(
  tenantId: string,
  key: string,
): Promise<boolean | number | string | null> {
  const row = await prisma.tenantEntitlement.findUnique({
    where: { tenantId_key: { tenantId, key } },
  })
  if (!row) return null
  if (row.valueType === 'BOOLEAN') return row.booleanValue ?? false
  if (row.valueType === 'INTEGER') return row.integerValue ?? 0
  return row.stringValue ?? null
}
