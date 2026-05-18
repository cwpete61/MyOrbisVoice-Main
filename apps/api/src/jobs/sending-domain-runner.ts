/**
 * Bulk Email — sending-domain provisioning runner.
 *
 * Polls PartnerSendingDomain rows mid-provisioning and advances each by one
 * state-machine step (register → DNS → verify → warm → active). Every step is
 * idempotent, so a missed or repeated tick is harmless. Provisioning is
 * minutes-scale (Route 53 operations, DNS propagation, SES verification), so
 * a 2-minute poll is plenty and gentle on the AWS APIs.
 */
import { listInFlightDomains, advanceProvisioning } from '../services/sending-domain.service.js'

const POLL_INTERVAL_MS = 120_000 // 2 minutes

async function runTick(): Promise<void> {
  const domains = await listInFlightDomains()
  for (const d of domains) {
    await advanceProvisioning(d.id)
  }
  if (domains.length > 0) {
    console.log(`[sending-domain-runner] advanced ${domains.length} domain(s)`)
  }
}

export function startSendingDomainRunner(): ReturnType<typeof setInterval> {
  runTick().catch(err => console.error('[sending-domain-runner] startup tick failed:', err))

  return setInterval(() => {
    runTick().catch(err => console.error('[sending-domain-runner] scheduled tick failed:', err))
  }, POLL_INTERVAL_MS)
}
