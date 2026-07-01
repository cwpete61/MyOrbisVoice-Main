/**
 * IMAP poller — reads the Spacemail catch-all inbox (admin@myorbisresults.com)
 * and routes each new message through ingestRawMessage() so prospect replies to
 * a partner's `<slug>@myorbisresults.com` land in that partner's in-app mailbox.
 *
 * This replaces the old Contabo Postfix pipe, which was bypassed when inbound
 * mail moved to Spacemail (see docs/email-setup.md). Config lives in System
 * Settings (platform-level): imap_host / imap_port / imap_user / imap_password.
 * No creds → the job idles (logs once) so a fresh env doesn't crash.
 */
import { ImapFlow } from 'imapflow'
import { getConfigValue } from '../services/system-config.service.js'
import { ingestRawMessage } from '../services/mail-ingest.service.js'

const POLL_INTERVAL_MS = 120_000 // 2 min
let running = false
let warnedNoConfig = false

function deliveredToFromHeaders(headers: Buffer | undefined): string | undefined {
  if (!headers) return undefined
  const text = headers.toString('utf-8')
  // Match the first @myorbisresults.com recipient in Delivered-To / X-Original-To.
  const m = text.match(/(?:delivered-to|x-original-to|x-delivered-to):\s*([^\s<>]+@myorbisresults\.com)/i)
  return m?.[1]?.toLowerCase()
}

async function pollOnce(): Promise<void> {
  if (running) return
  running = true
  let client: ImapFlow | null = null
  try {
    const [host, portStr, user, pass] = await Promise.all([
      getConfigValue('imap_host'),
      getConfigValue('imap_port'),
      getConfigValue('imap_user'),
      getConfigValue('imap_password'),
    ])
    const effHost = host || process.env['IMAP_HOST'] || 'imap.spacemail.com'
    const effPort = parseInt(portStr || process.env['IMAP_PORT'] || '993', 10)
    const effUser = user || process.env['IMAP_USER'] || null
    const effPass = pass || process.env['IMAP_PASSWORD'] || null
    if (!effUser || !effPass) {
      if (!warnedNoConfig) { console.log('[imap-poller] not configured (set imap_user/imap_password in System Settings) — idling'); warnedNoConfig = true }
      return
    }
    warnedNoConfig = false

    client = new ImapFlow({ host: effHost, port: effPort, secure: true, auth: { user: effUser, pass: effPass }, logger: false })
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    let routed = 0, seen = 0
    try {
      for await (const msg of client.fetch({ seen: false }, { uid: true, source: true, headers: ['delivered-to', 'x-original-to', 'x-delivered-to'] })) {
        seen += 1
        try {
          const deliveredTo = deliveredToFromHeaders(msg.headers)
          const res = await ingestRawMessage(msg.source as Buffer, deliveredTo)
          if (res.stored > 0) routed += res.stored
        } catch (e) {
          console.warn('[imap-poller] ingest failed for uid', msg.uid, (e as Error).message)
        } finally {
          // Mark seen regardless — a message we can't route (no matching partner)
          // shouldn't be reprocessed forever; ingestRawMessage already audit-logs
          // unrouted mail, and storage is idempotent by messageId.
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true }).catch(() => {})
        }
      }
    } finally {
      lock.release()
    }
    if (seen > 0) console.log(`[imap-poller] processed ${seen} new message(s), routed ${routed} to partner mailboxes`)
  } catch (e) {
    console.error('[imap-poller] poll failed (non-fatal):', (e as Error).message)
  } finally {
    if (client) { try { await client.logout() } catch { /* already closed */ } }
    running = false
  }
}

export function startImapPollerJob(): void {
  // Kick once shortly after boot, then on the interval.
  setTimeout(() => { pollOnce().catch(() => {}) }, 15_000)
  setInterval(() => { pollOnce().catch(() => {}) }, POLL_INTERVAL_MS)
  console.log('[imap-poller] started (every ' + POLL_INTERVAL_MS / 1000 + 's)')
}
