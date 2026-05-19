/**
 * Bulk Email — cold-email campaign sequencer runner (Phase 4).
 *
 * Ticks every 5 minutes and advances every ACTIVE campaign's enrolled leads
 * through their touch sequence. Each send goes through sendColdEmail, which
 * enforces the per-partner cap / send window / drip — so the actual send
 * pacing is governed there, not here. A 5-minute tick is plenty: the drip
 * interval already rate-limits sends, and touch delays are measured in days.
 */
import { runSequencerTick } from '../services/cold-email-sequencer.service.js'

const POLL_INTERVAL_MS = 300_000 // 5 minutes

async function tick(): Promise<void> {
  const result = await runSequencerTick()
  if (result.sent > 0 || result.processed > 0) {
    console.log(`[cold-email-sequencer] campaigns=${result.campaigns} processed=${result.processed} sent=${result.sent}`)
  }
}

export function startColdEmailSequencer(): ReturnType<typeof setInterval> {
  tick().catch(err => console.error('[cold-email-sequencer] startup tick failed:', err))

  return setInterval(() => {
    tick().catch(err => console.error('[cold-email-sequencer] scheduled tick failed:', err))
  }, POLL_INTERVAL_MS)
}
