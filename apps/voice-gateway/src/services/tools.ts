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
  // hangup_call temporarily removed — its presence in the registry was
  // crashing Gemini Live with code 1008 "Operation is not implemented, or
  // supported, or enabled." even after schema fixes. The agent's natural
  // goodbye + silence watchdog (60s) handles call termination as a fallback.
  // Re-introduce after isolating which schema field was triggering the
  // server-side validator.
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

    type Slot = { startAt: string; endAt: string; available: boolean }
    const result = await callApi<{ ok: boolean; slots: Slot[]; alternateSlots: Slot[] }>(
      '/api/internal/gateway/tools/search-availability',
      ctx.tenantId,
      { fromIso, toIso, durationMinutes },
    )
    if (!result.ok) return { ok: false, error: result.error }
    return {
      ok:              true,
      slots:           result.data.slots,
      alternate_slots: result.data.alternateSlots,
      message:         result.data.slots.length === 0
        ? 'No open slots in that window. Try a different range.'
        : `Found ${result.data.slots.length} open slot(s). Offer them to the caller and confirm before booking.`,
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
      { fullName: fullName || undefined, phoneE164: phoneE164 || undefined, email: email || undefined, notes },
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
  // hangup_call handler temporarily removed alongside its declaration above —
  // the silence watchdog (60s) is the fallback termination path.
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
    'You have six tools you may call during this conversation. Use them when appropriate; do not announce them.',
    '',
    '1. lookup_contact(query) — Search for an existing customer by phone, email, or name. Call this once early when the caller has shared a phone or email so you can recognise returning customers.',
    '2. save_contact(full_name, phone_e164, email, notes?) — Save the caller\'s contact details to the database. ALWAYS call this after collecting the caller\'s full name, phone, AND email. Required on every call. Feeds campaigns and follow-up.',
    '3. search_availability(from_iso, to_iso, duration_minutes) — Find open appointment slots on the business calendar. ALWAYS call this BEFORE book_appointment to confirm the slot the caller wants is actually free. Returns a list of open slots; pick the closest match to what the caller asked for and confirm verbally.',
    '4. book_appointment(starts_at_iso, duration_minutes, contact_phone_or_email, notes?, appointment_type?, timezone?) — Book on the business calendar. Only after explicit confirmation of date, time, duration, and contact info — AND only after search_availability confirmed the slot is open.',
    '5. send_followup_email(contact_id_or_phone, subject, body) — Send a follow-up email from the business\'s Gmail. Only call when the caller asks for something in writing.',
    '6. record_disposition(outcome_code, notes?) — Record the call outcome near the end of the conversation. Allowed codes: BOOKED, QUALIFIED_LEAD, NOT_QUALIFIED, INFO_REQUEST, COMPLAINT, CALLBACK_REQUESTED, WRONG_NUMBER, SPAM, NO_ACTION.',
    '',
    'Rules — contact capture (mandatory):',
    '- ALWAYS collect the caller\'s full name AND phone number AND email address. All three. Never settle for one or the other.',
    '- If the caller has already given you a phone OR an email, ask for the other one too. Phrasing: "Can I also grab your [email/phone] in case we need to follow up?"',
    '- Call save_contact as soon as you have all three. Don\'t wait until the end of the call.',
    '- NEVER tell the caller "I can\'t find you" or "you\'re not in our system." Just collect their info naturally and save it. They don\'t care about your database.',
    '- If the caller refuses to share a piece (genuinely refuses, not just hesitates), accept gracefully and save what you got — but ask for both first.',
    '',
    'Rules — turn-taking (critical for natural conversation):',
    '- Ask ONE question per turn. Stop and wait for the caller to answer before asking the next one. This rule is absolute — never combine "what\'s your name AND phone AND email" into a single ask, even at the start of contact capture.',
    '- Concrete sequencing for contact capture: turn 1 → ask name only, wait. Turn 2 → ask phone (or read back caller-ID and ask if it\'s correct), wait. Turn 3 → ask email, wait. Then save_contact. Three separate turns, three separate caller answers.',
    '- Keep your turns short. Two sentences max unless you\'re explaining something complex.',
    '',
    'Rules — affirmation discipline (do NOT book on ambiguous input):',
    '- A "clean yes" before book_appointment is one of these words/phrases, said clearly: "yes", "yes that works", "yes please", "correct", "that\'s right", "that works", "sounds good", "perfect", "go ahead", "confirmed", "book it", "let\'s do it".',
    '- A "clean no" is: "no", "no thanks", "not that one", "different time", "another day", "cancel".',
    '- ANYTHING else is NOT a yes. Including: silence, "hello", "hi", "okay" alone, "uh-huh", "umm", "maybe", "I think so", "what?", "sorry?", "can you repeat", a single repeated word, a non-English word, garbled transcription, or a response that doesn\'t mention the time/date at all. Treat any of these as "I didn\'t catch that" and ask the same confirmation question again, more slowly and clearly. Do NOT call book_appointment.',
    '- If you ask "Does Thursday at 9 AM work?" and the caller says anything other than a clean yes, repeat the exact same question with the same date and time. Do not change the offered time. Do not assume yes. Do not call book_appointment.',
    '- Maximum two re-asks. If the caller still doesn\'t give a clean yes/no after two re-asks, switch to a different approach: offer to take a callback, suggest a different time, or politely end the call.',
    '',
    'Rules — handling garbled or non-English transcription:',
    '- The caller is speaking English. If the transcript shows non-English words or characters (Thai, Chinese, Korean, etc.), or single-letter/symbol fragments, that is a transcription error caused by background noise — NOT the caller switching languages or genuinely speaking those words.',
    '- When you see garbled or non-English transcript, DO NOT act on it as if it were meaningful input. Treat it as silence/noise. Politely ask the caller to repeat: "I\'m sorry, I didn\'t catch that — could you repeat?"',
    '- Always respond in English. Never respond in any other language even if the transcript appears to contain it.',
    '',
    'Rules — offering availability slots:',
    '- When you receive slots from search_availability, list them as discrete options with explicit "or" separators, NOT as a range. Example: "I have 9 AM, 11 AM, 2 PM, or 4 PM available — which works best for you?" NOT "I have slots between 9 AM and 4 PM".',
    '- Offer at most 4 slots in one turn. More than that is hard to track on a phone call.',
    '- Never pick a slot FOR the caller. Wait for them to name the one they want. If their response is unclear, re-list the same options and ask again.',
    '- When the caller specifies a preferred time ("9 AM Friday"), search a tight window: 1 hour before to 1 hour after the preferred time, on the same day. Don\'t search 32-hour ranges across multiple days unless the caller has no preference.',
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
