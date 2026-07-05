/**
 * Periodic reset of the public DEMO sandbox tenant(s) back to the seed, so
 * whatever agents did while exploring is wiped and it stays clean/alive.
 *
 * v1 uses a shared demo tenant, so reset is on an interval (not per-logout —
 * that would yank the rug on a concurrent demo user). Per-session sandboxes with
 * on-logout reset are v2.
 */
import { prisma } from '../lib/prisma.js'
import { resetDemoTenant } from '../services/demo.service.js'

const INTERVAL_MS = 15 * 60 * 1000 // 15 min
let running = false

async function resetAllDemos(): Promise<void> {
  if (running) return
  running = true
  try {
    // ONLY the shared generic sandbox — never per-agent AGENT demos (those hold
    // real prospect DNA + listings and convert to paid accounts; wiping them
    // would destroy a live sales demo).
    const demos = await prisma.tenant.findMany({ where: { isDemo: true, demoKind: 'SANDBOX' }, select: { id: true } })
    for (const t of demos) {
      const owner = await prisma.tenantMember.findFirst({ where: { tenantId: t.id }, select: { userId: true } })
      if (!owner) continue
      try {
        await resetDemoTenant(t.id, owner.userId)
        console.log(`[demo-reset] reset ${t.id}`)
      } catch (e) {
        console.error('[demo-reset] failed', t.id, (e as Error).message)
      }
    }
  } finally {
    running = false
  }
}

export function startDemoResetJob(): void {
  setInterval(() => { resetAllDemos().catch(() => {}) }, INTERVAL_MS)
  console.log('[demo-reset] started (every ' + INTERVAL_MS / 60000 + 'm)')
}
