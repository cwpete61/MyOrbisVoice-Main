/**
 * Phase E.7 — Cross-session contact memory.
 *
 * Compiles a contact's prior interactions into a compact block the voice
 * agent can read at session start (inbound/outbound, when contact is
 * pre-known) or fetch via the lookup-contact tool (widget, where contact is
 * identified mid-call).
 *
 * Read path:
 *   1. inbound.ts / outbound.ts call getContactHistoryForPrompt() before the
 *      Gemini Live session opens so the system prompt includes the history layer.
 *   2. /internal/gateway/tools/lookup-contact returns the same history block in
 *      its response so the agent gets it the moment it identifies the caller.
 *
 * Tuning knobs (kept tight on purpose — long prompts dilute the agent's
 * attention and slow the first-turn latency):
 *   - RECENT_CONVERSATIONS: 3 most-recent COMPLETED conversations
 *   - RECENT_APPOINTMENTS:  3 most-recent appointments in either direction
 *   - SUMMARY_CHAR_BUDGET:  200 chars per summary
 *   - NOTES_CHAR_BUDGET:    200 chars total for personalNotes
 */
import { prisma } from '../lib/prisma.js'

const RECENT_CONVERSATIONS = 3
const RECENT_APPOINTMENTS  = 3
const SUMMARY_CHAR_BUDGET  = 200
const NOTES_CHAR_BUDGET    = 200

export interface ContactHistoryFact {
  birthday?:             string
  anniversary?:          string
  spouseName?:           string
  kids?:                 unknown[]   // shape varies — kept as-is for the agent to read
  pets?:                 unknown[]
  importantDates?:       unknown[]
  hobbies?:              string
  preferredContactTime?: string
  personalNotes?:        string
}

export interface ContactHistoryConversation {
  startedAt:   string
  channelType: string
  summary:     string | null
  outcomeCode: string | null
}

export interface ContactHistoryAppointment {
  startAt:        string
  appointmentType: string | null
  status:         string
  location:       string | null
}

export interface ContactHistory {
  contactId:           string
  fullName:            string | null
  totalConversations:  number
  lastInteractionAt:   string | null
  customerSince:       string | null
  facts:               ContactHistoryFact
  recentConversations: ContactHistoryConversation[]
  recentAppointments:  ContactHistoryAppointment[]
}

export async function getContactHistory(
  tenantId: string,
  contactId: string,
): Promise<ContactHistory | null> {
  const contact = await prisma.contact.findFirst({
    where: { tenantId, id: contactId },
    select: {
      id: true, fullName: true, customerSince: true,
      birthday: true, anniversary: true, spouseName: true,
      kidsInfoJson: true, petsInfoJson: true, importantDatesJson: true,
      hobbies: true, preferredContactTime: true, personalNotes: true,
    },
  })
  if (!contact) return null

  // Pull recent conversations + appointments in parallel. Both are tightly
  // capped — the agent doesn't need a full history dump to feel "remembered."
  const [totalConversations, recentConvosRaw, recentApptsRaw] = await Promise.all([
    prisma.conversation.count({
      where: { tenantId, contactId, status: { not: 'OPEN' } },
    }),
    prisma.conversation.findMany({
      where: { tenantId, contactId },
      orderBy: { startedAt: 'desc' },
      take: RECENT_CONVERSATIONS,
      select: {
        startedAt:   true,
        channelType: true,
        summaryText: true,
        outcomeCode: true,
      },
    }),
    prisma.appointment.findMany({
      where: { tenantId, contactId },
      orderBy: { startAt: 'desc' },
      take: RECENT_APPOINTMENTS,
      select: {
        startAt:         true,
        appointmentType: true,
        status:          true,
        location:        true,
      },
    }),
  ])

  // Truncate per-conversation summaries so the prompt stays compact.
  const recentConversations: ContactHistoryConversation[] = recentConvosRaw.map(c => ({
    startedAt:   c.startedAt.toISOString(),
    channelType: c.channelType,
    summary:     truncate(c.summaryText, SUMMARY_CHAR_BUDGET),
    outcomeCode: c.outcomeCode,
  }))

  const recentAppointments: ContactHistoryAppointment[] = recentApptsRaw.map(a => ({
    startAt:         a.startAt.toISOString(),
    appointmentType: a.appointmentType,
    status:          a.status,
    location:        a.location,
  }))

  const facts: ContactHistoryFact = {}
  if (contact.birthday)             facts.birthday             = contact.birthday.toISOString().slice(0, 10)
  if (contact.anniversary)          facts.anniversary          = contact.anniversary.toISOString().slice(0, 10)
  if (contact.spouseName)           facts.spouseName           = contact.spouseName
  if (Array.isArray(contact.kidsInfoJson) && contact.kidsInfoJson.length)
    facts.kids = contact.kidsInfoJson as unknown[]
  if (Array.isArray(contact.petsInfoJson) && contact.petsInfoJson.length)
    facts.pets = contact.petsInfoJson as unknown[]
  if (Array.isArray(contact.importantDatesJson) && contact.importantDatesJson.length)
    facts.importantDates = contact.importantDatesJson as unknown[]
  if (contact.hobbies)              facts.hobbies              = contact.hobbies
  if (contact.preferredContactTime) facts.preferredContactTime = contact.preferredContactTime
  if (contact.personalNotes)        facts.personalNotes        = truncate(contact.personalNotes, NOTES_CHAR_BUDGET) ?? undefined

  return {
    contactId:           contact.id,
    fullName:            contact.fullName,
    totalConversations,
    lastInteractionAt:   recentConvosRaw[0]?.startedAt.toISOString() ?? null,
    customerSince:       contact.customerSince?.toISOString().slice(0, 10) ?? null,
    facts,
    recentConversations,
    recentAppointments,
  }
}

/**
 * Render the history as a compact block the agent reads in its system prompt.
 * Returns null when there's nothing worth saying (no past conversations and
 * no CRM facts) — avoids prefacing every fresh-contact session with an empty
 * "Caller Context" block.
 */
export function formatContactHistoryForPrompt(history: ContactHistory | null): string | null {
  if (!history) return null
  const factsEmpty       = Object.keys(history.facts).length === 0
  const noConversations  = history.recentConversations.length === 0
  const noAppointments   = history.recentAppointments.length === 0
  if (factsEmpty && noConversations && noAppointments) return null

  const lines: string[] = []
  lines.push('--- Caller Context (this person is a known contact) ---')

  if (history.fullName) {
    lines.push(`Name on file: ${history.fullName}.`)
  }
  if (history.totalConversations > 0) {
    const last = history.lastInteractionAt
      ? `; last interaction ${formatDateForAgent(history.lastInteractionAt)}`
      : ''
    lines.push(`This caller has ${history.totalConversations} prior interaction${history.totalConversations === 1 ? '' : 's'} on file${last}.`)
  }
  if (history.customerSince) {
    lines.push(`Customer since: ${history.customerSince}.`)
  }

  if (history.recentAppointments.length > 0) {
    lines.push('Recent appointments:')
    for (const a of history.recentAppointments) {
      const type = a.appointmentType ?? 'Appointment'
      lines.push(`  - ${formatDateForAgent(a.startAt)} — ${type} (${a.status})`)
    }
  }

  if (history.recentConversations.length > 0) {
    lines.push('Recent conversations:')
    for (const c of history.recentConversations) {
      const date = formatDateForAgent(c.startedAt)
      const out  = c.outcomeCode ? ` [${c.outcomeCode}]` : ''
      const sum  = c.summary ?? '(no summary on file)'
      lines.push(`  - ${date} (${c.channelType.toLowerCase()})${out}: ${sum}`)
    }
  }

  if (history.facts.spouseName) lines.push(`Spouse: ${history.facts.spouseName}.`)
  if (history.facts.birthday)    lines.push(`Birthday on file: ${history.facts.birthday}.`)
  if (history.facts.anniversary) lines.push(`Anniversary on file: ${history.facts.anniversary}.`)
  if (history.facts.hobbies)     lines.push(`Hobbies/interests: ${history.facts.hobbies}.`)
  if (history.facts.preferredContactTime) lines.push(`Preferred contact time: ${history.facts.preferredContactTime}.`)
  if (history.facts.personalNotes) lines.push(`Internal notes: ${history.facts.personalNotes}`)

  // Usage guidance for the agent — keeps it from over-leveraging the data
  // (creepy) or pretending to remember things that aren't here (hallucination).
  lines.push(
    'You may reference this context naturally if it fits the conversation ' +
    '(e.g. "Welcome back — I see you came in for X last time"), but do NOT ' +
    'bring up sensitive personal facts (spouse, kids, etc.) unless the ' +
    'caller raises them first. Never claim to remember details that are ' +
    'not in this block.',
  )

  return lines.join('\n')
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1) + '…'
}

function formatDateForAgent(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
