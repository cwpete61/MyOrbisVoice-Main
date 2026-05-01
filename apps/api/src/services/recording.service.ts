import { prisma } from '../lib/prisma.js'
import { scryptSync, createDecipheriv } from 'crypto'
import * as bunny from './bunny.service.js'
import { maybeCreateStorageNotification } from './notification.service.js'

function decryptTwilioToken(stored: string): string {
  const SECRET_KEY = process.env['AUTH_SECRET'] ?? ''
  const [ivHex, tagHex, encHex] = stored.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid token format')
  const k = scryptSync(SECRET_KEY, 'twilio-salt', 32)
  const dec = createDecipheriv('aes-256-gcm', k, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(encHex, 'hex')).toString('utf8') + dec.final('utf8')
}

async function getTwilioCredentials(tenantId: string): Promise<{ accountSid: string; authToken: string } | null> {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO', status: 'CONNECTED' },
    include: { twilioDetail: true },
  })
  if (!conn?.twilioDetail?.accountSid || !conn.twilioDetail.encryptedAuthToken) return null
  try {
    const authToken = decryptTwilioToken(conn.twilioDetail.encryptedAuthToken)
    return { accountSid: conn.twilioDetail.accountSid, authToken }
  } catch { return null }
}

export interface TwilioRecordingPayload {
  CallSid: string
  RecordingSid: string
  RecordingUrl: string
  RecordingStatus: string
  RecordingDuration: string
  RecordingChannels?: string
}

// Called by the Twilio recording status callback webhook
export async function handleRecordingReady(payload: TwilioRecordingPayload): Promise<void> {
  if (payload.RecordingStatus !== 'completed') return

  // Find the conversation by externalCallId (CallSid)
  const conversation = await prisma.conversation.findFirst({
    where: { externalCallId: payload.CallSid },
    select: { id: true, tenantId: true, recordingStatus: true },
  })

  if (!conversation) return
  if (conversation.recordingStatus === 'stored') return // already processed

  const config = await bunny.getBunnyConfig()

  // Mark as processing immediately to prevent duplicate handling
  await prisma.conversation.update({
    where: { id: conversation.id },
    data:  { recordingStatus: 'processing' },
  })

  try {
    const audioUrl = `${payload.RecordingUrl}.mp3`
    const creds = await getTwilioCredentials(conversation.tenantId)
    if (!creds) throw new Error('Twilio credentials not configured')

    const response = await fetch(audioUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
      },
    })
    if (!response.ok) throw new Error(`Failed to fetch recording: ${response.status}`)
    const audioBuffer = Buffer.from(await response.arrayBuffer())

    const durationSecs = parseInt(payload.RecordingDuration) || 0

    if (config) {
      // Upload to Bunny
      const bunnyPath = bunny.buildBunnyPath(conversation.tenantId, conversation.id)
      const { url, sizeBytes } = await bunny.uploadRecording(config, bunnyPath, audioBuffer)

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          recordingRef:          url,
          recordingBunnyPath:    bunnyPath,
          recordingDurationSecs: durationSecs,
          recordingStatus:       'stored',
          recordingSizeBytes:    BigInt(sizeBytes),
        },
      })

      await bunny.incrementStorageUsed(conversation.tenantId, sizeBytes)

      // Check quota and fire notification if near/at limit
      const quota = await bunny.getStorageQuota(conversation.tenantId)
      maybeCreateStorageNotification(conversation.tenantId, quota.pct).catch(() => null)
    } else {
      // Bunny not configured — store Twilio URL directly as fallback
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          recordingRef:          audioUrl,
          recordingDurationSecs: durationSecs,
          recordingStatus:       'twilio_hosted',
        },
      })
    }
  } catch (err) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data:  { recordingStatus: 'failed' },
    })
    throw err
  }
}

// Generate a signed playback URL for a conversation recording
export async function getPlaybackUrl(conversationId: string, tenantId: string): Promise<string | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    select: { recordingRef: true, recordingBunnyPath: true, recordingStatus: true },
  })

  if (!conversation?.recordingRef) return null

  // If stored on Bunny, generate signed URL
  if (conversation.recordingBunnyPath) {
    const config = await bunny.getBunnyConfig()
    if (config) {
      return bunny.getSignedUrl(config, conversation.recordingBunnyPath, 900)
    }
  }

  return conversation.recordingRef
}
