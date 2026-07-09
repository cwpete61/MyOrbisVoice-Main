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
  /** Phase F.4 — suppression scope. Transactional sends bypass tenant/partner
   *  suppression but still respect global hard bounces. Marketing/bulk
   *  respects every scope. Default is transactional (safe for the existing
   *  call sites — welcome, password reset, booking confirms, partner ad-hoc
   *  compose are all transactional). Bulk campaigns must pass 'marketing'. */
  kind?:      'transactional' | 'marketing'
  tenantId?:  string | null
  partnerId?: string | null
  /** Extra MIME headers to apply on the outgoing message. Currently used by
   *  the Bulk Email engine for `List-Unsubscribe` + `List-Unsubscribe-Post`,
   *  which Gmail/Yahoo bulk-sender rules require. Provider-specific shapes
   *  are normalised inside each send function. */
  headers?:   { name: string; value: string }[]
  /** Explicit provider override. Skips the pickProvider() inference.
   *  Used by the Bulk Email engine to route cold-outreach through Brevo
   *  regardless of From-domain pattern. */
  provider?:  EmailProvider
}

export type EmailProvider = 'postmark' | 'resend' | 'brevo' | 'smtp'

export type SendResult =
  | { sent: true; provider: EmailProvider; providerMessageId?: string }
  | { sent: false; skipped: 'suppressed' | 'no_smtp' | 'no_provider'; reason?: string }

/**
 * Pick which provider should handle a given send.
 *
 * Phase F.4 routing:
 *   1. kind=transactional (or unset)            → Postmark — best deliverability
 *      for password resets, booking confirms, welcome, partner ad-hoc.
 *   2. From-domain @myorbisresults.com           → Brevo — partner sends + the
 *      domain Resend's free tier doesn't cover.
 *   3. From-domain @myorbisvoice.com (marketing) → Resend — the verified domain
 *      Resend already owns.
 *   4. Anything else                             → SMTP — local Postfix relay.
 *
 * Provider failures fall back to SMTP at the caller layer.
 */
function pickProvider(opts: EmailOptions): EmailProvider {
  // Explicit override wins. Used by the Bulk Email engine to force cold
  // outreach through Brevo regardless of the From-domain pattern.
  if (opts.provider) return opts.provider
  const fromAddr = (opts.from ?? '').toLowerCase()
  // Route by verified From-domain FIRST — even for transactional. @myorbisresults.com
  // is verified on Brevo, NOT Postmark. If a partner's <slug>@myorbisresults.com send
  // went to Postmark it would be rejected (unverified From) and fall back to SMTP /
  // Spacemail, which greylists = a multi-minute delay. Partners send these while on
  // the phone and need the recipient to confirm receipt instantly, so keep it on the
  // instant hosted provider that actually owns the domain.
  if (fromAddr.includes('@myorbisresults.com')) return 'brevo'
  // @myorbisvoice.com is verified on Resend, NOT Postmark. Route it by domain
  // BEFORE the kind default — otherwise transactional (kind==null) sends short-
  // circuit to Postmark, which rejects the unverified From and silently falls
  // back to local Postfix (Gmail spams/drops it). This was why demo booking
  // confirmations never arrived. Domain ownership wins over the kind default.
  if (fromAddr.includes('@myorbisvoice.com'))   return 'resend'
  if (opts.kind === 'transactional' || opts.kind == null) return 'postmark'
  return 'smtp'  // default for unknown marketing domains
}

const POSTMARK_API = 'https://api.postmarkapp.com'
const RESEND_API   = 'https://api.resend.com'
const BREVO_API    = 'https://api.brevo.com/v3'

/** Postmark email send. Returns the MessageID so webhook events can later
 *  match back to the MessageLog row. Falls back to throwing on non-2xx so the
 *  caller can route to SMTP. */
async function sendViaPostmark(opts: EmailOptions): Promise<{ providerMessageId: string }> {
  // getConfigValue already decrypts secret rows — the token here is plaintext.
  // (A previous bug decrypted a second time, which threw "Invalid ciphertext
  // format" on every send and silently forced the SMTP fallback.)
  const token = await systemConfig.getConfigValue('email.postmark.server_token')
  if (!token) throw new Error('postmark token unset')

  const res = await fetch(`${POSTMARK_API}/email`, {
    method:  'POST',
    headers: {
      'Accept':                  'application/json',
      'Content-Type':            'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From:          opts.from ?? 'notify@myorbisvoice.com',
      To:            opts.to,
      Subject:       opts.subject,
      HtmlBody:      opts.html,
      TextBody:      opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
      ReplyTo:       opts.replyTo,
      MessageStream: 'outbound',
      // Postmark accepts arbitrary MIME headers via a Headers array — used
      // for List-Unsubscribe etc. on the rare marketing/bulk send that goes
      // through postmark.
      Headers:       opts.headers?.map(h => ({ Name: h.name, Value: h.value })),
    }),
  })
  const body = await res.json() as { MessageID?: string; ErrorCode?: number; Message?: string }
  if (!res.ok || body.ErrorCode) {
    throw new Error(`postmark ${res.status}: ${body.Message ?? 'unknown error'}`)
  }
  return { providerMessageId: body.MessageID ?? '' }
}

/** Resend email send. Same contract as Postmark — returns id, throws on
 *  non-2xx. */
async function sendViaResend(opts: EmailOptions): Promise<{ providerMessageId: string }> {
  // getConfigValue already decrypts secret rows — key is plaintext here.
  const key = await systemConfig.getConfigValue('email.resend.api_key')
  if (!key) throw new Error('resend api_key unset')

  const res = await fetch(`${RESEND_API}/emails`, {
    method:  'POST',
    headers: {
      'Accept':        'application/json',
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      from:     opts.from ?? 'notify@myorbisvoice.com',
      to:       opts.to,
      subject:  opts.subject,
      html:     opts.html,
      text:     opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
      reply_to: opts.replyTo,
      // Resend supports custom MIME headers — used for List-Unsubscribe etc.
      headers:  opts.headers
        ? Object.fromEntries(opts.headers.map(h => [h.name, h.value]))
        : undefined,
    }),
  })
  const body = await res.json() as { id?: string; statusCode?: number; message?: string }
  if (!res.ok || body.statusCode) {
    throw new Error(`resend ${res.status}: ${body.message ?? 'unknown error'}`)
  }
  return { providerMessageId: body.id ?? '' }
}

/** Brevo email send. The "messageId" comes back as an SMTP message-id with
 *  angle brackets — we strip them for consistency with what our webhook
 *  handler stores (it strips on receive). */
async function sendViaBrevo(opts: EmailOptions): Promise<{ providerMessageId: string }> {
  // getConfigValue already decrypts secret rows — key is plaintext here.
  const key = await systemConfig.getConfigValue('email.brevo.api_key')
  if (!key) throw new Error('brevo api_key unset')

  // Brevo wants sender as {name, email}; parse "Display <addr@x>" or use raw.
  const from = opts.from ?? 'noreply@myorbisresults.com'
  const m = from.match(/^"?([^"<]+?)"?\s*<(.+?)>$/)
  const sender = m
    ? { name: m[1]!.trim(), email: m[2]!.trim() }
    : { email: from.trim() }

  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method:  'POST',
    headers: {
      'Accept':       'application/json',
      'Content-Type': 'application/json',
      'api-key':      key,
    },
    body: JSON.stringify({
      sender,
      to:           [{ email: opts.to }],
      subject:      opts.subject,
      htmlContent:  opts.html,
      textContent:  opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
      replyTo:      opts.replyTo ? { email: opts.replyTo } : undefined,
      // Brevo accepts a `headers` map for custom MIME — used for
      // List-Unsubscribe / List-Unsubscribe-Post on Bulk Email cold sends.
      headers:      opts.headers
        ? Object.fromEntries(opts.headers.map(h => [h.name, h.value]))
        : undefined,
    }),
  })
  const body = await res.json() as { messageId?: string; code?: string; message?: string }
  if (!res.ok || body.code) {
    throw new Error(`brevo ${res.status}: ${body.message ?? 'unknown error'}`)
  }
  return { providerMessageId: (body.messageId ?? '').replace(/^<|>$/g, '') }
}

/** Local Postfix / authenticated SMTP fallback. Returns empty id (no upstream
 *  to dedupe against) — callers wanting webhook correlation should use an ESP. */
async function sendViaSmtp(opts: EmailOptions): Promise<{ providerMessageId: string }> {
  const config = await getTransporter()
  if (!config) throw new Error('smtp not configured')
  const info = await config.transporter.sendMail({
    from:      opts.from ?? config.from,
    to:        opts.to,
    subject:   opts.subject,
    html:      opts.html,
    text:      opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    replyTo:   opts.replyTo,
    inReplyTo: opts.inReplyTo,
    // nodemailer accepts a plain object map for custom MIME headers — used
    // for List-Unsubscribe etc. on any send that explicitly attaches them.
    headers:   opts.headers
      ? Object.fromEntries(opts.headers.map(h => [h.name, h.value]))
      : undefined,
  })
  // nodemailer's `messageId` is the rfc822 Message-Id; strip angle brackets
  // to match how the Brevo webhook normalizes incoming ids.
  return { providerMessageId: (info.messageId ?? '').replace(/^<|>$/g, '') }
}

export async function sendEmail(opts: EmailOptions): Promise<SendResult> {
  // Phase F.4 — short-circuit on the suppression list before touching the
  // transport. Done first so we don't spend an SMTP/ESP round-trip on a known
  // dead/complained address. Defaults: kind=transactional, no scope — which
  // still triggers a global hard-bounce check. Bulk campaigns must pass kind
  // = 'marketing' + the relevant tenantId/partnerId.
  const { checkSuppression } = await import('./email-suppression.service.js')
  const supp = await checkSuppression({
    email:     opts.to,
    kind:      opts.kind ?? 'transactional',
    tenantId:  opts.tenantId  ?? null,
    partnerId: opts.partnerId ?? null,
  })
  if (supp.suppressed) {
    console.warn(`[email] suppressed (${supp.scope}/${supp.reason}) — skipping send to ${opts.to}`)
    return { sent: false, skipped: 'suppressed', reason: `${supp.scope}:${supp.reason}` }
  }

  // Default Reply-To from config when the caller didn't set one. Our default
  // From (notify@myorbisvoice.com) is a no-reply alias with no inbox — without
  // a Reply-To, customer replies to password resets / confirmations bounce.
  if (!opts.replyTo) {
    const rt = await systemConfig.getConfigValue('smtp_reply_to')
    if (rt) opts = { ...opts, replyTo: rt }
  }

  // Route to the right provider. On provider failure, fall back to SMTP so a
  // misconfigured ESP doesn't take down the whole transactional flow.
  const chosen = pickProvider(opts)
  const sendFor: Record<EmailProvider, () => Promise<{ providerMessageId: string }>> = {
    postmark: () => sendViaPostmark(opts),
    resend:   () => sendViaResend(opts),
    brevo:    () => sendViaBrevo(opts),
    smtp:     () => sendViaSmtp(opts),
  }

  try {
    const out = await sendFor[chosen]()
    return { sent: true, provider: chosen, providerMessageId: out.providerMessageId || undefined }
  } catch (err) {
    console.warn(`[email] ${chosen} send failed for ${opts.to}: ${(err as Error).message} — falling back to SMTP`)
    if (chosen === 'smtp') {
      return { sent: false, skipped: 'no_smtp', reason: (err as Error).message }
    }
    try {
      const out = await sendViaSmtp(opts)
      return { sent: true, provider: 'smtp', providerMessageId: out.providerMessageId || undefined }
    } catch (smtpErr) {
      return { sent: false, skipped: 'no_provider', reason: `${chosen}: ${(err as Error).message}; smtp: ${(smtpErr as Error).message}` }
    }
  }
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
}): Promise<SendResult> {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi there,'

  return sendEmail({
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

// ── MyOrbisAgents custom-demo delivery email (bilingual EN + ES) ──────────────
// Sent to a prospected real-estate agent with a live Orby demo loaded with their
// own 3 listings + the launch promo. From @myorbisresults.com so it routes to
// Brevo (the inboxing path). Agent-facing → both languages ship in one email.
const TEAL_EMAIL = '#15A8A8'

export async function sendAgentDemoEmail(opts: {
  to: string
  agentName: string
  micrositeUrl: string
  claimUrl: string
  demoPhone: string   // E.164
  pin: string
  planName: string    // 'Solo Capture' | 'Solo Power' (English, allow-listed)
  listings: Array<{ address: string; headline: string | null; priceUsd: number | null; highlights: string[] }>
}): Promise<SendResult> {
  const phoneDigits = opts.demoPhone.replace(/\D/g, '')
  const phoneDisplay = phoneDigits.length === 11
    ? `(${phoneDigits.slice(1, 4)}) ${phoneDigits.slice(4, 7)}-${phoneDigits.slice(7)}`
    : opts.demoPhone
  const first = opts.agentName.split(/\s+/)[0] || opts.agentName
  const money = (n: number | null) => (n == null ? '' : ` — $${n.toLocaleString('en-US')}`)

  const listingRows = opts.listings.map(l => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee">
      <strong style="color:#0f1720">${l.headline || l.address}</strong>${money(l.priceUsd)}
      ${l.highlights.length ? `<div style="color:#516170;font-size:12px;margin-top:2px">${l.highlights.slice(0, 4).join(' · ')}</div>` : ''}
    </td></tr>`).join('')

  const link = (href: string, label: string) =>
    `<a href="${href}" style="color:${TEAL_EMAIL};font-weight:700;text-decoration:underline">${label}</a>`

  // Kept plain and transactional (no promo box, no CTA buttons) so it lands in
  // the primary inbox instead of Gmail's Promotions tab. Routing is caller-ID
  // only (the demo binds the agent's Orby at connect time), so no PIN.
  const block = (L: {
    hi: string; lede: string; listingsH: string;
    callH: string; callBody: string; promo: string; claimLink: string
  }) => `
    <p style="font-size:15px;color:#0f1720">${L.hi}</p>
    <p style="font-size:15px;color:#516170">${L.lede}</p>
    <h3 style="font-size:14px;color:#0f1720;margin:22px 0 6px">${L.listingsH}</h3>
    <table style="width:100%;border-collapse:collapse">${listingRows}</table>
    <h3 style="font-size:14px;color:#0f1720;margin:22px 0 6px">📞 ${L.callH}</h3>
    <p style="font-size:14px;color:#516170;margin:0 0 4px">${L.callBody}</p>
    <p style="font-size:16px;margin:0"><a href="tel:${opts.demoPhone}" style="color:${TEAL_EMAIL};font-weight:700;text-decoration:none">${phoneDisplay}</a></p>
    <p style="font-size:14px;color:#0f1720;margin:22px 0 0">${L.promo} ${link(opts.claimUrl, L.claimLink)}</p>`

  const en = block({
    hi: `Hi ${first},`,
    lede: `I built you a live demo of Orby — an AI assistant that answers your buyers 24/7, already loaded with your listings below.`,
    listingsH: `Listings Orby already knows:`,
    callH: `Call Orby`,
    callBody: `Call from the phone number you gave us and Orby answers as your assistant — knowing your name and these listings.`,
    promo: `<strong>Launch offer:</strong> 50% off your monthly plan — Solo Capture or Solo Power — for a full year, plus $250 setup.`,
    claimLink: `Get Orby for your business →`,
  })
  const es = block({
    hi: `Hola ${first}:`,
    lede: `Te preparé una demo en vivo de Orby — un asistente de IA que responde a tus compradores 24/7, ya cargado con tus propiedades abajo.`,
    listingsH: `Propiedades que Orby ya conoce:`,
    callH: `Llama a Orby`,
    callBody: `Llama desde el número de teléfono que nos diste y Orby contesta como tu asistente — con tu nombre y estas propiedades.`,
    promo: `<strong>Oferta de lanzamiento:</strong> 50% de descuento en tu plan mensual — Solo Capture o Solo Power — por un año completo, más $250 de instalación.`,
    claimLink: `Consigue Orby para tu negocio →`,
  })

  return sendEmail({
    to: opts.to,
    from: `"MyOrbisAgents" <notify@myorbisresults.com>`,
    subject: `${first}, meet Orby — your AI assistant, live on your listings`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f1720;line-height:1.5">
        <div style="border-bottom:2px solid ${TEAL_EMAIL};padding-bottom:10px;margin-bottom:18px">
          <span style="font-size:18px;font-weight:800;color:${TEAL_EMAIL}">MyOrbisAgents</span>
        </div>
        ${en}
        <div style="border-top:1px dashed #cbd5e1;margin:30px 0 22px;text-align:center;color:#94a3b8;font-size:12px">— Español —</div>
        ${es}
        <p style="color:#94a3b8;font-size:11px;margin-top:26px;border-top:1px solid #eee;padding-top:14px">MyOrbisAgents · a product of MyOrbisResults</p>
      </div>
    `,
  })
}
