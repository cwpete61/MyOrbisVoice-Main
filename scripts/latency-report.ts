/**
 * Voice agent latency report.
 *
 * Reads Conversation.metadataJson.latency entries (populated by the
 * voice gateway's per-turn telemetry shipped 2026-05-05) and produces
 * a distribution + per-call breakdown so we can decide whether VAD /
 * prompt-size tuning is worth investing in.
 *
 * Usage (from repo root, against prod via SSH):
 *   pnpm latency-report                          # all calls with telemetry
 *   pnpm latency-report --since 7d               # last 7 days
 *   pnpm latency-report --tenant <tenantId>      # one tenant only
 *   pnpm latency-report --json                   # machine-readable
 *
 * Reports:
 *   - Total turns measured + total calls + median + p95 + max across the
 *     full population
 *   - Per-call breakdown (median, p95, turn count) sorted by p95 worst-first
 *
 * Closes backlog #3 the moment we have ~50 real production calls — this
 * script runs against whatever data exists, will return "no calls
 * measured yet" if telemetry hasn't picked up traffic.
 */

import { spawn } from 'node:child_process'

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
      else            reject(new Error(`ssh exited ${code}: ${err.trim()}`))
    })
  })
}

interface PerCallLatency {
  conversationId: string
  tenantId:       string
  startedAt:      string
  channelType:    string
  turns:          number[]
  count:          number
  min:            number
  max:            number
  median:         number
  p95:            number
}

function parseSince(s?: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d+)([dhm])$/)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  const unit = m[2]
  const ms = unit === 'd' ? n * 86_400_000 : unit === 'h' ? n * 3_600_000 : n * 60_000
  return new Date(Date.now() - ms)
}

async function fetchData(opts: { since?: Date; tenantId?: string }): Promise<PerCallLatency[]> {
  const where: string[] = [`"metadataJson" ? 'latency'`]
  if (opts.since) where.push(`"startedAt" >= '${opts.since.toISOString()}'::timestamp`)
  if (opts.tenantId) where.push(`"tenantId" = '${opts.tenantId.replace(/'/g, "''")}'`)
  const whereSql = where.join(' AND ')

  // Pull the metadata blob as JSON; we'll parse client-side.
  const sql = `
    SELECT
      id::text                           AS conversation_id,
      "tenantId"::text                   AS tenant_id,
      "startedAt"::text                  AS started_at,
      "channelType"::text                AS channel_type,
      "metadataJson"::text               AS metadata
    FROM "Conversation"
    WHERE ${whereSql}
    ORDER BY "startedAt" DESC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim()

  const rows = await ssh(`docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation -A -F '|' -t -c "${sql.replace(/"/g, '\\"')}"`)

  const out: PerCallLatency[] = []
  for (const line of rows.split('\n').filter(Boolean)) {
    const [cid, tid, sat, ct, meta] = line.split('|')
    try {
      const m = JSON.parse(meta!)
      const lat = m?.latency
      if (!lat || !Array.isArray(lat.turns)) continue
      out.push({
        conversationId: cid!, tenantId: tid!, startedAt: sat!, channelType: ct!,
        turns: lat.turns, count: lat.count, min: lat.min, max: lat.max,
        median: lat.median, p95: lat.p95,
      })
    } catch {
      // skip malformed rows
    }
  }
  return out
}

function summarize(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count:  sorted.length,
    min:    sorted[0]!,
    max:    sorted[sorted.length - 1]!,
    median: sorted[Math.floor(sorted.length / 2)]!,
    p95:    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
    p99:    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))]!,
  }
}

function fmtMs(n: number) { return `${n}ms` }

async function main() {
  const argv = process.argv.slice(2)
  const sinceIdx  = argv.indexOf('--since')
  const tenantIdx = argv.indexOf('--tenant')
  const jsonMode  = argv.includes('--json')
  const since     = sinceIdx  >= 0 ? parseSince(argv[sinceIdx + 1]) : null
  const tenantId  = tenantIdx >= 0 ? argv[tenantIdx + 1] : undefined

  if (!jsonMode) {
    console.log('Voice agent latency report')
    console.log('==========================')
    if (since)    console.log(`Since:   ${since.toISOString()}`)
    if (tenantId) console.log(`Tenant:  ${tenantId}`)
    console.log()
  }

  const calls = await fetchData({ since: since ?? undefined, tenantId })
  if (calls.length === 0) {
    if (jsonMode) console.log(JSON.stringify({ calls: [], aggregate: null }))
    else console.log('No calls with latency telemetry yet. Voice gateway records turn timings only on inbound calls completed after 2026-05-05.')
    return
  }

  const allTurns = calls.flatMap(c => c.turns)
  const aggregate = summarize(allTurns)!

  if (jsonMode) {
    console.log(JSON.stringify({ calls, aggregate }, null, 2))
    return
  }

  console.log(`Aggregate across ${calls.length} call(s) / ${aggregate.count} turn(s):`)
  console.log(`  median: ${fmtMs(aggregate.median)}    p95: ${fmtMs(aggregate.p95)}    p99: ${fmtMs(aggregate.p99)}`)
  console.log(`  min:    ${fmtMs(aggregate.min)}      max: ${fmtMs(aggregate.max)}`)
  console.log()

  // Per-call breakdown — worst p95 first
  const sorted = [...calls].sort((a, b) => b.p95 - a.p95)
  console.log(`Per-call breakdown (worst p95 first):`)
  console.log(`  ${'conversationId'.padEnd(20)}  ${'startedAt'.padEnd(20)}  ${'turns'.padStart(5)}  ${'median'.padStart(7)}  ${'p95'.padStart(6)}  channel`)
  for (const c of sorted.slice(0, 30)) {
    const cid = c.conversationId.slice(0, 18)
    const ts  = c.startedAt.slice(0, 19)
    console.log(`  ${cid.padEnd(20)}  ${ts.padEnd(20)}  ${String(c.count).padStart(5)}  ${fmtMs(c.median).padStart(7)}  ${fmtMs(c.p95).padStart(6)}  ${c.channelType}`)
  }

  console.log()
  console.log('Decision guide (target = first agent audio within 800ms of caller silence):')
  if (aggregate.p95 < 800)            console.log('  ✓ p95 already under target. No tuning needed.')
  else if (aggregate.p95 < 1200)      console.log('  ⚠ p95 between 800-1200ms. Tune VAD silence_duration_ms (currently 100ms) before going lower.')
  else                                 console.log('  ✗ p95 over 1200ms. Likely Gemini-side; consider session pre-warming, prompt-size reduction, or model swap.')
}

main().catch(err => { console.error(err); process.exit(1) })
