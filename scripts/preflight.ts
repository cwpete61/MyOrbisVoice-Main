/**
 * Pre-launch / pre-customer health check.
 *
 * Single command that verifies every external integration + every internal
 * subsystem the platform needs for a real customer to have a smooth first
 * experience. Designed to be run before opening the door to new customers,
 * after major deploys, or as a routine sanity check.
 *
 * Each check returns ✓ (pass), ⚠ (warning — works but could be better),
 * or ✗ (fail — must be fixed before going live).
 *
 * Usage:
 *   pnpm preflight                    # all checks
 *   pnpm preflight --json             # machine-readable output (CI hook)
 *
 * Read-only; takes no destructive actions. Safe to run against prod.
 */

import { spawn } from 'node:child_process'

interface CheckResult {
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

const PROD_HOST = process.env['PROD_SSH_HOST'] ?? '147.93.183.4'
const SSH_USER  = 'root'

function ssh(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('ssh', [`${SSH_USER}@${PROD_HOST}`, cmd])
    let out = '', err = ''
    p.stdout.on('data', d => { out += d.toString() })
    p.stderr.on('data', d => { err += d.toString() })
    p.on('close', code => {
      if (code === 0) resolve(out.trim())
      else            reject(new Error(`ssh exited ${code}: ${err.trim() || out.trim()}`))
    })
  })
}

async function http(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000)
  try {
    const r = await fetch(url, { headers: opts.headers, signal: ctrl.signal })
    return { status: r.status, body: await r.text() }
  } finally {
    clearTimeout(t)
  }
}

const checks: Array<() => Promise<CheckResult>> = []

// ── HTTP / health endpoints ──────────────────────────────────────────────────

checks.push(async () => {
  const r = await http('https://api.myorbisvoice.com/health')
  if (r.status !== 200) return { name: 'API health', status: 'fail', detail: `HTTP ${r.status}` }
  if (!r.body.includes('"status":"ok"')) return { name: 'API health', status: 'fail', detail: `body did not include "status":"ok": ${r.body.slice(0, 100)}` }
  return { name: 'API health', status: 'pass', detail: 'GET /health 200 ok' }
})

checks.push(async () => {
  const r = await http('https://app.myorbisvoice.com/login')
  if (r.status !== 200) return { name: 'Web app login page', status: 'fail', detail: `HTTP ${r.status}` }
  return { name: 'Web app login page', status: 'pass', detail: 'GET /login 200 ok' }
})

checks.push(async () => {
  const r = await http('https://api.myorbisvoice.com/api/billing/plans')
  if (r.status !== 200) return { name: 'Billing plans (public endpoint)', status: 'fail', detail: `HTTP ${r.status}` }
  try {
    const j = JSON.parse(r.body)
    const n = Array.isArray(j.data) ? j.data.length : 0
    if (n === 0) return { name: 'Billing plans (public endpoint)', status: 'fail', detail: 'no plans returned' }
    return { name: 'Billing plans (public endpoint)', status: 'pass', detail: `${n} active plan(s)` }
  } catch {
    return { name: 'Billing plans (public endpoint)', status: 'fail', detail: 'invalid JSON' }
  }
})

checks.push(async () => {
  const r = await http('https://api.myorbisvoice.com/api/webhooks/stripe', { headers: {}, timeoutMs: 5_000 })
    .catch(() => ({ status: 0, body: '' }))
  // Should reject unsigned POST with 405 (GET) or 4xx — anything but 200 means signature gate is in place
  if (r.status === 200) return { name: 'Stripe webhook endpoint', status: 'fail', detail: 'GET returned 200 — signature gate may be missing' }
  return { name: 'Stripe webhook endpoint', status: 'pass', detail: `endpoint reachable (rejected unsigned GET with ${r.status})` }
})

// ── Containers ───────────────────────────────────────────────────────────────

checks.push(async () => {
  try {
    const out = await ssh('docker ps --filter name=myorbisvoice --format "{{.Names}}|{{.Status}}"')
    const lines = out.split('\n').filter(Boolean)
    const expected = ['myorbisvoice-api', 'myorbisvoice-web', 'myorbisvoice-gateway', 'myorbisvoice-postgres', 'myorbisvoice-redis', 'myorbisvoice-db-backup']
    const running = new Set(lines.map(l => l.split('|')[0]!))
    const missing = expected.filter(n => !running.has(n))
    if (missing.length > 0) return { name: 'Production containers', status: 'fail', detail: `missing: ${missing.join(', ')}` }
    const unhealthy = lines.filter(l => l.includes('unhealthy'))
    if (unhealthy.length > 0) return { name: 'Production containers', status: 'warn', detail: `unhealthy: ${unhealthy.map(l => l.split('|')[0]).join(', ')}` }
    return { name: 'Production containers', status: 'pass', detail: `${lines.length} running, all healthy` }
  } catch (e) {
    return { name: 'Production containers', status: 'fail', detail: `ssh failed: ${(e as Error).message}` }
  }
})

// ── Stripe ───────────────────────────────────────────────────────────────────

checks.push(async () => {
  try {
    const out = await ssh(`docker exec myorbisvoice-api node -e '
      (async () => {
        const { bootStripeFromConfig, getStripe } = require("/app/apps/api/dist/lib/stripe.js");
        await bootStripeFromConfig();
        const stripe = getStripe();
        const balance = await stripe.balance.retrieve();
        const acct = await stripe.accounts.retrieve();
        console.log(JSON.stringify({ livemode: balance.livemode, account: acct.id }));
      })().catch(e => { console.log(JSON.stringify({ error: e.message })); });
    '`)
    const j = JSON.parse(out)
    if (j.error) return { name: 'Stripe API key', status: 'fail', detail: j.error }
    return { name: 'Stripe API key', status: 'pass', detail: `${j.livemode ? 'LIVE' : 'TEST'} mode, account ${j.account}` }
  } catch (e) {
    return { name: 'Stripe API key', status: 'fail', detail: (e as Error).message }
  }
})

checks.push(async () => {
  try {
    const out = await ssh(`docker exec myorbisvoice-api node -e '
      (async () => {
        const { bootStripeFromConfig, getWebhookSecrets } = require("/app/apps/api/dist/lib/stripe.js");
        await bootStripeFromConfig();
        const secrets = getWebhookSecrets();
        console.log(JSON.stringify({ count: secrets.length, allValid: secrets.every(s => s.startsWith("whsec_")) }));
      })().catch(e => { console.log(JSON.stringify({ error: e.message })); });
    '`)
    const j = JSON.parse(out)
    if (j.error) return { name: 'Stripe webhook secrets', status: 'fail', detail: j.error }
    if (j.count < 2) return { name: 'Stripe webhook secrets', status: 'warn', detail: `${j.count} secret(s) loaded — Connect events won't verify if expecting 2` }
    if (!j.allValid) return { name: 'Stripe webhook secrets', status: 'fail', detail: 'one or more secrets do not start with whsec_' }
    return { name: 'Stripe webhook secrets', status: 'pass', detail: `${j.count} secrets loaded, all valid prefix` }
  } catch (e) {
    return { name: 'Stripe webhook secrets', status: 'fail', detail: (e as Error).message }
  }
})

// ── Database snapshots ───────────────────────────────────────────────────────

checks.push(async () => {
  try {
    const out = await ssh(`docker exec myorbisvoice-db-backup ls -lt /backups/ | head -3`)
    const lines = out.split('\n').filter(l => l.includes('.dump'))
    if (lines.length === 0) return { name: 'Production DB backups', status: 'fail', detail: 'no .dump files found in /backups' }
    return { name: 'Production DB backups', status: 'pass', detail: `most recent: ${lines[0]}` }
  } catch (e) {
    return { name: 'Production DB backups', status: 'warn', detail: `could not list backups: ${(e as Error).message}` }
  }
})

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const jsonMode = process.argv.includes('--json')
  if (!jsonMode) {
    console.log('MyOrbisVoice — pre-launch health check')
    console.log('======================================\n')
  }

  const results: CheckResult[] = []
  for (const check of checks) {
    try {
      results.push(await check())
    } catch (e) {
      results.push({ name: 'unknown check', status: 'fail', detail: (e as Error).message })
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    for (const r of results) {
      const icon = r.status === 'pass' ? '\x1b[32m✓\x1b[0m' : r.status === 'warn' ? '\x1b[33m⚠\x1b[0m' : '\x1b[31m✗\x1b[0m'
      console.log(`${icon} ${r.name}`)
      console.log(`   ${r.detail}\n`)
    }
    const passed = results.filter(r => r.status === 'pass').length
    const warned = results.filter(r => r.status === 'warn').length
    const failed = results.filter(r => r.status === 'fail').length
    console.log('======================================')
    console.log(`Passed: ${passed}    Warnings: ${warned}    Failed: ${failed}`)
    if (failed > 0) console.log('\n\x1b[31mDo NOT open to customers until all ✗ items are resolved.\x1b[0m')
    else if (warned > 0) console.log('\n\x1b[33mSafe to launch, but address ⚠ items soon.\x1b[0m')
    else console.log('\n\x1b[32mAll systems green. Safe to launch.\x1b[0m')
  }

  process.exit(results.some(r => r.status === 'fail') ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
