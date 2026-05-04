/**
 * Gemini Live tool-calling registry.
 *
 * Each tool has:
 *  - a Gemini-compatible JSON schema (declared on the live session at setup time)
 *  - a handler function that the gateway invokes when the model emits a
 *    tool_call. Handlers are tenant-scoped — `ctx.tenantId` is fixed at
 *    session start (from the Twilio number / widget session token), so the
 *    model cannot escape its tenant by passing one as a tool argument.
 *
 * Handlers call internal HTTP endpoints on the API service. This keeps
 * business logic (booking, email, audit logging) in one place — the API —
 * while the gateway stays focused on real-time audio.
 *
 * Errors: every handler returns either { ok: true, ... } or { ok: false, error }
 * — never throws to the caller. The Gemini Live session converts the result
 * into a tool_response message; the model uses the result text to either
 * continue or recover gracefully ("I had trouble booking that, let me try
 * again with a different time").
 */

export type ToolContext = {
  tenantId:        string
  conversationId?: string  // when known (widget); inbound uses externalCallId instead
  externalCallId?: string  // Twilio CallSid for inbound/outbound
}

export type ToolResult = Record<string, unknown>

// --- Gemini function-declaration schemas -------------------------------------

// Gemini Live's tool schema mirrors the OpenAPI subset Google supports.
// `type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY'`
// (uppercase per Google's spec).
export const TOOL_DECLARATIONS = [
  {
    name: 'book_appointment',
    description:
      'Book an appointment on the business calendar after the caller has confirmed a specific date, time, and duration. ' +
      'Only call this once you have explicit verbal agreement on the slot AND have collected the caller\'s name and either phone number or email. ' +
      'Returns the appointment id on success.',
    parameters: {
      type: 'OBJECT',
      properties: {
        starts_at_iso: {
          type: 'STRING',
          description: 'Appointment start time in full ISO 8601 format with timezone offset, e.g. "2026-05-10T14:00:00-04:00".',
        },
        duration_minutes: {
          type: 'INTEGER',
          description: 'Length of the appointment in minutes (typically 30 or 60).',
        },
        contact_phone_or_email: {
          type: 'STRING',
          description: 'Caller\'s phone number (E.164 preferred, e.g. "+15551234567") or email address. Used to look up or attach the contact record.',
        },
        notes: {
          type: 'STRING',
          description: 'Brief notes about what the appointment is for. Keep under 200 characters.',
        },
        appointment_type: {
          type: 'STRING',
          description: 'Short label for the appointment type, e.g. "Consultation", "Service call". Optional.',
        },
        timezone: {
          type: 'STRING',
          description: 'IANA timezone for the appointment, e.g. "America/New_York". Optional — defaults to UTC if omitted but you should infer from the business or caller location.',
        },
      },
      required: ['starts_at_iso', 'duration_minutes', 'contact_phone_or_email'],
    },
  },
  {
    name: 'send_followup_email',
    description:
      'Send a follow-up email to a contact from the business\'s connected Gmail account. ' +
      'Use this when the caller asks for a recap, confirmation, or details to be sent in writing. ' +
      'Do not invent an email address — only call this if the caller has explicitly given you an address or you have one on file via lookup_contact.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id_or_phone: {
          type: 'STRING',
          description: 'Contact id (UUID) from a prior lookup_contact call, OR the caller\'s phone number (E.164), OR the email address itself.',
        },
        subject: {
          type: 'STRING',
          description: 'Email subject line. Keep concise and clear.',
        },
        body: {
          type: 'STRING',
          description: 'Plain-text email body. Write it in the voice and style of the business. Keep it short and useful.',
        },
      },
      required: ['contact_id_or_phone', 'subject', 'body'],
    },
  },
  {
    name: 'lookup_contact',
    description:
      'Search for an existing contact by phone number, email, or name. ' +
      'Call this early in the conversation if the caller mentions they have spoken with the business before, ' +
      'or before sending an email / booking, to avoid creating a duplicate.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Phone number, email, or partial name. Phone numbers can be in any common format.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'record_disposition',
    description:
      'Record the outcome of this call so the business can review it later. ' +
      'Call this near the end of the conversation, after the caller\'s reason for calling has been resolved (or it\'s clear it cannot be). ' +
      'Pick the single best matching outcome code.',
    parameters: {
      type: 'OBJECT',
      properties: {
        outcome_code: {
          type: 'STRING',
          description:
            'One of: BOOKED (appointment scheduled), QUALIFIED_LEAD (interested, follow-up needed), ' +
            'NOT_QUALIFIED (not a fit), INFO_REQUEST (provided info, no action), COMPLAINT (issue raised), ' +
            'CALLBACK_REQUESTED (caller asked to be called back), WRONG_NUMBER, SPAM, NO_ACTION (call ended without resolution).',
        },
        notes: {
          type: 'STRING',
          description: 'Optional one-line note adding context to the disposition.',
        },
      },
      required: ['outcome_code'],
    },
  },
] as const

export type ToolName = (typeof TOOL_DECLARATIONS)[number]['name']

// --- HTTP client to internal API endpoints ----------------------------------

const API_BASE = (process.env['API_BASE_URL'] ?? 'http://localhost:4000').replace(/\/$/, '')
const INTERNAL_TOKEN = process.env['GATEWAY_INTERNAL_TOKEN'] ?? ''

async function callApi<T = unknown>(
  path: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!INTERNAL_TOKEN) {
    return { ok: false, error: 'GATEWAY_INTERNAL_TOKEN not configured' }
  }
  const url = `${API_BASE}${path}`
  // 8s ceiling — we'd rather tell the model "that timed out, try again" than
  // hold the call audio thread waiting on a backend stall.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':              'application/json',
        'x-internal-gateway-token':  INTERNAL_TOKEN,
        'x-internal-tenant-id':      tenantId,
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed: any
    try { parsed = text ? JSON.parse(text) : {} } catch { parsed = { raw: text } }

    if (!res.ok) {
      const msg = parsed?.errors?.[0]?.message ?? parsed?.error ?? `API ${res.status}`
      return { ok: false, error: typeof msg === 'string' ? msg : `API ${res.status}` }
    }
    return { ok: true, data: (parsed?.data ?? parsed) as T }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'API request timed out' }
    }
    return { ok: false, error: (err as Error).message ?? 'API request failed' }
  } finally {
    clearTimeout(timer)
  }
}

// --- Handlers ---------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>

const handlers: Record<ToolName, ToolHandler> = {
  async book_appointment(args, ctx) {
    const startsAtIso     = String(args['starts_at_iso']           ?? '').trim()
    const durationMinutes = Number(args['duration_minutes']        ?? 0)
    const contactQuery    = String(args['contact_phone_or_email']  ?? '').trim()
    const notes           = args['notes']            ? String(args['notes'])            : undefined
    const appointmentType = args['appointment_type'] ? String(args['appointment_type']) : undefined
    const timezone        = args['timezone']         ? String(args['timezone'])         : undefined

    if (!startsAtIso || !durationMinutes || !contactQuery) {
      return { ok: false, error: 'starts_at_iso, duration_minutes, and contact_phone_or_email are required' }
    }

    const result = await callApi<{ ok: boolean; appointmentId: string; startAt: string; endAt: string }>(
      '/api/internal/gateway/tools/book-appointment',
      ctx.tenantId,
      {
        startsAtIso,
        durationMinutes,
        contactQuery,
        notes,
        appointmentType,
        timezone,
        conversationId: ctx.conversationId,
      },
    )
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok: true,
      appointment_id: result.data.appointmentId,
      starts_at:      result.data.startAt,
      ends_at:        result.data.endAt,
      message:        'Appointment booked. A confirmation email has been sent if an email was on file.',
    }
  },

  async send_followup_email(args, ctx) {
    const contactQuery = String(args['contact_id_or_phone'] ?? '').trim()
    const subject      = String(args['subject']             ?? '').trim()
    const body         = String(args['body']                ?? '').trim()

    if (!contactQuery || !subject || !body) {
      return { ok: false, error: 'contact_id_or_phone, subject, and body are required' }
    }

    const result = await callApi<{ ok: boolean; sentTo: string }>(
      '/api/internal/gateway/tools/send-followup-email',
      ctx.tenantId,
      { contactQuery, subject, body, isHtml: false },
    )
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok:      true,
      sent_to: result.data.sentTo,
      message: `Email sent to ${result.data.sentTo}.`,
    }
  },

  async lookup_contact(args, ctx) {
    const query = String(args['query'] ?? '').trim()
    if (!query) return { ok: false, error: 'query is required' }

    type LookupResp =
      | { found: false }
      | { found: true; contact: { id: string; fullName: string | null; firstName: string | null; lastName: string | null; email: string | null; phoneE164: string | null } }

    const result = await callApi<LookupResp>(
      '/api/internal/gateway/tools/lookup-contact',
      ctx.tenantId,
      { query },
    )
    if (!result.ok) return { ok: false, error: result.error }
    if (!result.data.found) return { ok: true, found: false, message: 'No contact matched that query.' }
    return { ok: true, found: true, contact: result.data.contact }
  },

  async record_disposition(args, ctx) {
    const outcomeCode = String(args['outcome_code'] ?? '').trim().toUpperCase()
    const notes       = args['notes'] ? String(args['notes']) : undefined
    if (!outcomeCode) return { ok: false, error: 'outcome_code is required' }

    const result = await callApi<{ ok: boolean; conversationId: string }>(
      '/api/internal/gateway/tools/record-disposition',
      ctx.tenantId,
      {
        conversationId: ctx.conversationId,
        externalCallId: ctx.externalCallId,
        outcomeCode,
        notes,
      },
    )
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, conversation_id: result.data.conversationId, message: `Disposition recorded as ${outcomeCode}.` }
  },
}

// --- Public dispatcher -------------------------------------------------------

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const handler = (handlers as Record<string, ToolHandler | undefined>)[name]
  if (!handler) {
    return { ok: false, error: `Unknown tool: ${name}` }
  }
  try {
    return await handler(args, ctx)
  } catch (err) {
    console.error(`[tools] handler for ${name} threw:`, err)
    return { ok: false, error: (err as Error).message ?? 'Internal tool error' }
  }
}

// Short, model-friendly description block injected into the system prompt so
// the model knows when each tool is appropriate. Kept brief — full schemas
// already give the model the parameter contracts.
export function buildToolGuidanceBlock(): string {
  return [
    '--- Tools available ---',
    'You have four tools you may call during this conversation. Use them when appropriate; do not announce them.',
    '',
    '1. lookup_contact(query) — Search for an existing customer by phone, email, or name. Call this when the caller says they\'ve interacted with the business before, before booking, or before sending an email.',
    '2. book_appointment(starts_at_iso, duration_minutes, contact_phone_or_email, notes?, appointment_type?, timezone?) — Book on the business calendar. Only call AFTER you have explicit confirmation of date, time, duration, and a way to identify the contact (phone or email).',
    '3. send_followup_email(contact_id_or_phone, subject, body) — Send a follow-up email from the business\'s Gmail. Only call when the caller asks for something in writing. Never invent an email address.',
    '4. record_disposition(outcome_code, notes?) — Record the call outcome near the end of the conversation. Allowed codes: BOOKED, QUALIFIED_LEAD, NOT_QUALIFIED, INFO_REQUEST, COMPLAINT, CALLBACK_REQUESTED, WRONG_NUMBER, SPAM, NO_ACTION.',
    '',
    'Rules:',
    '- Confirm details verbally before any write tool (book_appointment, send_followup_email).',
    '- If a tool returns an error, briefly tell the caller you had trouble and either retry or note it for human follow-up.',
    '- Always call record_disposition once before the call ends.',
  ].join('\n')
}
