import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

const GW_WS_BASE = process.env['GATEWAY_WS_URL'] ?? 'wss://gateway.myorbisvoice.com'
const API_BASE   = process.env['API_BASE_URL']    ?? 'https://api.myorbisvoice.com'

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params)
}

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

export async function logCallStart(opts: {
  tenantId:    string
  callSid:     string
  fromNumber:  string
  toNumber:    string
}) {
  return prisma.callLog.create({
    data: {
      tenantId:          opts.tenantId,
      direction:         'INBOUND',
      sourceNumber:      opts.fromNumber,
      destinationNumber: opts.toNumber,
      providerCallId:    opts.callSid,
      status:            'in-progress',
      startAt:           new Date(),
    },
  })
}

export async function logCallEnd(callSid: string, status: string, durationSeconds?: number) {
  await prisma.callLog.updateMany({
    where: { providerCallId: callSid },
    data:  { status, endAt: new Date(), durationSeconds: durationSeconds ?? null },
  })
}
