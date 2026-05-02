import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma.js'

async function getSmtpConfig() {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from'] } },
  })
  const get = (k: string) => rows.find(r => r.key === k)?.value ?? null
  const host = get('smtp_host') || process.env['SMTP_HOST']
  const user = get('smtp_user') || process.env['SMTP_USER']
  const pass = get('smtp_password') || process.env['SMTP_PASSWORD']
  if (!host || !user || !pass) return null
  return {
    host,
    port: parseInt(get('smtp_port') ?? process.env['SMTP_PORT'] ?? '587'),
    user,
    pass,
    from: get('smtp_from') || process.env['SMTP_FROM'] || user,
  }
}

export async function sendCallNotificationEmail(opts: {
  tenantId: string
  channelType: 'INBOUND' | 'OUTBOUND' | 'WIDGET'
  callerPhone?: string
}) {
  const [config, profile, tenant] = await Promise.all([
    getSmtpConfig(),
    prisma.businessProfile.findUnique({
      where: { tenantId: opts.tenantId },
      select: { fallbackNotificationEmail: true },
    }),
    prisma.tenant.findUnique({ where: { id: opts.tenantId }, select: { displayName: true } }),
  ])

  const to = profile?.fallbackNotificationEmail
  if (!to || !config) return

  const channelLabel = opts.channelType === 'INBOUND' ? 'Inbound Phone Call'
    : opts.channelType === 'OUTBOUND' ? 'Outbound Call'
    : 'Widget Session'
  const caller = opts.callerPhone ?? 'Unknown caller'
  const time = new Date().toUTCString()
  const appUrl = process.env['APP_BASE_URL'] ?? 'https://app.myorbisvoice.com'

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })

  await transporter.sendMail({
    from: config.from,
    to,
    subject: `New ${channelLabel}${opts.callerPhone ? ` from ${opts.callerPhone}` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#1a9898;margin-bottom:4px">${channelLabel}</h2>
        <p style="color:#555;margin-top:0">${tenant?.displayName ?? 'Your workspace'}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#888;width:100px">Caller</td><td style="color:#222">${caller}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Time</td><td style="color:#222">${time}</td></tr>
        </table>
        <a href="${appUrl}/conversations" style="display:inline-block;background:#1a9898;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
          View in MyOrbisVoice →
        </a>
        <p style="color:#bbb;font-size:11px;margin-top:24px">Manage notification settings in workspace settings.</p>
      </div>
    `,
  })
}
