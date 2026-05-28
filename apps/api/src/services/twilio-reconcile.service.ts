/**
 * Phase 4 — Twilio ↔ DB reconciliation worker.
 *
 * Catches drift between Twilio's truth (which subaccount actually owns a
 * number) and our DB (`PhoneNumber.twilioSubaccountSid`). Drift can happen
 * when:
 *   - Phase 2 transfer succeeds at Twilio but the DB transaction fails
 *     (orphaned-but-correct-on-Twilio state)
 *   - Manual moves via the Twilio console without going through our UI
 *   - Twilio account-level support actions
 *
 * Strategy: enumerate our DB rows that have a `twilioNumberSid`, fetch each
 * one's live state from Twilio, compare `accountSid`. Polite throttle keeps
 * us off Twilio's rate-limit radar.
 *
 * v1 policy: DETECT + LOG ONLY. We don't auto-fix because:
 *   - If our DB lost an update, fixing the DB to match Twilio is usually
 *     right, BUT we don't know if the tenantId/partnerId should also swap
 *     — that requires the same identity-lookup logic transfer uses, and
 *     could mis-route a number to the wrong owner.
 *   - Operator intervention via audit log review is safer.
 *
 * v2 (future): admin button on a drifted row → resolve via the same
 * transferNumber() path.
 */

import { prisma } from '../lib/prisma.js'
import { getTwilioClient } from './twilio.service.js'

export interface ReconcileDrift {
  phoneNumberId: string
  e164Number: string
  twilioNumberSid: string
  /** What our DB thinks the owning subaccount SID is. */
  dbSubaccountSid: string | null
  /** What Twilio reports as the owning subaccount SID right now. */
  twilioSubaccountSid: string
  /** True when the number is missing from Twilio entirely (released?
   *  expired?). DB still has it but Twilio doesn't. */
  missingOnTwilio: boolean
}

export interface ReconcileResult {
  checkedCount: number
  /** Rows where DB and Twilio disagree. */
  drifts: ReconcileDrift[]
  /** Rows we couldn't check (Twilio API error, missing SID, etc.). */
  errors: Array<{ phoneNumberId: string; e164Number: string; message: string }>
  durationMs: number
}

const FETCH_DELAY_MS = 75 // polite spacing per Twilio call

export async function reconcileTwilioNumbers(opts?: {
  /** Limit how many DB rows to walk in one tick. Null = all of them. */
  limit?: number
}): Promise<ReconcileResult> {
  const started = Date.now()
  const drifts: ReconcileDrift[] = []
  const errors: ReconcileResult['errors'] = []

  const rows = await prisma.phoneNumber.findMany({
    where: {
      purchaseStatus: 'PURCHASED',
      twilioNumberSid: { not: null },
    },
    select: {
      id: true,
      e164Number: true,
      twilioNumberSid: true,
      twilioSubaccountSid: true,
    },
    take: opts?.limit ?? undefined,
    orderBy: { createdAt: 'asc' },
  })

  const masterClient = await getTwilioClient('live')
  // Per the PhoneNumber.twilioSubaccountSid schema comment, a NULL value means
  // "the number lives on the master account" (no subaccount provisioned). So
  // the expected owner for a null-db row is the master account SID — comparing
  // against null would flag every master-account number as drift forever.
  const masterAccountSid = masterClient.accountSid

  for (const row of rows) {
    if (!row.twilioNumberSid) continue
    try {
      // Twilio's IncomingPhoneNumberContext().fetch() returns the live
      // accountSid that owns the number — even if it's on a subaccount the
      // master client can read it because subaccounts share the parent.
      const live = await masterClient.incomingPhoneNumbers(row.twilioNumberSid).fetch()
      const liveAccountSid = live.accountSid
      const expectedSid = row.twilioSubaccountSid ?? masterAccountSid
      if (!liveAccountSid) {
        errors.push({
          phoneNumberId: row.id,
          e164Number: row.e164Number,
          message: 'Twilio returned no accountSid',
        })
      } else if (liveAccountSid !== expectedSid) {
        drifts.push({
          phoneNumberId: row.id,
          e164Number: row.e164Number,
          twilioNumberSid: row.twilioNumberSid,
          dbSubaccountSid: row.twilioSubaccountSid,
          twilioSubaccountSid: liveAccountSid,
          missingOnTwilio: false,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch error'
      // Twilio returns 404 when the number has been released. Treat that
      // as "missing on Twilio" drift so the audit surfaces it.
      if (/not\s*found|404|20404/i.test(msg)) {
        drifts.push({
          phoneNumberId: row.id,
          e164Number: row.e164Number,
          twilioNumberSid: row.twilioNumberSid,
          dbSubaccountSid: row.twilioSubaccountSid,
          twilioSubaccountSid: '',
          missingOnTwilio: true,
        })
      } else {
        errors.push({
          phoneNumberId: row.id,
          e164Number: row.e164Number,
          message: msg.slice(0, 200),
        })
      }
    }
    await sleep(FETCH_DELAY_MS)
  }

  // Audit log each drift so operators get a paper trail.
  for (const d of drifts) {
    try {
      await prisma.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          action: 'twilio.number.drift_detected',
          targetType: 'PhoneNumber',
          targetId: d.phoneNumberId,
          metadataJson: {
            e164: d.e164Number,
            twilioNumberSid: d.twilioNumberSid,
            dbSubaccountSid: d.dbSubaccountSid,
            twilioSubaccountSid: d.twilioSubaccountSid,
            missingOnTwilio: d.missingOnTwilio,
          },
        },
      })
    } catch {
      // Audit failures don't break the loop.
    }
  }

  return {
    checkedCount: rows.length,
    drifts,
    errors,
    durationMs: Date.now() - started,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Worker — setInterval, runs once per WORKER_INTERVAL_MS ──────────────

const WORKER_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
let timer: NodeJS.Timeout | null = null
let ticking = false

export function startTwilioReconcileWorker(): void {
  if (timer) return
  console.log(`[twilio-reconcile] starting, tick = ${WORKER_INTERVAL_MS}ms`)
  timer = setInterval(() => {
    void runTick()
  }, WORKER_INTERVAL_MS)
}

export function stopTwilioReconcileWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function runTick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    const result = await reconcileTwilioNumbers()
    if (result.drifts.length > 0 || result.errors.length > 0) {
      console.warn(
        `[twilio-reconcile] checked=${result.checkedCount} drifts=${result.drifts.length} errors=${result.errors.length} duration=${result.durationMs}ms`,
      )
    }
  } catch (err) {
    console.error('[twilio-reconcile] tick failed', err)
  } finally {
    ticking = false
  }
}
