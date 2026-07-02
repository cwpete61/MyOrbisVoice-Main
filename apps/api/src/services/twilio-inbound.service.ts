import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { getSubaccountClient } from './twilio-subaccount.service.js'
import { getPlatformTwilioClient } from './twilio.service.js'
import { AppError } from '@voiceautomation/shared'

const GW_WS_BASE = process.env['GATEWAY_WS_URL'] ?? 'wss://gateway.myorbisvoice.com'
const API_BASE   = process.env['API_BASE_URL']    ?? 'https://api.myorbisvoice.com'

export async function resolveInboundCall(toNumber: string) {
  // Find the phone number record and its tenant
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, isInboundEnabled: true },
    include: {
      tenant: {
        include: {
          channelConfigs: { where: { channelType: 'INBOUND' } },
          businessProfile: true,
        },
      },
    },
  })
  if (!phone) throw new AppError('NOT_FOUND', 'No inbound-enabled number found', 404)
  return phone
}

function isWithinBusinessHours(hoursJson: any, timezone?: string): boolean {
  if (!hoursJson) return true  // no hours configured → always open

  // Evaluate "now" in the TENANT's timezone, not the server's (containers run
  // UTC). Without this, a business open until 22:00 Eastern reads as "closed"
  // after ~18:00 local once UTC rolls past 22:00 — and after midnight UTC the
  // whole evening reads closed. Hours labels ("09:00") are local wall-clock.
  const tz      = timezone || 'America/New_York'
  const now     = new Date()
  const dayFull = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(now).toLowerCase() // mon, tue …
  let timeStr   = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
  // V8 quirk: hour12:false can render midnight as "24:NN" — normalize to "00".
  if (timeStr.startsWith('24')) timeStr = '00' + timeStr.slice(2)

  const schedule = hoursJson as Record<string, { open: string; close: string; closed?: boolean }>
  const entry    = schedule[dayFull]
  if (!entry || entry.closed) return false
  return timeStr >= entry.open && timeStr < entry.close
}

export function buildInboundTwiml(opts: {
  tenantId:        string
  channelConfigId: string
  afterHoursMode:  string | null
  greetingMode:    string | null
  escalationMode:  string | null
  forwardingTarget: string | null
  hoursJson:       any
  timezone?:       string | null  // tenant IANA tz for business-hours evaluation
  callSid:         string
  fromNumber?:     string  // caller-ID E.164 — read back to caller instead of asking them to recite
  /** Set when the dialed number is partner-owned. Threaded to the gateway so
   *  the agent speaks AS the partner's Orby (partner first name, business). */
  partnerId?:      string | null
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response      = new VoiceResponse()

  const open = isWithinBusinessHours(opts.hoursJson, opts.timezone ?? undefined)

  if (!open && opts.afterHoursMode) {
    if (opts.afterHoursMode === 'voicemail') {
      response.say({ voice: 'alice' }, "We're currently closed. Please leave a message after the tone.")
      response.record({
        action:          `${API_BASE}/api/webhooks/twilio/recording`,
        maxLength:       120,
        transcribe:      true,
        transcribeCallback: `${API_BASE}/api/webhooks/twilio/transcription`,
      })
      return response.toString()
    }

    if (opts.afterHoursMode === 'forward' && opts.forwardingTarget) {
      response.dial().number(opts.forwardingTarget)
      return response.toString()
    }

    // Default after-hours: inform and hang up
    response.say({ voice: 'alice' }, "Thank you for calling. We are currently closed. Please call back during business hours.")
    response.hangup()
    return response.toString()
  }

  // Business hours — connect to the AI voice agent via Media Stream
  const connect = response.connect()
  const stream  = connect.stream({
    url: `${GW_WS_BASE}/ws/inbound`,
  })
  stream.parameter({ name: 'tenantId',        value: opts.tenantId })
  stream.parameter({ name: 'channelConfigId', value: opts.channelConfigId })
  stream.parameter({ name: 'callSid',         value: opts.callSid })
  if (opts.fromNumber) {
    stream.parameter({ name: 'fromNumber',    value: opts.fromNumber })
  }
  if (opts.partnerId) {
    stream.parameter({ name: 'partnerId',     value: opts.partnerId })
  }

  return response.toString()
}

// ── DEMO phone sessions ─────────────────────────────────────────────────────

type AgentStreamParams = {
  tenantId: string
  channelConfigId: string
  callSid: string
  fromNumber?: string
  demoSessionId?: string
  /** When '1', the gateway listens for keypad DTMF and binds the call to the
   *  matching demo session live (Orby answers first — no robotic pre-gather). */
  demoPinCapture?: boolean
}

/** Append a <Connect><Stream> to an existing VoiceResponse. */
function appendAgentStream(response: InstanceType<typeof twilio.twiml.VoiceResponse>, p: AgentStreamParams): void {
  const stream = response.connect().stream({ url: `${GW_WS_BASE}/ws/inbound` })
  stream.parameter({ name: 'tenantId',        value: p.tenantId })
  stream.parameter({ name: 'channelConfigId', value: p.channelConfigId })
  stream.parameter({ name: 'callSid',         value: p.callSid })
  if (p.fromNumber)     stream.parameter({ name: 'fromNumber',     value: p.fromNumber })
  if (p.demoSessionId)  stream.parameter({ name: 'demoSessionId',  value: p.demoSessionId })
  if (p.demoPinCapture) stream.parameter({ name: 'demoPinCapture', value: '1' })
}

/** DEMO line (option C): Orby answers immediately (her own voice) and the
 *  gateway captures any keypad PIN via DTMF to bind the session — no robotic
 *  pre-gather. */
export function buildDemoDirectConnectTwiml(p: AgentStreamParams): string {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response      = new VoiceResponse()
  appendAgentStream(response, { ...p, demoPinCapture: true })
  return response.toString()
}


// Managed Twilio: the call lives on whichever account owns the inbound
// number. For tenants with a provisioned subaccount, that's the subaccount;
// for legacy / platform-owned numbers it's the master account directly.
// Calling getSubaccountClient unconditionally was lazily creating empty
// subaccounts and producing a client whose creds didn't own the call —
// Twilio responded with 400 "Invalid parameter" (code 20001).
//
// We look up the PhoneNumber row for the call's `to` number; its
// `twilioSubaccountSid` field tells us where the call lives. If null,
// the recording must be created against the master client.
export async function startCallRecording(callSid: string, tenantId: string, toNumber?: string) {
  try {
    let client: Awaited<ReturnType<typeof getSubaccountClient>>
    let usedAccount: 'master' | 'subaccount' = 'master'

    // Resolve which account owns the call. Prefer looking up by the
    // dialed number when available, since one tenant could have numbers
    // on different accounts (master + subaccount during migration).
    let phone: { twilioSubaccountSid: string | null } | null = null
    if (toNumber) {
      phone = await prisma.phoneNumber.findFirst({
        where: { e164Number: toNumber },
        select: { twilioSubaccountSid: true },
      })
    }
    if (!phone) {
      // Fall back to: any phone owned by this tenant (best-effort)
      phone = await prisma.phoneNumber.findFirst({
        where: { tenantId },
        select: { twilioSubaccountSid: true },
      })
    }

    if (phone?.twilioSubaccountSid) {
      client = await getSubaccountClient(tenantId)
      usedAccount = 'subaccount'
    } else {
      client = await getPlatformTwilioClient()
      usedAccount = 'master'
    }

    const recording = await client.calls(callSid).recordings.create({
      recordingStatusCallback:       `${API_BASE}/api/webhooks/twilio/recording`,
      recordingStatusCallbackMethod: 'POST',
      // Explicit event list — without this Twilio's default behavior is
      // inconsistent for calls connected via <Connect><Stream> (which is
      // every AI call). 'completed' is what triggers our handler to fetch
      // the audio and upload to Bunny.
      recordingStatusCallbackEvent:  ['completed'],
    })
    console.log(`[recording] started for ${callSid} on ${usedAccount}: ${recording.sid}`)
  } catch (err) {
    console.error('[recording] startCallRecording error:', err)
  }
}

export async function logCallStart(opts: {
  tenantId:    string
  callSid:     string
  fromNumber:  string
  toNumber:    string
  /** Set when the dialed number is partner-owned. Attributes the Conversation
   *  to the partner so it surfaces on the partner portal, and scopes the
   *  caller→contact match to the partner's contacts. */
  partnerId?:  string | null
  /** MyOrbisAgents — set when the dialed number is a listing's tracking number.
   *  Attributes the call to that listing for per-listing call counts. */
  listingId?:  string | null
}) {
  // Match caller to a contact. Partner-owned numbers scope to the partner's
  // contacts; tenant numbers scope to the tenant's.
  const contact = await prisma.contact.findFirst({
    where: opts.partnerId
      ? { partnerId: opts.partnerId, phoneE164: opts.fromNumber }
      : { tenantId: opts.tenantId, phoneE164: opts.fromNumber },
    select: { id: true },
  })

  const now = new Date()

  // Create Conversation record — this is what the UI and timeline query
  const conversation = await prisma.conversation.create({
    data: {
      tenantId:       opts.tenantId,
      partnerId:      opts.partnerId ?? null,
      listingId:      opts.listingId ?? null,
      contactId:      contact?.id ?? null,
      channelType:    'INBOUND',
      direction:      'INBOUND',
      status:         'OPEN',
      startedAt:      now,
      externalCallId: opts.callSid,
    },
  })

  // Create CallLog linked to the conversation
  await prisma.callLog.create({
    data: {
      tenantId:          opts.tenantId,
      contactId:         contact?.id ?? null,
      conversationId:    conversation.id,
      direction:         'INBOUND',
      sourceNumber:      opts.fromNumber,
      destinationNumber: opts.toNumber,
      providerCallId:    opts.callSid,
      status:            'in-progress',
      startAt:           now,
    },
  })

  return conversation
}

export async function logCallEnd(callSid: string, status: string, durationSeconds?: number) {
  const convStatus = status === 'completed' ? 'COMPLETED'
    : status === 'busy' || status === 'no-answer' ? 'ABANDONED'
    : status === 'failed' ? 'FAILED'
    : 'COMPLETED'

  // Update CallLog
  await prisma.callLog.updateMany({
    where: { providerCallId: callSid },
    data:  { status, endAt: new Date(), durationSeconds: durationSeconds ?? null },
  })

  // Update Conversation
  await prisma.conversation.updateMany({
    where: { externalCallId: callSid },
    data:  { status: convStatus, endedAt: new Date() },
  })
}
