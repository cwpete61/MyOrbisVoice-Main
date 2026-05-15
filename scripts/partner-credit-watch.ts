#!/usr/bin/env tsx
/**
 * Nightly partner-credit watcher.
 *
 * Iterates every partner that has at least one PURCHASE row in the ledger
 * (i.e. ever bought an SMS pack) and computes their financial status. Prints
 * a per-partner summary and exits non-zero when any partner is OVER_BUDGET
 * or trending LOW.
 *
 * Run via cron: `infrastructure/scripts/partner-credit-watch-cron.sh`.
 * Designed to be cheap — a single ledger aggregate per partner.
 *
 * Output:
 *   - Default: per-partner one-line status
 *   - --json:  machine-readable JSON for downstream tooling
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  // Distinct list of partners who've ever purchased a pack.
  const partners = await prisma.$queryRaw<Array<{ partnerId: string }>>`
    SELECT DISTINCT "partnerId"
    FROM "PartnerSmsCreditLedger"
    WHERE "eventType" = 'PURCHASE'
  `

  const { getPartnerFinancials } = await import(
    '../apps/api/src/services/partner-sms-credits.service.js'
  )

  const rows: Array<{
    partnerId:        string
    slug:             string | null
    displayName:      string | null
    email:            string
    purchasedCents:   number
    spentCents:       number
    pendingCostCents: number
    netCents:         number
    status:           string
  }> = []

  for (const { partnerId } of partners) {
    const partner = await prisma.affiliateAccount.findUnique({
      where:  { id: partnerId },
      select: { slug: true, displayName: true, user: { select: { email: true } } },
    })
    if (!partner) continue
    const fin = await getPartnerFinancials(partnerId)
    rows.push({
      partnerId,
      slug:             partner.slug,
      displayName:      partner.displayName,
      email:            partner.user.email,
      purchasedCents:   fin.purchasedCents,
      spentCents:       fin.spentCents,
      pendingCostCents: fin.pendingCostCents,
      netCents:         fin.netCents,
      status:           fin.status,
    })
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2))
  } else {
    console.log('Partner SMS credit watch — ' + new Date().toISOString())
    console.log('═══════════════════════════════════════════════════════')
    if (rows.length === 0) {
      console.log('  (no partners with SMS pack purchases yet)')
    }
    for (const r of rows) {
      const tag =
        r.status === 'OVER_BUDGET' ? '🛑 OVER_BUDGET'
      : r.status === 'LOW'         ? '⚠️  LOW       '
      :                              '✓ HEALTHY    '
      console.log(`  ${tag}  ${r.slug ?? r.partnerId.slice(0, 8)}  paid $${(r.purchasedCents/100).toFixed(2)}  spent $${(r.spentCents/100).toFixed(2)}  net $${(r.netCents/100).toFixed(2)}`)
    }
  }

  const flagged = rows.filter(r => r.status === 'OVER_BUDGET' || r.status === 'LOW').length
  await prisma.$disconnect()
  if (flagged > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(2)
})
