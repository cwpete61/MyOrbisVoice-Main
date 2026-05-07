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

function isWithinBusinessHours(hoursJson: any): boolean {
  if (!hoursJson) return true  // no hours configured → always open

  const now     = new Date()
  const dayFull = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase() // mon, tue …
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

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
  callSid:         string
  fromNumber?:     string  // caller-ID E.164 — read back to caller instead of asking them to recite
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response      = new VoiceResponse()

  const open = isWithinBusinessHours(opts.hoursJson)

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
}) {
  // Match caller to a contact if possible
  const contact = await prisma.contact.findFirst({
    where: { tenantId: opts.tenantId, phoneE164: opts.fromNumber },
    select: { id: true },
  })

  const now = new Date()

  // Create Conversation record — this is what the UI and timeline query
  const conversation = await prisma.conversation.create({
    data: {
      tenantId:       opts.tenantId,
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
