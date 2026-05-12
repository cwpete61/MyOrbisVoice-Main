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

  if (!host) return null

  // Auth is optional. Self-hosted Postfix on the Docker host trusts our
  // bridge network via `mynetworks` and accepts mail without SMTP auth.
  // For hosted providers (Postmark / Resend / SES / etc.) the user fills
  // in smtp_user + smtp_password and we send authenticated.
  const portNum = port ? parseInt(port, 10) : 25
  return {
    transporter: nodemailer.createTransport({
      host,
      port: portNum,
      secure: portNum === 465,
      // Opportunistic STARTTLS on 25/587, required on 465 (handled by `secure`).
      // Allow self-signed certs since our local Postfix uses snakeoil out of
      // the box; we trust the network, not the cert.
      ignoreTLS: portNum === 25 && (!user || !pass),
      tls: { rejectUnauthorized: false },
      auth: (user && pass) ? { user, pass } : undefined,
    }),
    from: from ?? user ?? 'no-reply@localhost',
  }
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  /** Override the From header. Partner emails pass "Alex Rivera <alex.rivera@myorbisresults.com>".
   *  When unset, falls back to the SystemConfig.smtp_from value. */
  from?: string
  /** Optional Reply-To header. Useful when the From is a no-reply or an automation alias. */
  replyTo?: string
  /** Optional In-Reply-To header for threading (RFC 5322 message id). */
  inReplyTo?: string
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const config = await getTransporter()
  if (!config) {
    console.warn('[email] SMTP not configured — skipping send to', opts.to)
    return
  }
  await config.transporter.sendMail({
    from:      opts.from ?? config.from,
    to:        opts.to,
    subject:   opts.subject,
    html:      opts.html,
    text:      opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    replyTo:   opts.replyTo,
    inReplyTo: opts.inReplyTo,
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
          Questions? The Help Center
          (<a href="${opts.appBaseUrl}/help" style="color:#1a9898">${opts.appBaseUrl}/help</a>)
          covers every feature with step-by-step guides. You can also reach us directly:
          <br/>General — <a href="mailto:admin@myorbisvoice.com" style="color:#1a9898">admin@myorbisvoice.com</a>
          <br/>Technical support — <a href="mailto:support@myorbisvoice.com" style="color:#1a9898">support@myorbisvoice.com</a>
        </p>
        <p style="color:#bbb;font-size:11px;margin-top:8px">
          MyOrbisVoice · 716 Washington St Suite 2, Allentown PA 18102
        </p>
      </div>
    `,
  })
}

// ── Onboarding sequence ──────────────────────────────────────────────────────
//
// Three follow-up emails sent by the onboarding-emails job, scheduled by the
// tenant's createdAt timestamp:
//   - Day 2  (~48h): setup nudge, only if Business DNA still empty
//   - Day 7 (~168h): feature spotlight (SMS + bookings + follow-ups)
//   - Day 14 (~336h): week-2 check-in (genuine "how's it going?" + LTD soft pitch)
//
// Each is bilingual EN/ES based on the tenant owner's preferredLocale.
// Idempotent — Tenant.onboardingEmailsSent tracks send timestamps.

type OnboardingEmailLocale = 'en' | 'es'

interface OnboardingEmailOpts {
  to: string
  firstName?: string | null
  tenantName: string
  appBaseUrl: string
  locale: OnboardingEmailLocale
}

function emailFooter(appBaseUrl: string, locale: OnboardingEmailLocale): string {
  if (locale === 'es') {
    return `
      <p style="color:#888;font-size:13px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
        ¿Preguntas? El Centro de Ayuda
        (<a href="${appBaseUrl}/help" style="color:#1a9898">${appBaseUrl}/help</a>)
        cubre cada función con guías paso a paso. También puedes contactarnos directamente:
        <br/>General — <a href="mailto:admin@myorbisvoice.com" style="color:#1a9898">admin@myorbisvoice.com</a>
        <br/>Soporte técnico — <a href="mailto:support@myorbisvoice.com" style="color:#1a9898">support@myorbisvoice.com</a>
      </p>
      <p style="color:#bbb;font-size:11px;margin-top:8px">
        MyOrbisVoice · 716 Washington St Suite 2, Allentown PA 18102
      </p>`
  }
  return `
    <p style="color:#888;font-size:13px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
      Questions? The Help Center
      (<a href="${appBaseUrl}/help" style="color:#1a9898">${appBaseUrl}/help</a>)
      covers every feature with step-by-step guides. You can also reach us directly:
      <br/>General — <a href="mailto:admin@myorbisvoice.com" style="color:#1a9898">admin@myorbisvoice.com</a>
      <br/>Technical support — <a href="mailto:support@myorbisvoice.com" style="color:#1a9898">support@myorbisvoice.com</a>
    </p>
    <p style="color:#bbb;font-size:11px;margin-top:8px">
      MyOrbisVoice · 716 Washington St Suite 2, Allentown PA 18102
    </p>`
}

export async function sendOnboardingSetupNudge(opts: OnboardingEmailOpts) {
  const greeting    = opts.locale === 'es' ? (opts.firstName ? `Hola ${opts.firstName},` : 'Hola,') : (opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,')
  const dnaLink     = `${opts.appBaseUrl}/business-dna`
  const studioLink  = `${opts.appBaseUrl}/agent-studio`

  if (opts.locale === 'es') {
    await sendEmail({
      to: opts.to,
      subject: `Tu recepcionista de IA está esperándote, ${opts.tenantName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
          <h2 style="color:#1a9898;margin-bottom:4px">Una pieza más y tu agente está listo</h2>
          <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
          <p>${greeting}</p>
          <p>Hace dos días creaste tu cuenta — gracias. Pero noté que tu <strong>DNA del negocio</strong> aún está vacío, y eso es lo que tu agente lee primero en cada llamada.</p>
          <p>Sin él, el agente no sabe cómo se llama tu negocio, qué servicios ofreces, ni qué hacer cuando algo se sale del guion.</p>
          <p>Toma alrededor de <strong>5 minutos</strong>. Una vez que esté listo, puedes probar todo en Agent Studio sin necesidad de un teléfono.</p>
          <a href="${dnaLink}" style="display:inline-block;background:#1a9898;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:8px">
            Configurar el DNA del negocio →
          </a>
          <p style="margin-top:20px;font-size:13px;color:#666">¿Ya configuraste algo? Pruébalo aquí: <a href="${studioLink}" style="color:#1a9898">${studioLink}</a></p>
          ${emailFooter(opts.appBaseUrl, opts.locale)}
        </div>`,
    })
    return
  }

  await sendEmail({
    to: opts.to,
    subject: `Your AI receptionist is waiting on you, ${opts.tenantName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:#1a9898;margin-bottom:4px">One more piece and your agent is live</h2>
        <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
        <p>${greeting}</p>
        <p>You created your account two days ago — thanks for that. But I noticed your <strong>Business DNA</strong> is still empty, and that's what your agent reads first on every call.</p>
        <p>Without it, the agent doesn't know what your business is called, what you offer, or what to do when something goes off-script.</p>
        <p>Takes about <strong>5 minutes</strong>. Once it's filled in, you can test everything in Agent Studio without needing a phone.</p>
        <a href="${dnaLink}" style="display:inline-block;background:#1a9898;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:8px">
          Set up Business DNA →
        </a>
        <p style="margin-top:20px;font-size:13px;color:#666">Already configured something? Test it here: <a href="${studioLink}" style="color:#1a9898">${studioLink}</a></p>
        ${emailFooter(opts.appBaseUrl, opts.locale)}
      </div>`,
  })
}

export async function sendOnboardingFeatureSpotlight(opts: OnboardingEmailOpts) {
  const greeting     = opts.locale === 'es' ? (opts.firstName ? `Hola ${opts.firstName},` : 'Hola,') : (opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,')
  const channelsLink = `${opts.appBaseUrl}/channels`
  const apptsLink    = `${opts.appBaseUrl}/integrations`
  const campLink     = `${opts.appBaseUrl}/campaigns`

  if (opts.locale === 'es') {
    await sendEmail({
      to: opts.to,
      subject: `3 cosas que tu agente puede hacer (que probablemente no sabías)`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
          <h2 style="color:#1a9898;margin-bottom:4px">Tu agente hace más que contestar el teléfono</h2>
          <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
          <p>${greeting}</p>
          <p>Llevas una semana con MyOrbisVoice. Quería compartirte tres funciones que la mayoría de los nuevos clientes no descubren hasta el segundo mes:</p>
          <ol style="padding-left:20px;margin:20px 0">
            <li style="margin-bottom:12px"><strong>Tu agente puede enviar mensajes de texto.</strong> Confirmaciones de citas, recordatorios, seguimientos — todo automático. <a href="${channelsLink}" style="color:#1a9898">Activa SMS en Canales →</a></li>
            <li style="margin-bottom:12px"><strong>Reserva citas directamente en tu Google Calendar.</strong> El agente verifica disponibilidad en tiempo real y crea el evento — sin intervención humana. <a href="${apptsLink}" style="color:#1a9898">Conectar Google →</a></li>
            <li><strong>Campañas automáticas activadas por etiquetas.</strong> Cuando el agente marca una llamada como "callback solicitado", una campaña se dispara automáticamente con el seguimiento. <a href="${campLink}" style="color:#1a9898">Ver Campañas →</a></li>
          </ol>
          <p style="font-size:13px;color:#666">¿Alguna de estas te llama la atención? Responde a este correo y con gusto te ayudo a configurarla.</p>
          ${emailFooter(opts.appBaseUrl, opts.locale)}
        </div>`,
    })
    return
  }

  await sendEmail({
    to: opts.to,
    subject: `3 things your agent can do (that you probably didn't know)`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:#1a9898;margin-bottom:4px">Your agent does more than answer the phone</h2>
        <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
        <p>${greeting}</p>
        <p>You've been on MyOrbisVoice for a week. Wanted to share three features most new customers don't discover until month two:</p>
        <ol style="padding-left:20px;margin:20px 0">
          <li style="margin-bottom:12px"><strong>Your agent can send SMS.</strong> Appointment confirmations, reminders, follow-ups — all automated. <a href="${channelsLink}" style="color:#1a9898">Enable SMS in Channels →</a></li>
          <li style="margin-bottom:12px"><strong>Books appointments directly into your Google Calendar.</strong> The agent checks availability in real time and creates the event — no human in the loop. <a href="${apptsLink}" style="color:#1a9898">Connect Google →</a></li>
          <li><strong>Tag-driven automated campaigns.</strong> When the agent marks a call "callback requested", a campaign fires the follow-up automatically. <a href="${campLink}" style="color:#1a9898">See Campaigns →</a></li>
        </ol>
        <p style="font-size:13px;color:#666">Any of these stand out? Reply to this email and I'll help you wire it up.</p>
        ${emailFooter(opts.appBaseUrl, opts.locale)}
      </div>`,
  })
}

export async function sendOnboardingWeekTwoCheckIn(opts: OnboardingEmailOpts) {
  const greeting   = opts.locale === 'es' ? (opts.firstName ? `Hola ${opts.firstName},` : 'Hola,') : (opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,')
  const billingLink = `${opts.appBaseUrl}/billing`

  if (opts.locale === 'es') {
    await sendEmail({
      to: opts.to,
      subject: `Una pregunta rápida — ¿cómo va todo?`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
          <h2 style="color:#1a9898;margin-bottom:4px">¿Cómo va todo?</h2>
          <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
          <p>${greeting}</p>
          <p>Llevas dos semanas con MyOrbisVoice. Esta es la nota personal — no automatizada de relleno.</p>
          <p>Tres preguntas honestas:</p>
          <ul style="padding-left:20px;margin:14px 0">
            <li>¿Qué <strong>está funcionando</strong> bien para ti?</li>
            <li>¿Qué <strong>no está funcionando</strong>, o es confuso?</li>
            <li>¿Hay algo que <strong>desearías que pudiera hacer</strong> y aún no hace?</li>
          </ul>
          <p>Responde directamente a este correo. Lo leo personalmente. Tu respuesta cambia lo que construimos a continuación.</p>
          <p style="margin-top:24px;font-size:13px;color:#666">Por cierto: si la facturación mensual no es lo tuyo, queda <strong>tiempo limitado</strong> en el Lifetime Deal de $497 (cupos limitados a los primeros 100 clientes). <a href="${billingLink}" style="color:#1a9898">Verlo aquí →</a></p>
          ${emailFooter(opts.appBaseUrl, opts.locale)}
        </div>`,
    })
    return
  }

  await sendEmail({
    to: opts.to,
    subject: `Quick check-in — how's it going?`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:#1a9898;margin-bottom:4px">How's it going?</h2>
        <p style="color:#666;margin-top:0;margin-bottom:24px">${opts.tenantName}</p>
        <p>${greeting}</p>
        <p>You've had MyOrbisVoice for two weeks. This is the human note — not auto-canned filler.</p>
        <p>Three honest questions:</p>
        <ul style="padding-left:20px;margin:14px 0">
          <li>What's <strong>working</strong> well for you?</li>
          <li>What's <strong>not working</strong>, or feels confusing?</li>
          <li>Is there anything you <strong>wish it could do</strong> that it doesn't yet?</li>
        </ul>
        <p>Reply directly to this email. I read it personally. Your reply changes what we build next.</p>
        <p style="margin-top:24px;font-size:13px;color:#666">PS: If monthly billing isn't your style, there's <strong>limited time</strong> on the $497 Lifetime Deal (capped at the first 100 customers). <a href="${billingLink}" style="color:#1a9898">See it here →</a></p>
        ${emailFooter(opts.appBaseUrl, opts.locale)}
      </div>`,
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
