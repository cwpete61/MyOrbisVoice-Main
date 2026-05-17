type PromptSnapshot = {
  id: string
  scope: string
  channelType: string | null
  agentRoleType: string | null
  content: string
}

type DNASnapshot = {
  identityJson?: unknown
  servicesJson?: unknown
  pricingJson?: unknown
  operationsJson?: unknown
  salesJson?: unknown
  appointmentJson?: unknown
  supportJson?: unknown
  languageJson?: unknown
  complianceJson?: unknown
}

/** Optional partner context snapshotted at widget session creation. When the
 *  widget loads on a partner's published page (/p/<slug>/), the gateway uses
 *  this to make the agent say "Want me to book 15 minutes with Alex Rivera?"
 *  instead of the generic copy from the prompts. */
export type PartnerContext = {
  slug:          string
  firstName:     string
  lastName:      string
  displayName:   string
  businessName?: string | null
  partnerEmail?: string
  partnerPhone?: string | null
  avatarUrl?:    string | null
  bio?:          string | null
}

export function resolveSystemPrompt(
  prompts: PromptSnapshot[],
  dna: DNASnapshot | null,
  channelType = 'WIDGET',
  toolGuidance?: string,
  kbText?: string | null,
  partner?: PartnerContext | null,
  /** Phase E.7 — Caller-history block emitted by formatContactHistoryForPrompt.
   *  Set when the inbound/outbound flow could identify the caller before the
   *  Gemini Live session opened. Goes right after the platform baseline so
   *  the agent reads it as established context. */
  callerHistoryBlock?: string | null,
): string {
  const layers: string[] = []

  // Layer 0 — Partner context (when set). Goes BEFORE the platform baseline so
  // the rest of the prompt reads it as established truth ("you are demoing for X").
  // Set on two paths: widget sessions on a partner page (/p/<slug>/), and
  // inbound calls to a partner-owned phone number (gateway loads it from the
  // AffiliateAccount). The copy is channel-aware — a phone caller is not a
  // landing-page "visitor".
  if (partner) {
    const businessLine = partner.businessName
      ? ` (business: ${partner.businessName})`
      : ''
    const phoneLine = partner.partnerPhone
      ? `\nPartner phone (for callers who ask how to reach the partner directly): ${partner.partnerPhone}`
      : ''
    const emailLine = partner.partnerEmail
      ? `\nPartner contact email: ${partner.partnerEmail}`
      : ''
    const isPhoneChannel = channelType === 'INBOUND' || channelType === 'OUTBOUND'
    const surfaceLine = isPhoneChannel
      ? `You are the AI assistant answering calls for partner ${partner.displayName}${businessLine}. ` +
        `This call is handled on ${partner.firstName}'s behalf — refer to the partner by FIRST NAME: "${partner.firstName}".`
      : `You are running on the marketing landing page of partner ${partner.displayName}${businessLine}. ` +
        `When you describe the demo booking flow to the visitor, refer to the partner by FIRST NAME: "${partner.firstName}".`
    const audienceWord = isPhoneChannel ? 'caller' : 'visitor'
    layers.push(
      `--- Partner Context ---\n` +
      `${surfaceLine} ` +
      `Sample phrasing: "I'll get 15 minutes on ${partner.firstName}'s calendar" or "${partner.firstName} will follow up to confirm."` +
      `${phoneLine}${emailLine}\n` +
      `Do NOT invent partner details beyond what's in this block. If the ${audienceWord} asks about ${partner.firstName} something not stated here, say you'll have ${partner.firstName} follow up directly.`
    )
  }

  // Layer 1 — platform baseline
  layers.push(
    'You are a professional AI voice assistant for a business. ' +
    'Be helpful, concise, and always on topic. ' +
    'Never make up information. If you do not know something, say so and offer to take a message or schedule a callback. ' +
    // Refuse-info handling — applies on EVERY inbound call regardless of tenant
    // config. Some callers will not give name/email/phone for privacy reasons,
    // and the agent must NOT block their questions over it. Acknowledge their
    // choice once, keep helping, and only re-ask if booking/follow-up requires it.
    "If the caller declines to share personal information (name, email, phone, address), do not insist or repeat the request. " +
    "Acknowledge politely with something like \"Of course — feel free to keep asking questions and I'll answer them as best I can,\" " +
    'then continue helping with whatever they want to know. ' +
    'Only ask again if a specific action they requested literally requires it (for example, booking an appointment requires at minimum a callback method) — and even then, ask once, accept their answer, and move on. ' +
    // Call termination — applies to widget + voice agents. The conversation is
    // not "done" until the agent explicitly hangs up. Without this rule the agent
    // would say "goodbye" and then sit silently while the visitor sees the panel
    // hanging open.
    'When the conversation has naturally ended — visitor booked a demo and you wrapped up, OR visitor declined and you wished them well, OR they are not a fit — say your farewell (one sentence), and THEN immediately call the end_call tool with the appropriate reason. ' +
    'Do not call end_call before saying goodbye. Do not call it while questions are still open. Do not announce the tool call out loud — just say the goodbye, then invoke end_call. ' +
    // Prohibited language — platform-wide; applies to every agent on every
    // channel and tenant, partner landing-page widgets included. A tenant's
    // Business DNA can add more on top but cannot remove these.
    'Prohibited language — never use, in any language: profanity, slurs, or discriminatory language; ' +
    'absolute promises or guarantees about results ("guaranteed", "100%", "risk-free", "you will definitely..."); ' +
    'false urgency or pressure tactics ("last chance", "act now or lose it") unless literally true; ' +
    'disparaging competitors or naming them negatively; ' +
    'claiming to be a human rather than an AI assistant; ' +
    'and invented prices, features, dates, or commitments that were not given to you. ' +
    'Do not expose internal jargon to callers (for example "n8n", "webhook", "tenant", "entitlement") — use plain language instead.'
  )

  // Layer 1.1 — agent identity. Every agent has a name; "Orby" is the platform
  // default applied across every channel and tenant. A tenant's Business DNA
  // (identityJson.agentName / businessName) overrides it when set.
  const dnaIdentity = (dna?.identityJson ?? {}) as Record<string, unknown>
  const resolvedAgentName =
    typeof dnaIdentity['agentName'] === 'string' && dnaIdentity['agentName'].trim()
      ? (dnaIdentity['agentName'] as string).trim()
      : 'Orby'
  const resolvedBusinessName =
    typeof dnaIdentity['businessName'] === 'string'
      ? (dnaIdentity['businessName'] as string).trim()
      : ''
  if (resolvedBusinessName) {
    layers.push(
      `You are ${resolvedAgentName}, an AI assistant for ${resolvedBusinessName}. ` +
      `Introduce yourself by name when greeting a caller ` +
      `(for example: "Hi, this is ${resolvedAgentName} from ${resolvedBusinessName} — how can I help?").`,
    )
  } else {
    layers.push(
      `Your name is ${resolvedAgentName}. Introduce yourself by name when greeting a caller ` +
      `(for example: "Hi, this is ${resolvedAgentName} — how can I help?").`,
    )
  }

  // Layer 1.5 — Caller history (Phase E.7). Only present when the gateway
  // could pre-identify the caller (phone match for inbound, contactId on the
  // enrollment for outbound). Goes BEFORE the tenant master prompt so the
  // tenant's instructions read it as already-established truth about who's
  // on the line.
  if (callerHistoryBlock) layers.push(callerHistoryBlock)

  // Layer 2 — tenant master prompt
  const tenantPrompt = prompts.find(p => p.scope === 'TENANT')
  if (tenantPrompt) layers.push(tenantPrompt.content)

  // Layer 3 — channel overlay
  const channelPrompt = prompts.find(p => p.scope === 'CHANNEL' && p.channelType === channelType)
  if (channelPrompt) layers.push(channelPrompt.content)

  // Layer 4 — role overlays. Previously only ORCHESTRATOR was loaded; now
  // we load every published ROLE-scoped prompt for the tenant. When a
  // tenant applies multiple role templates (e.g. Tech Support + Sales),
  // the agent has access to all of them and self-routes based on caller
  // intent. ORCHESTRATOR (if present) goes first as the meta-instruction;
  // the rest follow in a stable order so the system prompt is deterministic.
  const ROLE_ORDER: Array<string | null> = [
    'ORCHESTRATOR',
    'CUSTOMER_SERVICE',
    'SALES',
    'APPOINTMENT',
    'SECRETARY',
    'ASSISTANT',
    'MARKETING',
  ]
  const rolePrompts = prompts
    .filter(p => p.scope === 'ROLE')
    .sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.agentRoleType)
      const bi = ROLE_ORDER.indexOf(b.agentRoleType)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  for (const r of rolePrompts) layers.push(r.content)

  // Layer 5 — Business DNA injection
  if (dna) {
    const dnaLines: string[] = ['--- Business Knowledge ---']
    const stringify = (v: unknown) => v ? JSON.stringify(v) : null

    // The agent name + business name directive is emitted earlier (Layer 1.1)
    // with an "Orby" platform default; the raw identity JSON below still gives
    // the model the full structured detail.
    if (dna.identityJson)    dnaLines.push(`Identity: ${stringify(dna.identityJson)}`)
    if (dna.servicesJson)    dnaLines.push(`Services: ${stringify(dna.servicesJson)}`)
    if (dna.pricingJson)     dnaLines.push(`Pricing: ${stringify(dna.pricingJson)}`)
    if (dna.operationsJson)  dnaLines.push(`Operations/hours: ${stringify(dna.operationsJson)}`)
    if (dna.salesJson)       dnaLines.push(`Sales rules: ${stringify(dna.salesJson)}`)
    if (dna.appointmentJson) dnaLines.push(`Appointment rules: ${stringify(dna.appointmentJson)}`)
    if (dna.supportJson)     dnaLines.push(`Support rules: ${stringify(dna.supportJson)}`)
    if (dna.languageJson)    dnaLines.push(`Language/tone: ${stringify(dna.languageJson)}`)
    if (dna.complianceJson)  dnaLines.push(`Compliance: ${stringify(dna.complianceJson)}`)
    layers.push(dnaLines.join('\n'))
  }

  // Layer 5 — tool guidance (when tools are available for this session)
  if (toolGuidance) layers.push(toolGuidance)

  // Layer 5 — tenant knowledge-base reference documents (uploaded PDFs,
  // Word/Excel docs, plain text). Already pre-truncated by the caller to
  // fit the model's context budget.
  if (kbText && kbText.trim().length > 0) {
    layers.push(
      '--- Reference Documents ---\n' +
      'The tenant has uploaded the following reference documents. Use them to answer caller questions about the business. If the answer is not in these documents, say so honestly rather than guessing.\n' +
      kbText,
    )
  }

  return layers.join('\n\n')
}
