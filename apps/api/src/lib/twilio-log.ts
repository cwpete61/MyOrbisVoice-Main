import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

type TwilioEventInput = {
  tenantId:     string
  callSid?:     string
  direction:    'INBOUND' | 'OUTBOUND'
  eventType:    'amd' | 'status' | 'inbound_received' | 'error' | 'dispatch'
  callStatus?:  string
  answeredBy?:  string
  fromNumber?:  string
  toNumber?:    string
  durationSecs?: number
  outcomeCode?: string
  errorMessage?: string
  metaJson?:    Record<string, unknown>
}

export async function logTwilioEvent(input: TwilioEventInput): Promise<void> {
  try {
    await prisma.twilioEventLog.create({
      data: {
        tenantId:     input.tenantId,
        callSid:      input.callSid,
        direction:    input.direction,
        eventType:    input.eventType,
        callStatus:   input.callStatus,
        answeredBy:   input.answeredBy,
        fromNumber:   input.fromNumber,
        toNumber:     input.toNumber,
        durationSecs: input.durationSecs,
        outcomeCode:  input.outcomeCode,
        errorMessage: input.errorMessage,
        metaJson:     input.metaJson ? (input.metaJson as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
  } catch (err) {
    console.error('[twilio-log] failed to write event:', err)
  }
}
