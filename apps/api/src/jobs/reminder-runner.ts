/**
 * Phase E.6 — Appointment reminder runner.
 *
 * Polls AppointmentReminder rows where status=PENDING and scheduledAt <= now,
 * then dispatches each through email or SMS. Mirrors the campaign-scheduler
 * pattern: single setInterval, sequential dispatch (rate-friendly to Twilio +
 * Gmail), failures recorded on the row with a retry counter.
 *
 * Separate from the campaign-scheduler because reminders are configured
 * tenant-wide (BusinessProfile) instead of per-campaign, and we want them
 * to fire even when no campaign has been set up.
 */
import { dispatchDueReminders } from '../services/reminder.service.js'

const POLL_INTERVAL_MS = 60_000  // 1 minute — minute-level accuracy is plenty for "1h before"

async function runTick(): Promise<void> {
  const result = await dispatchDueReminders()
  if (result.dispatched > 0 || result.failed > 0) {
    console.log(`[reminder-runner] dispatched=${result.dispatched} failed=${result.failed}`)
  }
}

export function startReminderRunner(): ReturnType<typeof setInterval> {
  // Fire once at startup so any backlog from a restart flushes immediately
  runTick().catch(err => console.error('[reminder-runner] startup tick failed:', err))

  return setInterval(() => {
    runTick().catch(err => console.error('[reminder-runner] scheduled tick failed:', err))
  }, POLL_INTERVAL_MS)
}
