/**
 * Real-time monitor for live partner Stripe Connect onboarding.
 *
 * When a real partner is recruited (launch-blocker #3) and going through
 * the live Connect Express onboarding, this script tails the API logs +
 * polls the partner's AffiliateAccount state every 3 seconds and reports
 * the onboarding progression as it happens. Catches problems live so the
 * partner doesn't sit confused on a Stripe page.
 *
 * Usage:
 *   pnpm watch-partner-onboarding <partner-email>
 *
 * Reports:
 *   - Pre-flight state: AffiliateAccount status, stripeConnectAccountId
 *     existence, current connect cache (payoutsEnabled / detailsSubmitted)
 *   - Live progression: every state change announced with timestamp
 *   - Live API logs: every /api/affiliate/connect/* request piped through
 *
 * Stops on:
 *   - payoutsEnabled flips to true → "✅ ONBOARDED" + duration
 *   - 30 minutes elapsed → timeout warning
 *   - Ctrl+C
 */

import { spawn } from 'node:child_process'

const PROD_HOST = process.env['PROD_SSH_HOST'] ?? '147.93.183.4'
const SSH_USER  = 'root'

function runSsh(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('ssh', [`${SSH_USER}@${PROD_HOST}`, cmd])
    let out = '', err = ''
    p.stdout.on('data', d => { out += d.toString() })
    p.stderr.on('data', d => { err += d.toString() })
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || out.trim())))
  })
}

interface PartnerSnapshot {
  email:                string
  affiliateId:          string | null
  status:               string | null
  stripeConnectAccountId: string | null
  payoutsEnabled:       boolean
  detailsSubmitted:     boolean
  chargesEnabled:       boolean
  disabledReason:       string | null
}

async function fetchSnapshot(email: string): Promise<PartnerSnapshot | null> {
  const sql = `
    SELECT
      u.email,
      aa.id::text                                    AS affiliate_id,
      aa.status::text                                AS status,
      aa."stripeConnectAccountId"                    AS stripe_id,
      aa."payoutMethodJson"::text                    AS payout_meta
    FROM "User" u
    LEFT JOIN "AffiliateAccount" aa ON aa."userId" = u.id
    WHERE u.email = '${email.replace(/'/g, "''")}'
  `.replace(/\s+/g, ' ').trim()

  const out = await runSsh(`docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation -A -F '|' -t -c "${sql.replace(/"/g, '\\"')}"`).catch(() => '')
  if (!out) return null
  const [emailVal, affiliateId, status, stripeId, payoutMeta] = out.split('|')
  let cache: Record<string, unknown> = {}
  try { cache = payoutMeta ? JSON.parse(payoutMeta) : {} } catch { /* ignore */ }
  return {
    email:                  emailVal!,
    affiliateId:            affiliateId || null,
    status:                 status || null,
    stripeConnectAccountId: stripeId || null,
    payoutsEnabled:         cache['payoutsEnabled']   === true,
    detailsSubmitted:       cache['detailsSubmitted'] === true,
    chargesEnabled:         cache['chargesEnabled']   === true,
    disabledReason:        (cache['disabledReason']  as string | null) ?? null,
  }
}

function renderState(s: PartnerSnapshot): string {
  if (!s.affiliateId)                   return 'no AffiliateAccount yet (partner needs to apply)'
  if (s.status !== 'ACTIVE')            return `partner status = ${s.status} (admin needs to approve before Connect button works)`
  if (!s.stripeConnectAccountId)        return 'no Stripe Connect account yet (partner has not clicked Connect now)'
  if (!s.detailsSubmitted)              return 'Stripe Connect form started but not submitted (partner is mid-onboarding)'
  if (s.detailsSubmitted && !s.payoutsEnabled) return `details submitted, awaiting Stripe verification (disabled_reason: ${s.disabledReason ?? 'none'})`
  if (s.payoutsEnabled)                 return '✅ ONBOARDED — payouts enabled'
  return 'unknown state'
}

function diff(prev: PartnerSnapshot, next: PartnerSnapshot): string[] {
  const changes: string[] = []
  if (prev.status !== next.status)                 changes.push(`status: ${prev.status} → ${next.status}`)
  if (prev.stripeConnectAccountId !== next.stripeConnectAccountId) changes.push(`stripeConnectAccountId: ${prev.stripeConnectAccountId} → ${next.stripeConnectAccountId}`)
  if (prev.detailsSubmitted !== next.detailsSubmitted) changes.push(`detailsSubmitted: ${prev.detailsSubmitted} → ${next.detailsSubmitted}`)
  if (prev.payoutsEnabled !== next.payoutsEnabled) changes.push(`payoutsEnabled: ${prev.payoutsEnabled} → ${next.payoutsEnabled}`)
  if (prev.chargesEnabled !== next.chargesEnabled) changes.push(`chargesEnabled: ${prev.chargesEnabled} → ${next.chargesEnabled}`)
  if (prev.disabledReason !== next.disabledReason) changes.push(`disabledReason: ${prev.disabledReason ?? 'null'} → ${next.disabledReason ?? 'null'}`)
  return changes
}

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: pnpm watch-partner-onboarding <partner-email>')
    process.exit(1)
  }

  const startedAt = Date.now()
  console.log(`Watching ${email}'s onboarding progression…`)
  console.log(`Started: ${new Date(startedAt).toISOString()}`)
  console.log()

  let prev = await fetchSnapshot(email)
  if (!prev) {
    console.error(`No User found for ${email}. They need to sign up at /partner-portal/signup first.`)
    process.exit(1)
  }
  console.log(`Initial state: ${renderState(prev)}`)
  console.log(`  affiliateId:  ${prev.affiliateId ?? '—'}`)
  console.log(`  stripeAcctId: ${prev.stripeConnectAccountId ?? '—'}`)
  console.log()

  // Tail API logs in background
  const tail = spawn('ssh', [`${SSH_USER}@${PROD_HOST}`, 'docker logs -f myorbisvoice-api --tail=0 2>&1'])
  tail.stdout.on('data', d => {
    const line = d.toString()
    if (/affiliate.connect|affiliate.deleted|partner\./i.test(line)) {
      process.stdout.write(`\x1b[90m[api log] ${line}\x1b[0m`)
    }
  })

  // Poll every 3s
  const interval = setInterval(async () => {
    const next = await fetchSnapshot(email)
    if (!next) return
    const changes = diff(prev!, next)
    if (changes.length > 0) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      console.log(`[+${elapsed}s] state change:`)
      for (const c of changes) console.log(`   ${c}`)
      console.log(`   → ${renderState(next)}`)
      console.log()
      if (next.payoutsEnabled) {
        console.log(`\x1b[32mDONE — partner fully onboarded in ${elapsed}s.\x1b[0m`)
        clearInterval(interval)
        tail.kill()
        process.exit(0)
      }
    }
    prev = next
    if (Date.now() - startedAt > 30 * 60 * 1000) {
      console.log(`\x1b[33mTimeout — 30 minutes with no completion. Either the partner abandoned, or check Stripe Dashboard for their account state.\x1b[0m`)
      clearInterval(interval)
      tail.kill()
      process.exit(2)
    }
  }, 3000)
}

main().catch(err => { console.error(err); process.exit(1) })
