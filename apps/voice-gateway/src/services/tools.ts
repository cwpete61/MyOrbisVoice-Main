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
  // Populated for inbound/outbound voice sessions. Required by the
  // hangup_call tool — it POSTs Status=completed to Twilio for this call.
  // Widget sessions leave these undefined; hangup_call gracefully fails
  // there because there is no Twilio call to terminate.
  callSid?:         string
  ownerAccountSid?: string | null
}

export type ToolResult = Record<string, unknown>

// --- Gemini function-declaration schemas -------------------------------------

// Gemini Live's tool schema mirrors the OpenAPI subset Google supports.
// `type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY'`
// (uppercase per Google's spec).
export const TOOL_DECLARATIONS = [
  {
    name: 'search_availability',
    description:
      'Search for open appointment slots on the business calendar within a date/time range. ' +
      'Call this BEFORE book_appointment to confirm a slot is actually available. ' +
      'Returns up to 5 open slots; offer them to the caller and let them pick one.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from_iso: {
          type: 'STRING',
          description: 'Start of the search window in ISO 8601 with timezone, e.g. "2026-05-10T09:00:00-04:00".',
        },
        to_iso: {
          type: 'STRING',
          description: 'End of the search window in ISO 8601 with timezone. Search at most a 7-day range to keep results focused.',
        },
        duration_minutes: {
          type: 'INTEGER',
          description: 'Length of the appointment the caller wants in minutes (typically 30 or 60).',
        },
      },
      required: ['from_iso', 'to_iso', 'duration_minutes'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Book an appointment on the business calendar after the caller has confirmed a specific date, time, and duration. ' +
      'Only call this once you have explicit verbal agreement on the slot AND have collected the caller\'s name and either phone number or email. ' +
      'CRITICAL: this tool is the ONLY thing that actually creates the appointment and sends the confirmation. ' +
      'You MUST call it and wait for a success result before you tell the caller the appointment is booked or that a confirmation will be sent. ' +
      'Saying "I have booked your appointment" or "you will get a confirmation email" WITHOUT calling this tool and receiving success is a failure — the caller will NOT be booked and will NOT be contacted. ' +
      'If the tool returns an error, tell the caller you could not complete the booking and try again or offer to follow up; never claim success you did not get. ' +
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
      'or before sending an email / booking, to avoid creating a duplicate. ' +
      'When a match is found the response also includes a `historyPrompt` field — ' +
      'a pre-formatted block of the caller\'s prior conversations, recent appointments, and CRM facts (name on file, customer since, etc). ' +
      'Use that history naturally to make the caller feel remembered ' +
      '(e.g. "Welcome back — I see we got you in for a cleaning back in March"), but do NOT bring up sensitive personal facts ' +
      '(spouse, kids, anniversaries) unless the caller raises them first. Never claim to remember details that are not in the history block.',
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
    name: 'save_contact',
    description:
      'Save the caller\'s details (full name, phone, email) to the contact database. ' +
      'Call this once you have collected the caller\'s full name AND phone AND email. ' +
      'Always pass everything you have — never skip a field you collected. ' +
      'This is what feeds the campaign system, so it is required for every call where the caller stays on the line long enough to share contact info. ' +
      'Safe to call multiple times: it upserts, so additional info enriches the existing record.',
    parameters: {
      type: 'OBJECT',
      properties: {
        full_name: {
          type: 'STRING',
          description: 'The caller\'s full name as stated. E.g. "Crawford Peterson".',
        },
        phone_e164: {
          type: 'STRING',
          description: 'Phone number in E.164 format if possible (e.g. "+14045551234"). If the caller gave a 10-digit US number, you may pass it as digits.',
        },
        email: {
          type: 'STRING',
          description: 'Email address as spoken (e.g. "alex@example.com"). Confirm spelling back to the caller before saving if unsure.',
        },
        notes: {
          type: 'STRING',
          description: 'Optional one-line note about why this contact called or what they want — used as audit context.',
        },
      },
      required: ['full_name', 'phone_e164', 'email'],
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
  {
    name: 'end_call',
    description:
      'Close the voice conversation cleanly AFTER you have finished saying goodbye. ' +
      'Call this when the visitor has booked the demo and you have wrapped up, OR when ' +
      'the visitor has declined and you have wished them well. Do NOT call this while ' +
      'there are still open questions or pending actions. After this tool call, the ' +
      'visitor will see a "Session ended" message and the widget will close itself.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: {
          type: 'STRING',
          description:
            'One of: demo_booked (demo successfully scheduled), declined (visitor said no thanks), ' +
            'wrong_fit (not a service business or out of scope), off_topic (visitor not interested in product), ' +
            'wrapping_up_generic (any other natural end).',
        },
      },
      required: ['reason'],
    },
  },
  {
    // Backlog #2 — Single-specialist Handoff. Pins the conversation onto ONE
    // specialist's role rules until exit_specialist() is called. Use when the
    // caller's intent is clearly inside one specialist's wheelhouse for the next
    // multi-turn flow (mid-booking, mid-objection-handling, etc.). The model
    // already has every loaded role prompt in its system instruction; this tool
    // just tells it which one to active-pin and stop cross-routing. Caller never
    // hears any handoff language — the pin is silent. Pattern: OpenSwarm Handoff,
    // adapted for our single-Gemini-Live runtime (no system-prompt mutation).
    name: 'enter_specialist',
    description:
      'Pin the active conversation to ONE specialist role for the next series of turns. ' +
      'Call this the moment the caller\'s intent clearly settles into one specialist\'s area ' +
      '(for example: caller says "yes let\'s book a time" → enter_specialist(role:"APPOINTMENT") ' +
      'and run the entire booking flow as the Appointment specialist). ' +
      'While pinned, ignore other specialists\' rules and do NOT re-route per turn. ' +
      'Call exit_specialist when the flow completes, the caller abandons it, or their intent ' +
      'clearly leaves that specialist\'s scope. Do NOT call this for one-off questions — only ' +
      'when you expect multiple turns inside the same specialist. Never announce the pin to ' +
      'the caller; the switch is silent.',
    parameters: {
      type: 'OBJECT',
      properties: {
        role: {
          type: 'STRING',
          description:
            'One of: APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, SECRETARY. ' +
            'Must match a specialist role that is loaded in your system prompt. ORCHESTRATOR ' +
            'is not pinnable — it IS the routing layer.',
        },
        reason: {
          type: 'STRING',
          description:
            'One-line note on why you are pinning (for the audit log). For example: ' +
            '"caller agreed to schedule a demo" or "caller raised a pricing objection".',
        },
      },
      required: ['role', 'reason'],
    },
  },
  {
    name: 'exit_specialist',
    description:
      'Release the specialist pin set by enter_specialist and return to multi-specialist ' +
      'routing per the Specialist Routing meta in your system prompt. Call this when: the ' +
      'pinned flow completed (e.g. appointment was booked), the caller abandoned it, or their ' +
      'intent clearly shifted to a different specialist\'s area. Safe to call when no pin is ' +
      'active (no-op). Never announce the release to the caller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: {
          type: 'STRING',
          description:
            'One-line note on why you are exiting. For example: "appointment booked", ' +
            '"caller switched to a billing question", "caller declined to schedule".',
        },
      },
      required: ['reason'],
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
  async search_availability(args, ctx) {
    const fromIso         = String(args['from_iso']         ?? '').trim()
    const toIso           = String(args['to_iso']           ?? '').trim()
    const durationMinutes = Number(args['duration_minutes'] ?? 0)

    if (!fromIso || !toIso || !durationMinutes) {
      return { ok: false, error: 'from_iso, to_iso, and duration_minutes are required' }
    }

    // Each enriched slot is a `{ label, start_local_iso, end_iso }` triple.
    // The agent reads `label` aloud to the caller and passes back
    // `start_local_iso` to book_appointment — never the raw UTC. See the
    // prompt rules in buildToolGuidanceBlock() and the searchAvailability
    // service for the why.
    type EnrichedSlot = { label: string; start_local_iso: string; end_iso: string }
    const result = await callApi<{
      ok: boolean
      timezone: string
      slots: EnrichedSlot[]
      alternateSlots: EnrichedSlot[]
    }>(
      '/api/internal/gateway/tools/search-availability',
      ctx.tenantId,
      // Phase E.2 — pass conversationId so the API can resolve partnerId and
      // run free/busy against the partner's calendar on partner-page widget calls.
      { fromIso, toIso, durationMinutes, conversationId: ctx.conversationId, externalCallId: ctx.externalCallId },
    )
    // System error (DNS, Google API down, auth expired). The agent must NOT
    // tell the caller "the slot isn't available" — that misrepresents a
    // calendar outage as unavailability. Caller should be told there's a
    // technical issue and offered a callback or human transfer.
    if (!result.ok) {
      return {
        ok:           false,
        error_kind:   'SYSTEM_ERROR',
        error:        result.error,
        message:      'Calendar lookup failed (system error, NOT a real availability check). Tell the caller "I\'m having trouble accessing our calendar right now — let me take down your preferred time and have someone follow up to confirm." Then offer a callback or take a message. Do NOT say "that slot is unavailable" or anything implying you actually checked the calendar.',
      }
    }
    return {
      ok:              true,
      timezone:        result.data.timezone,
      slots:           result.data.slots,
      alternate_slots: result.data.alternateSlots,
      message:         result.data.slots.length === 0
        ? 'No open slots in that window. Try a different time range or a different day. Do NOT invent slot times — only offer slots returned by this tool.'
        : `Found ${result.data.slots.length} open slot(s). Read the slot's "label" aloud verbatim when offering it. When booking, pass the slot's "start_local_iso" value as starts_at_iso (NOT the raw UTC, NOT a label).`,
    }
  },

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
        externalCallId: ctx.externalCallId,
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

  async save_contact(args, ctx) {
    const fullName  = String(args['full_name']  ?? '').trim()
    const phoneE164 = String(args['phone_e164'] ?? '').trim()
    const email     = String(args['email']      ?? '').trim()
    const notes     = args['notes'] ? String(args['notes']) : undefined

    if (!fullName && !phoneE164 && !email) {
      return { ok: false, error: 'At least one of full_name, phone_e164, or email is required' }
    }
    if (!phoneE164 && !email) {
      return { ok: false, error: 'Need at least phone or email to save a contact (preferably both)' }
    }

    const result = await callApi<{
      ok: boolean; contactId: string; created: boolean
      fullName: string | null; phoneE164: string | null; email: string | null
    }>(
      '/api/internal/gateway/tools/save-contact',
      ctx.tenantId,
      {
        fullName: fullName || undefined,
        phoneE164: phoneE164 || undefined,
        email: email || undefined,
        notes,
        // F.2 — when the gateway knows the live conversation id, pass it so
        // the API can link Conversation.contactId now. Then persistConversation
        // → fireCrmTransition can bump the pipeline stage on call-end without
        // a separate lookup. Inbound phone calls pass externalCallId instead.
        conversationId: ctx.conversationId,
        externalCallId: ctx.externalCallId,
      },
    )
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok:         true,
      contact_id: result.data.contactId,
      created:    result.data.created,
      message:    result.data.created
        ? 'New contact saved.'
        : 'Existing contact updated with the latest info.',
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
  // end_call is intercepted in session.ts onToolCall BEFORE executeTool is
  // invoked (the gateway closes the WebSocket itself — there's no API roundtrip).
  // This handler exists only to satisfy the Record<ToolName, ToolHandler> type
  // contract. If it ever fires, something has bypassed the session.ts interception.
  async end_call() {
    return { ok: true, message: 'end_call acknowledged (gateway closes the session directly).' }
  },

  // Backlog #2 — Soft-pin onto one specialist role. We can't mutate the
  // Gemini Live system prompt mid-session, so the "pin" is enforced by a
  // strong instruction in the tool_response. The model already has every
  // role prompt in its system instruction; this just tells it which one
  // to active-pin and stop cross-routing. Session.ts may also write the
  // role to session-local state (for telemetry / future hooks) — the
  // handler stays pure here so it's easy to test in isolation.
  async enter_specialist(args, _ctx) {
    const PINNABLE = new Set([
      'APPOINTMENT', 'SALES', 'CUSTOMER_SERVICE',
      'MARKETING', 'ASSISTANT', 'SECRETARY',
    ])
    const role   = String(args['role']   ?? '').trim().toUpperCase()
    const reason = String(args['reason'] ?? '').trim()
    if (!role) {
      return { ok: false, error: 'role is required (APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, or SECRETARY).' }
    }
    if (role === 'ORCHESTRATOR') {
      return { ok: false, error: 'ORCHESTRATOR is the routing layer — not a pinnable specialist. Pick one of: APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, SECRETARY.' }
    }
    if (!PINNABLE.has(role)) {
      return { ok: false, error: `Unknown specialist role "${role}". Valid: APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, SECRETARY.` }
    }
    if (!reason) {
      return { ok: false, error: 'reason is required (one-line note for the audit log).' }
    }
    return {
      ok:       true,
      pinned:   role,
      reason,
      message:
        `ACTIVE SPECIALIST PINNED = ${role}. From now until you call exit_specialist, you ARE the ${role} ` +
        `specialist exclusively. Apply ONLY the ${role} role rules from your system prompt. ` +
        `Ignore the Specialist Routing meta and other specialists' rules until you exit. ` +
        `Stay pinned through every caller turn even if the topic drifts briefly — only exit when the flow ` +
        `completes, the caller abandons it, or their intent clearly leaves ${role}'s scope. ` +
        `Do NOT announce the pin to the caller. Continue the conversation naturally.`,
    }
  },

  async exit_specialist(args, _ctx) {
    const reason = String(args['reason'] ?? '').trim()
    return {
      ok:       true,
      reason:   reason || '(no reason given)',
      message:
        'SPECIALIST PIN RELEASED. Resume multi-specialist routing per the Specialist Routing meta in your ' +
        'system prompt: detect intent each turn, apply the matching specialist\'s rules, switch silently. ' +
        'Do NOT announce the release to the caller.',
    }
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

/**
 * Best-effort rollback for a tool call that Gemini cancelled after it had
 * already committed a side effect. Today only book_appointment has a
 * meaningful rollback (delete the Calendar event + mark the row CANCELED);
 * other tools are either no-ops, idempotent, or not safely reversible
 * (e.g. send_followup_email — once the email left, it left).
 */
export async function rollbackToolCall(
  name: string,
  result: ToolResult,
  ctx: ToolContext,
): Promise<void> {
  if (name !== 'book_appointment') return
  if (!result || result['ok'] !== true) return
  const appointmentId = result['appointment_id']
  if (typeof appointmentId !== 'string' || !appointmentId) return

  const cancel = await callApi<{ ok: boolean; appointmentId?: string; alreadyCanceled?: boolean; error?: string }>(
    '/api/internal/gateway/tools/cancel-appointment',
    ctx.tenantId,
    { appointmentId, reason: 'tool_call_cancelled_by_model' },
  )
  if (!cancel.ok) {
    console.warn(`[tools] rollback book_appointment ${appointmentId} failed: ${cancel.error}`)
    return
  }
  console.log(`[tools] rolled back book_appointment ${appointmentId}` +
              (cancel.data.alreadyCanceled ? ' (already canceled)' : ''))
}

// Short, model-friendly description block injected into the system prompt so
// the model knows when each tool is appropriate. Kept brief — full schemas
// already give the model the parameter contracts.
export function buildToolGuidanceBlock(): string {
  return [
    '--- Tools available ---',
    'You have eight tools you may call during this conversation. Use them when appropriate; do not announce them.',
    '',
    '1. lookup_contact(query) — Search for an existing customer by phone, email, or name. Call this once early when the caller has shared a phone or email so you can recognise returning customers.',
    '2. save_contact(full_name, phone_e164, email, notes?) — Save the caller\'s contact details to the database. ALWAYS call this after collecting the caller\'s full name, phone, AND email. Required on every call. Feeds campaigns and follow-up.',
    '3. search_availability(from_iso, to_iso, duration_minutes) — Find open appointment slots on the business calendar. ALWAYS call this BEFORE book_appointment to confirm the slot the caller wants is actually free. Returns a list of open slots; pick the closest match to what the caller asked for and confirm verbally.',
    '4. book_appointment(starts_at_iso, duration_minutes, contact_phone_or_email, notes?, appointment_type?, timezone?) — Book on the business calendar. Only after explicit confirmation of date, time, duration, and contact info — AND only after search_availability confirmed the slot is open.',
    '5. send_followup_email(contact_id_or_phone, subject, body) — Send a follow-up email from the business\'s Gmail. Only call when the caller asks for something in writing.',
    '6. record_disposition(outcome_code, notes?) — Record the call outcome near the end of the conversation. Allowed codes: BOOKED, QUALIFIED_LEAD, NOT_QUALIFIED, INFO_REQUEST, COMPLAINT, CALLBACK_REQUESTED, WRONG_NUMBER, SPAM, NO_ACTION.',
    '7. enter_specialist(role, reason) — Pin onto ONE specialist role (APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, SECRETARY) for a multi-turn flow. Use ONLY when 2+ role prompts are loaded AND the caller is clearly inside one specialist\'s wheelhouse for the next several turns. See the Specialist Routing section of your system prompt for when to pin vs not. Silent to the caller.',
    '8. exit_specialist(reason) — Release the pin set by enter_specialist and return to multi-specialist routing. Call when the pinned flow completes, the caller abandons it, or their intent leaves the pinned specialist\'s scope. Safe to call when no pin is active (no-op). Silent to the caller.',
    '',
    'Rules — contact capture (mandatory):',
    '- ALWAYS collect the caller\'s full name AND phone number AND email address. All three. Never settle for one or the other.',
    '- If the caller has already given you a phone OR an email, ask for the other one too. Phrasing: "Can I also grab your [email/phone] in case we need to follow up?"',
    '- Call save_contact as soon as you have all three AND have read the email back to confirm. Don\'t wait until the end of the call.',
    '- NEVER tell the caller "I can\'t find you" or "you\'re not in our system." Just collect their info naturally and save it. They don\'t care about your database.',
    '- If the caller refuses to share a piece (genuinely refuses, not just hesitates), accept gracefully and save what you got — but ask for both first.',
    '',
    'Rules — email verification (mandatory before save_contact):',
    '- ALWAYS read the caller\'s email back before save_contact. Email transcription is unreliable on phone audio — every email needs a confirmation pass.',
    '- Read in this format: "Let me confirm — that\'s c-r-a-w-f-o-r-d dot p-e-t-e-r-s-o-n at gmail dot com. Is that correct?" Spell the local part letter-by-letter. Pronounce dots as "dot" and "@" as "at". Wait for a clean yes (see affirmation discipline rules) before save_contact.',
    '- If the transcript looks garbled (e.g. "raw for d", "son senior", non-English fragments, fragments that don\'t form a real local part), do NOT silently guess from the caller\'s name. Spell back what you THINK you heard and ask the caller to correct it letter by letter. Pattern: "I want to make sure I have this right — I heard c-r-a-w-f-o-r-d dot p-e-t-e-r-s-o-n at gmail dot com. Did I get that?"',
    '- If the caller corrects any letter, re-read the FULL corrected email back end-to-end before save_contact. Don\'t partial-confirm.',
    '- The domain part ("gmail.com", "yahoo.com", etc.) usually transcribes cleanly — focus your spelling effort on the local part (before the @).',
    '',
    'Rules — turn-taking (critical for natural conversation):',
    '- Ask ONE question per turn. Stop and wait for the caller to answer before asking the next one. This rule is absolute — never combine "what\'s your name AND phone AND email" into a single ask, even at the start of contact capture.',
    '- Concrete sequencing for contact capture: turn 1 → ask name only, wait. Turn 2 → ask phone (or read back caller-ID and ask if it\'s correct), wait. Turn 3 → ask email, wait. Then save_contact. Three separate turns, three separate caller answers.',
    '- Keep your turns short. Two sentences max unless you\'re explaining something complex.',
    '',
    'Rules — affirmation discipline (do NOT book on ambiguous input):',
    '- A "clean yes" before book_appointment is one of these words/phrases, said clearly: "yes", "yes that works", "yes please", "correct", "that\'s right", "that works", "sounds good", "perfect", "go ahead", "confirmed", "book it", "let\'s do it".',
    '- A "clean no" is: "no", "no thanks", "not that one", "different time", "another day", "cancel".',
    '- ANYTHING else is NOT a yes. Including: "hello", "hi", "okay" alone, "uh-huh", "umm", "maybe", "I think so", "what?", "sorry?", "can you repeat", a single repeated word, a non-English word fragment, or a response that doesn\'t mention the time/date at all. Do NOT call book_appointment on these.',
    '- BUT: do NOT immediately repeat your question after every ambiguous fragment. Brief sounds, breaths, "uh"s, and stray transcription chars are normal phone-call noise — the caller may still be gathering their thought. Wait for a meaningful pause before re-asking. Repeating yourself instantly after every short fragment makes you sound robotic and broken.',
    '- When you DO need to re-ask, paraphrase shorter — never repeat the question word-for-word verbatim. Example: original "Just to confirm, that\'s 10:30 AM EDT on Thursday May 7th — does that work for you?" → re-ask "So 10:30 AM works for you?" Caller hears progress, not a malfunction.',
    '- Acknowledge what you heard before re-asking when possible: "I caught part of that — was that a yes for 9:30 AM?" feels far more natural than "Could you please confirm again."',
    '- Maximum two re-asks. If the caller still doesn\'t give a clean yes/no after two, switch tactics: offer a callback, suggest a different time, or politely end the call.',
    '',
    'Rules — handling garbled or non-English transcription:',
    '- The caller is speaking English. Non-English chars (Thai, Chinese, etc.) or single-letter fragments in the transcript are NOISE on the audio line, NOT the caller switching languages.',
    '- Treat garbled fragments like background noise: do NOT act on them, do NOT treat them as a "no" or "yes", and do NOT immediately ask the caller to repeat. Stay silent and let the caller continue. Only ask "Sorry, I didn\'t catch that — could you say it again?" if the caller actually pauses or seems to expect a response.',
    '- Always respond in English. Never respond in any other language even if the transcript appears to contain it.',
    '',
    'Rules — offering availability slots:',
    '- When you receive slots from search_availability, list them as discrete options with explicit "or" separators, NOT as a range. Example: "I have 9 AM, 11 AM, 2 PM, or 4 PM available — which works best for you?" NOT "I have slots between 9 AM and 4 PM".',
    '- Offer at most 4 slots in one turn. More than that is hard to track on a phone call.',
    '- Never pick a slot FOR the caller. Wait for them to name the one they want. If their response is unclear, re-list the same options and ask again.',
    '- NEVER invent slot times. Only offer times that came back from search_availability for THIS call. If the tool returned no slots, tell the caller honestly ("nothing\'s open in that range — would another time work?") and search again.',
    '- When the caller specifies a preferred time ("9 AM Friday"), search a tight window: 1 hour before to 1 hour after the preferred time, on the same day. Don\'t search 32-hour ranges across multiple days unless the caller has no preference.',
    '',
    'Rules — timezone & slot ISO discipline (CRITICAL — prevents 4-hour booking errors):',
    '- search_availability returns each slot as { label, start_local_iso, end_iso }. The `label` is a human-readable string in the BUSINESS\'S timezone like "9:30 AM EDT, Thursday, May 8". Use this when speaking to the caller — say it verbatim.',
    '- When you call book_appointment after the caller picks a slot, set `starts_at_iso = <that slot\'s start_local_iso value, character-for-character>`. The start_local_iso already has the correct timezone offset built in (e.g. "2026-05-08T09:30:00-04:00") — do NOT change it, do NOT strip the offset, do NOT convert to UTC.',
    '- NEVER read raw ISO timestamps to the caller. Strings like "2026-05-08T13:30:00Z" are UTC and the "13:30" in them is NOT a wall-clock time. Speaking that out loud causes a 4-hour booking error. Always use the slot\'s `label`.',
    '- If you find yourself about to say a number like "13:30" or read the letters "T" or "Z" out loud — stop. You\'re reading a UTC ISO. Switch to the slot\'s label.',
    '',
    'Rules — appointment_type label (used in confirmation emails):',
    '- When you call book_appointment, the `appointment_type` arg becomes the label in the confirmation email subject ("Your Demo with MyOrbisVoice is confirmed"). Use a SHORT category label that makes sense to read in an inbox, not a full sentence.',
    '- Good values: "Demo", "Tech Support", "Consultation", "Service Call", "Quote", "Follow-up". Match the caller\'s reason for the appointment.',
    '- Bad values: "Demo for Crawford Peterson", "30-minute appointment", "Booking", "Demo Call regarding the SaaS pricing question". The notes field is where context goes — appointment_type is just the category.',
    '- If unsure, default to "Consultation".',
    '',
    'Rules — tech support intake (ONLY when the call is a support ticket, NOT for demos):',
    '- When the caller indicates this is a tech support / help / "something is broken" call, your job is to TRY TO RESOLVE the issue on the call. Booking a callback is the LAST resort, not the default — most callers prefer a quick self-serve fix over waiting for a scheduled callback.',
    '',
    '- STEP 1 — Diagnose. Ask ONE question at a time, wait for each answer. Three required questions, in order:',
    '    1. "What\'s the main issue you\'re running into?" — what is broken',
    '    2. "When did this start happening?" — recency / what changed',
    '    3. "Are you blocked from working right now, or is it intermittent?" — urgency / impact',
    '- Two optional follow-ups, ask only if their answers warrant more depth:',
    '    4. "Have you already tried anything to fix it?" — what\'s been ruled out',
    '    5. "Are there any specific error messages, or anything weird you\'re seeing on screen?" — concrete signals',
    '- Stop after 3 questions if the picture is clear. Don\'t interrogate a stressed caller.',
    '',
    '- STEP 2 — Try to resolve from the Reference Documents. After diagnosis, scan your "Reference Documents" section (the tenant\'s uploaded help/knowledge files) for content that matches the caller\'s issue. If you find relevant guidance:',
    '    a. Tell the caller "Let me walk you through that — I have steps that should resolve it."',
    '    b. Walk through the steps ONE AT A TIME. After each step, wait for the caller to confirm they did it before moving to the next. Do NOT read all steps at once — that\'s not workable on a phone call.',
    '    c. After the steps, ask "Did that resolve it?" — listen for a clean yes or no.',
    '    d. If yes → call record_disposition with outcome_code INFO_REQUEST (notes: brief summary of what was resolved). Then close the call warmly.',
    '    e. If no → move to STEP 3 (book a callback).',
    '',
    '- STEP 3 — Book a callback (LAST RESORT). Only schedule an appointment if:',
    '    (a) the documents don\'t cover this issue at all, OR',
    '    (b) you walked through the documented steps and the caller still can\'t get it working, OR',
    '    (c) the issue requires something you can\'t do over voice (account-level admin access, code changes, hardware diagnostics).',
    '- When booking: contact capture (name → phone confirm → email) → book_appointment. Populate the `notes` field with 1-3 concise sentences capturing: the issue, when it started, urgency, and any troubleshooting you already walked through. Example: "Caller can\'t log into dashboard since this morning. Walked through cache clear + password reset from KB — still failing. Blocked, urgent. Likely needs admin reset."',
    '',
    '- For DEMOS: skip ALL of this. Demos are exploratory — just collect contact info and book. Don\'t diagnose a demo caller.',
    '- For information-only calls (caller wants to know hours, pricing, services): also skip the intake; just answer from the Reference Documents and record_disposition INFO_REQUEST.',
    '',
    'Rules — internal information boundaries:',
    '- Reference Documents in your context are the TENANT\'s public-facing help content. Use them freely with callers.',
    '- Never invent or share internal admin information — credentials, API keys, internal billing details, infrastructure details, other tenants\' data. If a caller asks for something that requires admin access, tell them you\'ll have someone with admin permissions reach out, then take a message or book a callback.',
    '- If a caller asks "are you a real person?" or "are you AI?" — be honest: "I\'m an AI assistant. I can help with [main services] or pass you along to a human if you need."',
    '',
    'Rules — booking (CRITICAL — read carefully):',
    '- NEVER tell the caller "I\'ve booked it" or "you\'re on the calendar" or any phrase implying success UNTIL you have just received a successful response from the book_appointment tool. The tool result is the source of truth. Your narration must follow reality, not lead it.',
    '- Booking workflow, in order: (1) collect name/phone/email and call save_contact, (2) ask the caller their preferred date/time/duration, (3) call search_availability for a window around their preference, (4) read open slots back to the caller and let them pick one, (5) READ THE CONFIRMED SLOT BACK to the caller in plain English and wait for an explicit "yes" / "correct" / "that works", (6) call book_appointment with that exact slot, (7) ONLY THEN say "you\'re booked" — and only if book_appointment returned ok: true with an appointment_id.',
    '- TIME-OF-DAY DISCIPLINE — this is the single most common failure. When the caller says "9 a.m." you MUST search for and book 9 a.m. (09:00). When they say "9 p.m." you MUST search for and book 9 p.m. (21:00). NEVER silently swap AM and PM between turns. If search_availability returns slots that are NOT in the part of day the caller asked for, do NOT offer those slots — re-search a different window or tell the caller that part of the day is fully booked and ask for an alternative. Do not move a 9 AM request to 9 PM "because there\'s an opening then."',
    '- READ-BACK BEFORE BOOK is mandatory. Read the date AND time AND AM/PM AND timezone back, exactly: "Just to confirm, that\'s Friday May 8th at 9 in the morning, Eastern time — does that work for you?" Wait for a clear "yes". If the caller says anything ambiguous, garbled, or unrelated, do NOT call book_appointment — ask again with the same exact details until you get a clean yes or a clean no.',
    '- DAY-NAME DISCIPLINE — if today is Thursday and the caller says "Friday", that IS "tomorrow". Pick ONE label and stick with it. Do not say "Friday is not available, but tomorrow is" — that\'s the same day. Same goes for "this Saturday" vs "tomorrow" when today is Friday, etc.',
    '- IMMEDIACY — once the caller confirms a slot ("yes that works"), call book_appointment IMMEDIATELY in the same turn. Do not go silent waiting for the caller to repeat themselves. Silence after a "yes" is a bug, not politeness.',
    '- If book_appointment returns an error or doesn\'t return a successful response, do not say it succeeded. Tell the caller you had trouble booking and offer to try a different time, take a message, or schedule a callback.',
    '- If you have not called book_appointment yet, language to use INSTEAD of "booked": "let me get that scheduled for you", "let me check that slot", "I\'m looking now". These are honest holding phrases. Switch to "you\'re booked" only AFTER the tool succeeds.',
    '',
    'Rules — phone numbers (READ BACK, do not ask the caller to recite):',
    '- The caller\'s phone number is almost always available to you from caller ID at the start of the call (look for a "Caller ID" line in your initial context). If you have it, READ IT BACK to the caller — "I have your number as nine-two-nine, four-nine-seven, seven-eight-zero-three — is that the best number to reach you?" — and only ask them to provide one if caller ID was blocked or shows "Unknown".',
    '- Speak phone numbers in groups of 3-3-4 with brief pauses, not as a 10-digit run-on. This is how humans hear phone numbers.',
    '- Never invent or pad digits. If caller ID gave you 10 digits, use those 10 digits. Do not "round up" a 9-digit transcription by guessing the missing one — ask the caller to repeat the missing digit.',
    '',
    'Rules — general:',
    '- Confirm details verbally before any write tool (book_appointment, send_followup_email). Spell back email addresses character by character. Read phone numbers back in 3-3-4 grouping.',
    '- If a tool returns an error, briefly tell the caller you had trouble and either retry or note it for human follow-up.',
    '- Always call record_disposition once before the call ends.',
    '- ALWAYS end the call with a clear closing phrase containing "goodbye" or "have a great day" or "thanks for calling" — those phrases trigger the system to end the call cleanly. Don\'t use creative variations like "talk soon" or "you\'re all set" alone; pair them with one of the trigger phrases.',
    '- After saying that closing phrase, stop speaking. The system will end the call automatically.',
  ].join('\n')
}
