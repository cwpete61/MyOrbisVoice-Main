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

/** Welcome email fired once when a new tenant signs up. Steers them to the
 *  three first-week wins: complete Business DNA, write the master prompt,
 *  enable a channel. Non-fatal if SMTP isn't configured — the app still
 *  signs them up successfully. */
export async function sendWelcomeEmail(opts: {
  to: string
  firstName?: string | null
  tenantName: string
  appBaseUrl: string
}) {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,'
  const dashboardLink = `${opts.appBaseUrl}/dashboard`
  const dnaLink       = `${opts.appBaseUrl}/business-dna`
  const promptsLink   = `${opts.appBaseUrl}/prompts`
  const channelsLink  = `${opts.appBaseUrl}/channels`

  await sendEmail({
    to: opts.to,
    subject: `Welcome to MyOrbisVoice, ${opts.tenantName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:#1a9898;margin-bottom:4px">Welcome to MyOrbisVoice 👋</h2>
        <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>

        <p>${greeting}</p>
        <p>Your account is live. Three steps to get your AI receptionist talking to real callers this week:</p>

        <ol style="padding-left:20px;margin:20px 0">
          <li style="margin-bottom:14px">
            <strong>Fill in your Business DNA</strong> — name, services, hours, escalation rules.
            This is what your agent reads first on every call.
            <br/><a href="${dnaLink}" style="color:#1a9898">${dnaLink}</a>
          </li>
          <li style="margin-bottom:14px">
            <strong>Write your Master Prompt</strong> — describe your agent's persona, tone, and primary goal in plain language.
            <br/><a href="${promptsLink}" style="color:#1a9898">${promptsLink}</a>
          </li>
          <li>
            <strong>Enable a channel</strong> — start with the Website Widget; no Twilio setup needed.
            <br/><a href="${channelsLink}" style="color:#1a9898">${channelsLink}</a>
          </li>
        </ol>

        <a href="${dashboardLink}" style="display:inline-block;background:#1a9898;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:16px">
          Open your dashboard →
        </a>

        <p style="color:#888;font-size:13px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
          Questions? Reply to this email and we'll get back to you. The Help Center
          (<a href="${opts.appBaseUrl}/help" style="color:#1a9898">${opts.appBaseUrl}/help</a>)
          covers every feature with step-by-step guides.
        </p>
        <p style="color:#bbb;font-size:11px;margin-top:8px">
          MyOrbisVoice · 716 Washington St Suite 2, Allentown PA 18102
        </p>
      </div>
    `,
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

/** Password-reset email. Sends a one-shot URL with the raw token in the
 *  query string. The token expires in 15 minutes and can only be used
 *  once — token is hashed in the DB so a leak doesn't compromise pending
 *  resets. Non-fatal if SMTP isn't configured. */
export async function sendPasswordResetEmail(opts: {
  to: string
  firstName?: string | null
  resetUrl: string  // already-built URL like https://app.myorbisvoice.com/reset-password?token=…
  expiresInMinutes: number
}) {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,'

  await sendEmail({
    to: opts.to,
    subject: 'Reset your MyOrbisVoice password',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:#1a9898;margin-bottom:8px">Reset your password</h2>
        <p>${greeting}</p>
        <p>We got a request to reset the password for your MyOrbisVoice account. Click the button below to choose a new password:</p>
        <a href="${opts.resetUrl}" style="display:inline-block;background:#1a9898;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin:16px 0">
          Reset password →
        </a>
        <p style="color:#666;font-size:13px">This link expires in <strong>${opts.expiresInMinutes} minutes</strong> and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.</p>
        <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">If the button doesn't work, paste this URL into your browser:<br/><a href="${opts.resetUrl}" style="color:#1a9898;word-break:break-all">${opts.resetUrl}</a></p>
        <p style="color:#bbb;font-size:11px;margin-top:8px">MyOrbisVoice · 716 Washington St Suite 2, Allentown PA 18102</p>
      </div>
    `,
  })
}
