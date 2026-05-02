import nodemailer from 'nodemailer'
import * as systemConfig from './system-config.service.js'

async function getTransporter() {
  const [host, port, user, pass, from] = await Promise.all([
    systemConfig.getConfigValue('smtp_host'),
    systemConfig.getConfigValue('smtp_port'),
    systemConfig.getConfigValue('smtp_user'),
    systemConfig.getConfigValue('smtp_password'),
    systemConfig.getConfigValue('smtp_from'),
  ])

  if (!host || !user || !pass) return null

  return {
    transporter: nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass },
    }),
    from: from ?? user,
  }
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const config = await getTransporter()
  if (!config) {
    console.warn('[email] SMTP not configured — skipping send to', opts.to)
    return
  }
  await config.transporter.sendMail({
    from: config.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
  })
}

export async function sendCallNotification(opts: {
  to: string
  tenantName: string
  callerName?: string
  callerPhone?: string
  channelType: string
  startedAt: Date
  conversationId: string
  appBaseUrl: string
}) {
  const channel = opts.channelType === 'INBOUND' ? 'Inbound Phone Call'
    : opts.channelType === 'OUTBOUND' ? 'Outbound Call'
    : 'Widget Session'
  const caller = opts.callerName || opts.callerPhone || 'Unknown caller'
  const time = opts.startedAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })
  const link = `${opts.appBaseUrl}/conversations`

  await sendEmail({
    to: opts.to,
    subject: `New ${channel} — ${caller}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1a9898;margin-bottom:4px">${channel}</h2>
        <p style="color:#555;margin-top:0">${opts.tenantName}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#888;width:120px">Caller</td><td style="color:#222">${caller}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Time</td><td style="color:#222">${time} UTC</td></tr>
          <tr><td style="padding:6px 0;color:#888">Channel</td><td style="color:#222">${channel}</td></tr>
        </table>
        <a href="${link}" style="display:inline-block;background:#1a9898;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
          View conversation →
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">MyOrbisVoice · you can manage notification preferences in your workspace settings.</p>
      </div>
    `,
  })
}
