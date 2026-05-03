import { prisma } from '../lib/prisma.js'

export type OptOutChannel = 'SMS' | 'VOICE' | 'EMAIL' | 'WHATSAPP'
export type OptOutSource = 'REPLY_STOP' | 'REPLY_START' | 'VOICE_REQUEST' | 'MANUAL' | 'WEBHOOK'

export async function processOptOut(
  tenantId: string,
  contactId: string,
  channel: OptOutChannel,
  source: OptOutSource,
) {
  const data: Record<string, unknown> = {}
  if (channel === 'SMS')      { data['optedOutSms'] = true;      data['optedOutSmsAt'] = new Date() }
  if (channel === 'VOICE')    { data['optedOutVoice'] = true;    data['optedOutVoiceAt'] = new Date() }
  if (channel === 'EMAIL')    { data['optedOutEmail'] = true;    data['optedOutEmailAt'] = new Date() }
  if (channel === 'WHATSAPP') { data['optedOutWhatsapp'] = true; data['optedOutWhatsappAt'] = new Date() }

  // OptOutLog.channel only accepts SMS/VOICE/EMAIL today; collapse WHATSAPP
  // onto SMS for log purposes until the schema's audit enum is widened.
  const logChannel = channel === 'WHATSAPP' ? 'SMS' : channel

  await Promise.all([
    prisma.contact.update({ where: { id: contactId }, data }),
    prisma.optOutLog.create({ data: { tenantId, contactId, channel: logChannel, source, optedOut: true } }),
  ])
}

export async function processOptIn(
  tenantId: string,
  contactId: string,
  channel: OptOutChannel,
  source: OptOutSource,
) {
  const data: Record<string, unknown> = {}
  if (channel === 'SMS')      { data['optedOutSms'] = false;      data['optedOutSmsAt'] = null }
  if (channel === 'VOICE')    { data['optedOutVoice'] = false;    data['optedOutVoiceAt'] = null }
  if (channel === 'EMAIL')    { data['optedOutEmail'] = false;    data['optedOutEmailAt'] = null }
  if (channel === 'WHATSAPP') { data['optedOutWhatsapp'] = false; data['optedOutWhatsappAt'] = null }

  const logChannel = channel === 'WHATSAPP' ? 'SMS' : channel

  await Promise.all([
    prisma.contact.update({ where: { id: contactId }, data }),
    prisma.optOutLog.create({ data: { tenantId, contactId, channel: logChannel, source, optedOut: false } }),
  ])
}

// Find a contact by phone number within a tenant — used for inbound SMS matching
export async function findContactByPhone(tenantId: string, phoneE164: string) {
  return prisma.contact.findFirst({ where: { tenantId, phoneE164 } })
}
