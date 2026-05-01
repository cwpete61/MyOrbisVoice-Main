import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
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

  return response.toString()
}

function decryptTwilioToken(stored: string): string {
  const { scryptSync, createDecipheriv } = require('crypto')
  const SECRET_KEY = process.env['AUTH_SECRET'] ?? ''
  const [ivHex, tagHex, encHex] = stored.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid token format')
  const k = scryptSync(SECRET_KEY, 'twilio-salt', 32)
  const dec = createDecipheriv('aes-256-gcm', k, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

export async function startCallRecording(callSid: string, tenantId: string) {
  try {
    const conn = await prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'TWILIO', status: 'CONNECTED' },
      include: { twilioDetail: true },
    })
    if (!conn?.twilioDetail?.accountSid) return
    const encToken = conn.twilioDetail.encryptedAuthToken
    if (!encToken) return
    let authToken: string
    try { authToken = decryptTwilioToken(encToken) } catch { return }
    const accountSid = conn.twilioDetail.accountSid
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`
    const body = new URLSearchParams({
      RecordingStatusCallback: `${API_BASE}/api/webhooks/twilio/recording`,
      RecordingStatusCallbackMethod: 'POST',
    })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    console.log(`[inbound] recording started for ${callSid}: ${res.status}`)
  } catch (err) {
    console.error('[inbound] startCallRecording error:', err)
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
