/**
 * Shared Twilio call-control helper for the voice gateway.
 *
 * Hangs up an in-progress call by POSTing Status=completed to the Twilio REST
 * API. Under managed Twilio, the call resource lives on the tenant's
 * subaccount (or on master for legacy numbers), so the URL path must use the
 * `ownerAccountSid` Twilio gave us in the Media Stream `start` event.
 * Authentication uses MASTER credentials in all cases — Twilio basic-auth
 * requires the AccountSid in the header to match the token's owner, and
 * master inherits write access to its subaccounts' calls.
 *
 * Originally duplicated in inbound.ts and outbound.ts; consolidated here so
 * the new `hangup_call` tool handler (services/tools.ts) can reuse it.
 */
import { getTwilioAccountSid, getTwilioAuthToken } from './twilio-auth.js'

export async function hangUpTwilioCall(
  callSid: string,
  ownerAccountSid: string | null,
  tag = 'gateway',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [masterSid, masterToken] = await Promise.all([getTwilioAccountSid(), getTwilioAuthToken()])
    if (!ownerAccountSid || !masterSid || !masterToken) {
      console.warn(`[${tag}] hangup skipped — missing master creds or owner sid`)
      return { ok: false, error: 'missing master creds or owner sid' }
    }
    const credentials = Buffer.from(`${masterSid}:${masterToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ownerAccountSid}/Calls/${callSid}.json`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Status=completed',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[${tag}] hangup failed ${res.status}: ${body}`)
      return { ok: false, error: `Twilio ${res.status}` }
    }
    console.log(`[${tag}] hung up call ${callSid}`)
    return { ok: true }
  } catch (err) {
    console.error(`[${tag}] hangup error:`, err)
    return { ok: false, error: (err as Error).message ?? 'hangup error' }
  }
}
