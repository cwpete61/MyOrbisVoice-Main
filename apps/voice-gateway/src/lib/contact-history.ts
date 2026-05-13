/**
 * Phase E.7 — Gateway-side contact memory loader.
 *
 * Mirror of apps/api/src/services/contact-history.service.ts so the inbound +
 * outbound voice flows can fetch the prior-interactions block locally (no HTTP
 * roundtrip) before opening the Gemini Live session.
 *
 * The two copies must stay aligned in shape. If the API version's output
 * format changes, update this file in the same commit.
 */
import { prisma } from './prisma.js'

const RECENT_CONVERSATIONS = 3
const RECENT_APPOINTMENTS  = 3
const SUMMARY_CHAR_BUDGET  = 200
const NOTES_CHAR_BUDGET    = 200

export interface ContactHistory {
  contactId:           string
  fullName:            string | null
  totalConversations:  number
  lastInteractionAt:   string | null
  customerSince:       string | null
  facts:               Record<string, unknown>
  recentConversations: Array<{ startedAt: string; channelType: string; summary: string | null; outcomeCode: string | null }>
  recentAppointments:  Array<{ startAt: string; appointmentType: string | null; status: string; location: string | null }>
}

/** Find contact by phone (E.164) within a tenant. Returns null when no match. */
export async function findContactIdByPhone(tenantId: string, phoneE164: string): Promise<string | null> {
  if (!phoneE164) return null
  const c = await prisma.contact.findFirst({
    where:  { tenantId, phoneE164 },
    select: { id: true },
  })
  return c?.id ?? null
}

export async function getContactHistory(tenantId: string, contactId: string): Promise<ContactHistory | null> {
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

  const [totalConversations, recentConvosRaw, recentApptsRaw] = await Promise.all([
    prisma.conversation.count({ where: { tenantId, contactId, status: { not: 'OPEN' } } }),
    prisma.conversation.findMany({
      where:   { tenantId, contactId },
      orderBy: { startedAt: 'desc' },
      take:    RECENT_CONVERSATIONS,
      select:  { startedAt: true, channelType: true, summaryText: true, outcomeCode: true },
    }),
    prisma.appointment.findMany({
      where:   { tenantId, contactId },
      orderBy: { startAt: 'desc' },
      take:    RECENT_APPOINTMENTS,
      select:  { startAt: true, appointmentType: true, status: true, location: true },
    }),
  ])

  const recentConversations = recentConvosRaw.map(c => ({
    startedAt:   c.startedAt.toISOString(),
    channelType: c.channelType,
    summary:     truncate(c.summaryText, SUMMARY_CHAR_BUDGET),
    outcomeCode: c.outcomeCode,
  }))
  const recentAppointments = recentApptsRaw.map(a => ({
    startAt:         a.startAt.toISOString(),
    appointmentType: a.appointmentType,
    status:          a.status,
    location:        a.location,
  }))

  const facts: Record<string, unknown> = {}
  if (contact.birthday)             facts['birthday']             = contact.birthday.toISOString().slice(0, 10)
  if (contact.anniversary)          facts['anniversary']          = contact.anniversary.toISOString().slice(0, 10)
  if (contact.spouseName)           facts['spouseName']           = contact.spouseName
  if (Array.isArray(contact.kidsInfoJson) && contact.kidsInfoJson.length)
    facts['kids'] = contact.kidsInfoJson
  if (Array.isArray(contact.petsInfoJson) && contact.petsInfoJson.length)
    facts['pets'] = contact.petsInfoJson
  if (Array.isArray(contact.importantDatesJson) && contact.importantDatesJson.length)
    facts['importantDates'] = contact.importantDatesJson
  if (contact.hobbies)              facts['hobbies']              = contact.hobbies
  if (contact.preferredContactTime) facts['preferredContactTime'] = contact.preferredContactTime
  if (contact.personalNotes)        facts['personalNotes']        = truncate(contact.personalNotes, NOTES_CHAR_BUDGET)

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

export function formatContactHistoryForPrompt(history: ContactHistory | null): string | null {
  if (!history) return null
  const factsEmpty      = Object.keys(history.facts).length === 0
  const noConversations = history.recentConversations.length === 0
  const noAppointments  = history.recentAppointments.length === 0
  if (factsEmpty && noConversations && noAppointments) return null

  const lines: string[] = []
  lines.push('--- Caller Context (this person is a known contact) ---')
  if (history.fullName) lines.push(`Name on file: ${history.fullName}.`)
  if (history.totalConversations > 0) {
    const last = history.lastInteractionAt ? `; last interaction ${formatDateForAgent(history.lastInteractionAt)}` : ''
    lines.push(`This caller has ${history.totalConversations} prior interaction${history.totalConversations === 1 ? '' : 's'} on file${last}.`)
  }
  if (history.customerSince) lines.push(`Customer since: ${history.customerSince}.`)

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
  if (history.facts['spouseName'])    lines.push(`Spouse: ${history.facts['spouseName']}.`)
  if (history.facts['birthday'])      lines.push(`Birthday on file: ${history.facts['birthday']}.`)
  if (history.facts['anniversary'])   lines.push(`Anniversary on file: ${history.facts['anniversary']}.`)
  if (history.facts['hobbies'])       lines.push(`Hobbies/interests: ${history.facts['hobbies']}.`)
  if (history.facts['preferredContactTime']) lines.push(`Preferred contact time: ${history.facts['preferredContactTime']}.`)
  if (history.facts['personalNotes']) lines.push(`Internal notes: ${history.facts['personalNotes']}`)

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
