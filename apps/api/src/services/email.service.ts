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
  // @myorbisvoice.com → Resend (transactional: booking confirmations, resets,
  // notifications). Resend is transactional-first, tracking off by default.
  // History (so nobody re-flips this blindly): this briefly pointed at Postmark
  // because myorbisvoice.com was verified there — but that Postmark account got
  // HELD (accepts sends, delivers nothing, no dashboard access), which is why
  // confirmations silently died. Resend was re-keyed 2026-07-18 and
  // myorbisvoice.com verified there (probed: a live send from it returns 200).
  if (fromAddr.includes('@myorbisvoice.com'))   return 'resend'
  // @myorbisagents.com → Postmark. Deliberately NOT Resend: the Resend API key on
  // this account is currently rejected ("API key is invalid"), so every Resend send
  // throws and silently falls back to local Postfix (= spam). Postmark's token is
  // verified working, it is transactional-first (best Primary placement), and it
  // supports per-send tracking-off (see sendViaPostmark) rather than a dashboard
  // toggle. This is also the only routing that makes the sender domain match the
  // link domain (app.myorbisagents.com).
  // REQUIRES: myorbisagents.com verified on Postmark (DKIM published +
  // include:spf.mtasv.net in SPF) — until then Postmark rejects the unverified From.
  if (fromAddr.includes('@myorbisagents.com'))  return 'postmark'
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
      // Tracking OFF, explicitly. Postmark is our TRANSACTIONAL path; open-pixels
      // and click-rewriting are two of the strongest Gmail Promotions signals, and
      // a rewritten href also makes the link point at a tracking host instead of
      // our own domain. Previously these were unset, so every send silently
      // inherited whatever the Postmark server default happened to be. Marketing
      // sends that DO want tracking go through Brevo (provider: 'brevo').
      TrackOpens:    false,
      TrackLinks:    'None',
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

// ── Lead / booking notifications (bilingual EN/ES) ───────────────────────────
// Fired when Orby captures a callback lead or books an appointment. Two
// audiences: the BUSINESS OWNER (fallbackNotificationEmail — "you have a new
// lead / booking") and the CALLER (a written confirmation of what happens next).
// Routed through sendEmail() so they go out on the real ESP (Resend), NOT the
// gateway's unconfigured SMTP path — the reason owners were getting nothing.

const TEAL = '#1a9898'
function esc(s?: string | null): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
function detailRow(label: string, value?: string | null): string {
  if (!value) return ''
  return `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="color:#222">${esc(value)}</td></tr>`
}

/** Business-owner alert: a new callback lead was captured on a call. */
export async function sendCallbackOwnerNotification(opts: {
  to: string
  tenantId: string
  tenantName: string
  callerName?: string | null
  callerPhone?: string | null
  address?: string | null
  problem?: string | null
  urgency?: string | null
  appBaseUrl: string
  locale?: string
}): Promise<SendResult> {
  const es = (opts.locale ?? 'en').toLowerCase().startsWith('es')
  const isUrgent = (opts.urgency ?? '').toUpperCase() === 'EMERGENCY'
  const t = es
    ? { subj: 'Nueva solicitud de llamada', h: 'Nueva solicitud de llamada', urgent: '🚨 URGENTE', name: 'Nombre', phone: 'Teléfono', addr: 'Dirección', prob: 'Problema', cta: 'Ver en MyOrbisVoice →', foot: 'Administra las notificaciones en la configuración de tu espacio.' }
    : { subj: 'New callback request', h: 'New callback request', urgent: '🚨 URGENT', name: 'Name', phone: 'Phone', addr: 'Address', prob: 'Problem', cta: 'View in MyOrbisVoice →', foot: 'Manage notifications in your workspace settings.' }
  return sendEmail({
    to: opts.to,
    tenantId: opts.tenantId,
    subject: `${isUrgent ? t.urgent + ' — ' : ''}${t.subj}${opts.callerName ? ` — ${opts.callerName}` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:${isUrgent ? '#dc2626' : TEAL};margin-bottom:4px">${isUrgent ? t.urgent + ' · ' : ''}${t.h}</h2>
        <p style="color:#666;margin-top:0">${esc(opts.tenantName)}</p>
        <table style="border-collapse:collapse;margin:16px 0">
          ${detailRow(t.name, opts.callerName)}
          ${detailRow(t.phone, opts.callerPhone)}
          ${detailRow(t.addr, opts.address)}
          ${detailRow(t.prob, opts.problem)}
        </table>
        <a href="${opts.appBaseUrl}/conversations" style="display:inline-block;background:${TEAL};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">${t.cta}</a>
        <p style="color:#bbb;font-size:11px;margin-top:24px">MyOrbisVoice · ${t.foot}</p>
      </div>`,
  })
}

/** Caller-facing written confirmation that a callback is on its way. */
export async function sendCallbackCallerConfirmation(opts: {
  to: string
  tenantId: string
  tenantName: string
  who: string
  whenPhrase: string
  locale?: string
}): Promise<SendResult> {
  const es = (opts.locale ?? 'en').toLowerCase().startsWith('es')
  const t = es
    ? { subj: `Recibimos tu solicitud — ${opts.tenantName}`, h: 'Recibimos tu solicitud', body: `Gracias por llamar a ${esc(opts.tenantName)}. ${esc(opts.who)} te devolverá la llamada ${esc(opts.whenPhrase)}.`, ps: 'Si necesitas agregar algo, responde a este correo o vuelve a llamarnos en cualquier momento.', foot: 'Confirmación enviada por MyOrbisVoice en nombre de este negocio.' }
    : { subj: `We got your request — ${opts.tenantName}`, h: 'We got your request', body: `Thanks for calling ${esc(opts.tenantName)}. ${esc(opts.who)} will call you back ${esc(opts.whenPhrase)}.`, ps: 'Need to add anything? Just reply to this email or call us back anytime.', foot: 'Confirmation sent by MyOrbisVoice on behalf of this business.' }
  return sendEmail({
    to: opts.to,
    tenantId: opts.tenantId,
    subject: t.subj,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.55">
        <h2 style="color:${TEAL};margin-bottom:4px">${t.h} ✅</h2>
        <p style="color:#666;margin-top:0">${esc(opts.tenantName)}</p>
        <p>${t.body}</p>
        <p style="color:#555">${t.ps}</p>
        <p style="color:#bbb;font-size:11px;margin-top:24px">${t.foot}</p>
      </div>`,
  })
}

/** Business-owner alert: an appointment was booked on a call. */
export async function sendBookingOwnerNotification(opts: {
  to: string
  tenantId: string
  tenantName: string
  callerName?: string | null
  callerPhone?: string | null
  appointmentType?: string | null
  whenLabel: string
  location?: string | null
  notes?: string | null
  appBaseUrl: string
  locale?: string
}): Promise<SendResult> {
  const es = (opts.locale ?? 'en').toLowerCase().startsWith('es')
  const t = es
    ? { subj: 'Nueva cita reservada', h: 'Nueva cita reservada', name: 'Cliente', phone: 'Teléfono', type: 'Tipo', when: 'Cuándo', loc: 'Lugar', notes: 'Notas', cta: 'Ver en MyOrbisVoice →', foot: 'Administra las notificaciones en la configuración de tu espacio.' }
    : { subj: 'New appointment booked', h: 'New appointment booked', name: 'Customer', phone: 'Phone', type: 'Type', when: 'When', loc: 'Location', notes: 'Notes', cta: 'View in MyOrbisVoice →', foot: 'Manage notifications in your workspace settings.' }
  return sendEmail({
    to: opts.to,
    tenantId: opts.tenantId,
    subject: `${t.subj}${opts.callerName ? ` — ${opts.callerName}` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.5">
        <h2 style="color:${TEAL};margin-bottom:4px">${t.h} 📅</h2>
        <p style="color:#666;margin-top:0">${esc(opts.tenantName)}</p>
        <table style="border-collapse:collapse;margin:16px 0">
          ${detailRow(t.name, opts.callerName)}
          ${detailRow(t.phone, opts.callerPhone)}
          ${detailRow(t.type, opts.appointmentType)}
          ${detailRow(t.when, opts.whenLabel)}
          ${detailRow(t.loc, opts.location)}
          ${detailRow(t.notes, opts.notes)}
        </table>
        <a href="${opts.appBaseUrl}/conversations" style="display:inline-block;background:${TEAL};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">${t.cta}</a>
        <p style="color:#bbb;font-size:11px;margin-top:24px">MyOrbisVoice · ${t.foot}</p>
      </div>`,
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

/** A/B variants of the demo email. Same offer, deliberately different strategy so a
 *  test isolates WHICH ARGUMENT works, not which wording:
 *    A — control: the $40k Personal Agent Assistant price anchor.
 *    B — the founder's lost-deal story (villain = "someone answered first").
 *    C — the speed stats (78% / 917 min), then they compute their own loss.
 *  Every number is from docs/myorbisagents-brand-voice.md §5. Never invent one. */
export type DemoEmailVariant = 'A' | 'B' | 'C' | 'D'

/** Human labels for the variants — shared by the admin picker + A/B scoreboard so
 *  the copy and its name never drift apart. */
export const DEMO_VARIANT_LABELS: Record<DemoEmailVariant, string> = {
  A: '$40k assistant anchor',
  B: 'Founder lost-deal story',
  C: 'Speed stats (917 min)',
  D: 'What-if outcomes',
}

/**
 * HTML → a plain-text part a human would actually accept.
 *
 * The generic fallback in sendEmail is `html.replace(/<[^>]+>/g, '')`, which drops
 * every href (the text part ends up with ZERO urls while the HTML has four),
 * collapses <br>-joined lists onto one line, and leaves entities raw. A text/html
 * divergence that large is itself a spam signal. This keeps the links (as
 * "label (url)"), the line breaks, and decodes entities.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_m, href, label) =>
      // A bare tel: link reads better as just the number.
      String(href).startsWith('tel:') ? String(label) : `${String(label).replace(/<[^>]+>/g, '')} (${href})`)
    .replace(/<\/p>|<br\s*\/?>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Sender identity. Routing is BY DOMAIN (see pickProvider): @myorbisvoice.com →
 *  Resend, which does not pixel/rewrite by default. The old
 *  "MyOrbisAgents" <notify@myorbisresults.com> went to Brevo (a marketing platform
 *  whose transactional default injects an open-pixel and rewrites every href) AND
 *  paired a brand display-name with a `notify@` alias — both Promotions signals on
 *  an email that is signed by a person. A dedicated demo@ mailbox also isolates this
 *  stream's sending reputation from support/notify traffic.
 *  NOTE: demo@myorbisvoice.com must exist as a real mailbox — the P.S. asks for replies. */
// demo@myorbisagents.com — the sender domain now MATCHES the link domain
// (app.myorbisagents.com). Mismatched sender/link domains are a classic promo
// pattern; aligning them is worth more than any copy tweak.
//
// Verified 2026-07-13 on Postmark (which pickProvider routes @myorbisagents.com to):
//   postmark._domainkey TXT ...................... DKIM signing
//   SPF includes spf.mtasv.net ................... envelope auth
//   pm-bounces CNAME -> pm.mtasv.net (DNS-only) .. Return-Path alignment
//   _dmarc TXT p=none ............................ policy
//   MX -> spacemail + a real demo@ mailbox ....... so the P.S. "reply demo" works
// A person display-name (not a brand) on a real, reply-capable mailbox — the old
// "MyOrbisAgents" <notify@...> paired a brand with a bulk-looking alias on a note
// signed by a human.
// From is on myorbisresults.com ON PURPOSE. Two reasons:
//   1. Provider: pickProvider routes @myorbisresults.com → BREVO, and Brevo is the
//      right home for this email — it's promotional/outreach ("I built you a demo,
//      call this number"), which Postmark's transactional-only policy PROHIBITS.
//      That policy mismatch is very likely why the Postmark account got held:
//      accepts sends, delivers nothing. Brevo allows this content and delivers.
//   2. Auth: myorbisresults.com is the only sending domain authenticated on Brevo
//      today (DKIM/SPF verified). myorbisvoice.com and myorbisagents.com are not on
//      Brevo, so a From on either would be rejected there.
// The From mailbox need not receive — Reply-To points at the real
// demo@myorbisagents.com inbox, so replies (the P.S. "reply demo") reach a human.
// Known tradeoff: sender domain (myorbisresults.com) != link domain
// (app.myorbisagents.com); revisit if Gmail tabs it Promotions. "Delivered to
// Promotions" still beats "silently quarantined by a held Postmark account".
// INTERIM Primary-placement test: send via RESEND, not Brevo. Proven 2026-07-18 —
// Resend sends land in Gmail PRIMARY, Brevo sends land in PROMOTIONS (Brevo injects
// an open-pixel + rewrites links; those are the Promotions signals). Only
// myorbisvoice.com is verified on the (free, 1-domain) Resend account, so the From
// is on that domain for now — which means sender-brand (Voice) ≠ link-brand (Agents).
// The clean end state is demo@myorbisagents.com once that domain is verified on
// Resend (Pro plan = unlimited domains, or free if a 2nd domain slot exists) —
// then flip this one line and sender/link/brand all align.
const DEMO_FROM     = '"Crawford Peterson" <demo@myorbisvoice.com>'
const DEMO_REPLY_TO = 'demo@myorbisagents.com'

/** Build the demo email (subject + html + text) for a variant/locale WITHOUT
 *  sending — powers the admin "preview & pick the copy" flow. sendAgentDemoEmail
 *  is a thin wrapper so preview and the real send can never diverge. */
export function buildAgentDemoEmail(opts: {
  agentName: string
  micrositeUrl: string
  claimUrl: string
  demoPhone: string   // E.164
  pin: string
  planName: string    // 'Solo Capture' | 'Solo Power' (English, allow-listed)
  listings: Array<{ address: string; headline: string | null; priceUsd: number | null; highlights: string[]; beds?: number | null; baths?: number | null; sqft?: number | null; propertyType?: string | null }>
  /** Which argument to send. Defaults to the control. */
  variant?: DemoEmailVariant
  /** ONE language per recipient. Both are authored (bilingual rule) but sending
   *  EN+ES stacked in one body doubles the length, duplicates every link, and reads
   *  as templated broadcast — a person writing one agent writes one language. */
  locale?: 'en' | 'es'
}): { subject: string; html: string; text: string; variant: DemoEmailVariant; locale: 'en' | 'es' } {
  const variant = opts.variant ?? 'A'
  const lang    = opts.locale === 'es' ? 'es' : 'en'
  const phoneDigits = opts.demoPhone.replace(/\D/g, '')
  const phoneDisplay = phoneDigits.length === 11
    ? `(${phoneDigits.slice(1, 4)}) ${phoneDigits.slice(4, 7)}-${phoneDigits.slice(7)}`
    : opts.demoPhone
  const first = opts.agentName.split(/\s+/)[0] || opts.agentName

  // Deliberately PLAIN + personal so Gmail files it in Primary, not Promotions.
  // No brand banner, no buttons, no listings table, no offer block, one link —
  // it should read like a note from a person, because it is. `opts.listings`,
  // `opts.claimUrl`, `opts.pin`, `opts.planName` are intentionally unused here;
  // the microsite carries the listings + claim CTA + offer.
  const a = (href: string, label: string) => `<a href="${href}" style="color:${TEAL_EMAIL}">${label}</a>`
  const p = 'margin:0 0 14px;font-size:15px;color:#111;line-height:1.55'
  const n = opts.listings.length
  // Plain-text property list (address + basic details, no images/buttons/price
  // tables) so Orby's listings are referenced without turning the note into a promo.
  const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
  const num   = (v: number) => v.toLocaleString('en-US')
  const buildList = (lbl: { bd: string; ba: string; sqft: string }) =>
    !n ? '' : `<div style="${p}">${opts.listings.map(l => {
      const title = l.address || l.headline || 'Listing'
      const bits: string[] = []
      if (l.priceUsd != null) bits.push(money(l.priceUsd))
      if (l.beds  != null)    bits.push(`${l.beds} ${lbl.bd}`)
      if (l.baths != null)    bits.push(`${l.baths} ${lbl.ba}`)
      if (l.sqft  != null)    bits.push(`${num(l.sqft)} ${lbl.sqft}`)
      const detail = bits.length ? ` — ${bits.join(' · ')}` : ''
      return `• ${title}${detail}`
    }).join('<br>')}</div>`
  const propListEn = buildList({ bd: 'bd', ba: 'ba', sqft: 'sqft' })
  const propListEs = buildList({ bd: 'rec', ba: 'baños', sqft: 'sqft' })
  const listSuffixEn = n ? ` — and I already loaded her with your ${n} listing${n === 1 ? '' : 's'}:` : '.'
  const listSuffixEs = n ? ` — y ya la cargué con tus ${n} propiedad${n === 1 ? '' : 'es'}:` : '.'

  // The 3 steps are plain NUMBERED LINES, not buttons or a table — structure a
  // person would type. Buttons/tables are what push Gmail to Promotions; numbered
  // text does not. Step 2 makes them role-play their own buyer, so the proof is
  // experienced rather than claimed ("the demo brags; the copy doesn't").
  const step = 'margin:0 0 6px;font-size:15px;color:#111;line-height:1.55'
  const stepsEn = `
    <p style="${p}">Three steps, about two minutes:</p>
    <div style="${step}"><strong>1.</strong> Call ${a(`tel:${opts.demoPhone}`, phoneDisplay)} from your phone.</div>
    <div style="${step}"><strong>2.</strong> Ask about one of those listings — like a buyer would.</div>
    <div style="margin:0 0 14px;font-size:15px;color:#111;line-height:1.55"><strong>3.</strong> Let her book you a showing. Then check your email.</div>`
  const stepsEs = `
    <p style="${p}">Tres pasos, unos dos minutos:</p>
    <div style="${step}"><strong>1.</strong> Llama al ${a(`tel:${opts.demoPhone}`, phoneDisplay)} desde tu teléfono.</div>
    <div style="${step}"><strong>2.</strong> Pregunta por una de esas propiedades — como lo haría un comprador.</div>
    <div style="margin:0 0 14px;font-size:15px;color:#111;line-height:1.55"><strong>3.</strong> Deja que te agende una cita. Luego revisa tu correo.</div>`

  // Personal Agent Assistant anchor, argued at the PESSIMISTIC number ($40k, the floor of the $40-60k
  // range) so it can't be discounted away. Framed as an anchor, NOT a saving —
  // this ICP never hired an assistant, so "replaces your assistant" would sell them a
  // saving on money they never spent.
  const en = `
    <p style="${p}">Hi ${first},</p>
    <p style="${p}">I built you a live demo of Orby — an AI assistant that answers your buyer calls 24/7, qualifies them, and books the showing on your calendar${listSuffixEn}</p>
    ${propListEn}
    ${stepsEn}
    <p style="${p}">That's a buyer calling you at 8pm while you're at dinner. She answers every time.</p>
    <p style="${p}">It's a $40,000-a-year Personal Agent Assistant's entire job — the hire you were never going to make. And this is just the demo.</p>
    <p style="margin:0 0 14px;font-size:14px;color:#666;line-height:1.55">Can't call right now? It's all on your demo page too: ${a(opts.micrositeUrl, 'your Orby demo')}.</p>
    <p style="${p}">Let me know what you think.</p>`

  const es = `
    <p style="${p}">Hola ${first}:</p>
    <p style="${p}">Te preparé una demo en vivo de Orby — una asistente de IA que responde tus llamadas de compradores 24/7, los califica y agenda la cita en tu calendario${listSuffixEs}</p>
    ${propListEs}
    ${stepsEs}
    <p style="${p}">Así se oye un comprador llamándote a las 8pm mientras cenas. Ella siempre contesta.</p>
    <p style="${p}">Es el trabajo completo de un Asistente Personal de Agente de $40,000 al año — la contratación que nunca ibas a hacer. Y esto es solo la demo.</p>
    <p style="margin:0 0 14px;font-size:14px;color:#666;line-height:1.55">¿No puedes llamar ahora? También está todo en tu página de demo: ${a(opts.micrositeUrl, 'tu demo de Orby')}.</p>
    <p style="${p}">Cuéntame qué te parece.</p>`

  // ── Variant B — the founder's lost-deal story (brand-voice §7) ─────────────
  // Villain is "someone answered first", NOT lenders (picking that fight costs a
  // needed referral partner). Story earns the demo ask instead of leading with it.
  const bEn = `
    <p style="${p}">Hi ${first},</p>
    <p style="${p}">Before I built software I sold real estate in NYC. I paid to attract a buyer, got him mortgage-approved — the hottest lead of my year — and then he called while I was mid-showing. He couldn't reach me. The lender referred an agent who picked up, and that agent collected the commission I'd already paid to earn.</p>
    <p style="${p}">Not because I was lazy. Because I was one person, and the buyer called at the wrong moment.</p>
    <p style="${p}">So I built the thing that answers when I can't. Her name is Orby, and I already set up a live demo loaded with ${n || 3} of your own listings:</p>
    ${propListEn}
    <p style="${p}">Call ${a(`tel:${opts.demoPhone}`, phoneDisplay)} and ask about one — the way a buyer would. She'll answer, qualify them, and book the showing. You'd still run the showing; she just makes sure it's on your calendar.</p>
    <p style="${p}">Two minutes. Your ears will tell you more than I can.</p>`
  const bEs = `
    <p style="${p}">Hola ${first}:</p>
    <p style="${p}">Antes de crear software, vendía bienes raíces en Nueva York. Pagué por atraer a un comprador, conseguí que lo aprobaran para su hipoteca — el mejor lead de mi año — y me llamó justo cuando yo estaba mostrando otra casa. No pudo localizarme. El prestamista le recomendó a un agente que sí contestó, y ese agente se llevó la comisión que yo ya había pagado por ganar.</p>
    <p style="${p}">No fue por flojera. Fue porque yo era una sola persona, y el comprador llamó en el momento equivocado.</p>
    <p style="${p}">Así que construí lo que contesta cuando yo no puedo. Se llama Orby, y ya te preparé una demo en vivo cargada con ${n || 3} de tus propias propiedades:</p>
    ${propListEs}
    <p style="${p}">Llama al ${a(`tel:${opts.demoPhone}`, phoneDisplay)} y pregunta por una — como lo haría un comprador. Ella contesta, los califica y agenda la cita. Tú seguirías haciendo la visita; ella solo se asegura de que exista en tu calendario.</p>
    <p style="${p}">Dos minutos. Tus oídos te dirán más que yo.</p>`

  // ── Variant C — the speed stats, then they compute their own loss ──────────
  // Every figure is verbatim from the §5 data spine. The "you can't know" beat is
  // the silent-loss principle — fear of the unknown number beats any known stat.
  const cEn = `
    <p style="${p}">Hi ${first},</p>
    <p style="${p}">Two numbers from industry research: 78% of buyers hire the first agent who responds — and the average agent takes 917 minutes, over 15 hours, to respond to a new lead. 62% of leads come in after hours, when nobody's answering at all.</p>
    <p style="${p}">Every buyer who gave up on silence is a commission — roughly $10,000 on a median-priced home. How many calls went unreturned on your phone last year? You can't know. Nobody calls back to tell you they hired someone else. That unknown number is the expensive one.</p>
    <p style="${p}">I built Orby to close that gap: she answers your buyer calls in seconds, 24/7, qualifies them, and books the showing on your calendar. She doesn't sell the house — you do. She makes sure the showing exists.</p>
    <p style="${p}">Your live demo is already loaded with ${n || 3} of your listings:</p>
    ${propListEn}
    <p style="${p}">Call ${a(`tel:${opts.demoPhone}`, phoneDisplay)} and ask about one, the way a buyer would.</p>`
  const cEs = `
    <p style="${p}">Hola ${first}:</p>
    <p style="${p}">Dos números de la investigación del sector: el 78% de los compradores contrata al primer agente que responde — y el agente promedio tarda 917 minutos, más de 15 horas, en responder a un lead nuevo. El 62% de los leads llegan fuera de horario, cuando nadie contesta.</p>
    <p style="${p}">Cada comprador que se rindió ante el silencio es una comisión — unos $10,000 en una casa de precio medio. ¿Cuántas llamadas quedaron sin devolver en tu teléfono el año pasado? No puedes saberlo. Nadie te llama para avisarte que contrató a otro. Ese número desconocido es el que sale caro.</p>
    <p style="${p}">Construí a Orby para cerrar esa brecha: contesta tus llamadas de compradores en segundos, 24/7, los califica y agenda la cita en tu calendario. Ella no vende la casa — eso lo haces tú. Ella se asegura de que la cita exista.</p>
    <p style="${p}">Tu demo en vivo ya está cargada con ${n || 3} de tus propiedades:</p>
    ${propListEs}
    <p style="${p}">Llama al ${a(`tel:${opts.demoPhone}`, phoneDisplay)} y pregunta por una, como lo haría un comprador.</p>`

  // ── Variant D — future-pacing (Before-After-Bridge): 3 "what if" questions,
  // then grounded in the live demo so it doesn't float as aspiration. The 3rd
  // question carries the $40k Personal Agent Assistant anchor (pessimistic number, per Law #5). The
  // "walk into every showing knowing budget/timeline/motivation" is the "walk in
  // armed" sub-promise — provable, not an overclaim like "capture all marketing".
  const dEn = `
    <p style="${p}">Hi ${first},</p>
    <p style="${p}">Three questions — then something you can test in two minutes:</p>
    <div style="margin:0 0 6px;font-size:15px;color:#111;line-height:1.55">• What if you never missed another buyer call? Not the 8pm one, not the one that came while you were mid-showing.</div>
    <div style="margin:0 0 6px;font-size:15px;color:#111;line-height:1.55">• What if you walked into every showing already knowing the buyer's budget, timeline, and motivation?</div>
    <div style="margin:0 0 14px;font-size:15px;color:#111;line-height:1.55">• What could you close with a $40,000-a-year assistant's work — for the price of a couple of leads?</div>
    <p style="${p}">That's Orby. I already loaded her with ${n || 3} of your listings:</p>
    ${propListEn}
    <p style="${p}">Call ${a(`tel:${opts.demoPhone}`, phoneDisplay)} and ask about one, like a buyer would. She answers, qualifies, and books the showing.</p>
    <p style="${p}">It's the assistant you were never going to hire — and this is just the demo.</p>`
  const dEs = `
    <p style="${p}">Hola ${first}:</p>
    <p style="${p}">Tres preguntas — y luego algo que puedes probar en dos minutos:</p>
    <div style="margin:0 0 6px;font-size:15px;color:#111;line-height:1.55">• ¿Y si nunca más perdieras una llamada de un comprador? Ni la de las 8pm, ni la que entró mientras mostrabas otra casa.</div>
    <div style="margin:0 0 6px;font-size:15px;color:#111;line-height:1.55">• ¿Y si llegaras a cada cita ya sabiendo el presupuesto, el plazo y la motivación del comprador?</div>
    <div style="margin:0 0 14px;font-size:15px;color:#111;line-height:1.55">• ¿Cuánto podrías cerrar con el trabajo de un asistente de $40,000 al año — por el precio de un par de leads?</div>
    <p style="${p}">Eso es Orby. Ya la cargué con ${n || 3} de tus propiedades:</p>
    ${propListEs}
    <p style="${p}">Llama al ${a(`tel:${opts.demoPhone}`, phoneDisplay)} y pregunta por una, como lo haría un comprador. Ella contesta, califica y agenda la cita.</p>
    <p style="${p}">Es el asistente que nunca ibas a contratar — y esto es solo la demo.</p>`

  const signature = `<p style="${p}">— Crawford Peterson<br><span style="color:#666;font-size:14px">Founder, MyOrbisAgents</span></p>`

  // Secondary CTA is a REPLY, not a second button. Two competing buttons split the
  // click; a reply is the strongest positive signal Gmail has (it teaches the
  // filter this is Primary mail) and it opens a conversation instead of a funnel.
  // The promise stays concrete — the tasks Orby demonstrably does — rather than an
  // open-ended "we can customize anything", which the first "no" would collapse.
  const psEn = `<p style="margin:18px 0 0;font-size:14px;color:#555;line-height:1.55">P.S. Answering, qualifying, booking, the 24-hour reminder, the follow-up — that's a $40k Personal Agent Assistant's whole week. Reply "demo" and I'll show you the rest of what she takes off your plate.</p>`
  const psEs = `<p style="margin:18px 0 0;font-size:14px;color:#555;line-height:1.55">P.D. Contestar, calificar, agendar, el recordatorio de 24 horas, el seguimiento — esa es la semana completa de un Asistente Personal de Agente de $40k. Responde "demo" y te muestro todo lo demás que te quita de encima.</p>`

  // ── Variant + locale selection ────────────────────────────────────────────
  // The subject IS the switch: each variant carries its own, so a reply or a
  // reporting filter identifies the variant from the subject line alone.
  const VARIANTS: Record<DemoEmailVariant, Record<'en' | 'es', { subject: string; body: string; ps: string }>> = {
    A: {
      en: { subject: `${first}, your Orby demo (${n || 3} listings, 2 minutes)`, body: en, ps: psEn },
      es: { subject: `${first}, tu demo de Orby (${n || 3} propiedades, 2 minutos)`, body: es, ps: psEs },
    },
    B: {
      en: { subject: `The buyer I paid for hired someone else`, body: bEn, ps: psEn },
      es: { subject: `El comprador que pagué contrató a otro agente`, body: bEs, ps: psEs },
    },
    C: {
      en: { subject: `78% of buyers hire whoever answers first`, body: cEn, ps: psEn },
      es: { subject: `El 78% de los compradores contrata al primero que contesta`, body: cEs, ps: psEs },
    },
    D: {
      en: { subject: `What if you never missed another lead?`, body: dEn, ps: psEn },
      es: { subject: `¿Y si nunca más perdieras un lead?`, body: dEs, ps: psEs },
    },
  }
  const chosen = VARIANTS[variant][lang]

  // Unstyled container + a REAL text part. The old text part was
  // html.replace(/<[^>]+>/g,'') — which silently dropped every href, so the
  // text/html versions diverged wildly (a filter signal) and text-only readers
  // got the listings mashed onto one line with no phone number.
  const html = `<div dir="ltr">${chosen.body}${signature}${chosen.ps}</div>`
  const text = htmlToPlainText(html)

  return { subject: chosen.subject, html, text, variant, locale: lang }
}

/** Send the demo email. Thin wrapper over buildAgentDemoEmail so the preview a
 *  human approves and the message actually sent are byte-for-byte identical. */
export async function sendAgentDemoEmail(
  opts: Parameters<typeof buildAgentDemoEmail>[0] & { to: string },
): Promise<SendResult> {
  const built = buildAgentDemoEmail(opts)
  return sendEmail({
    to:      opts.to,
    from:    DEMO_FROM,
    replyTo: DEMO_REPLY_TO,
    subject: built.subject,
    html:    built.html,
    text:    built.text,
  })
}
