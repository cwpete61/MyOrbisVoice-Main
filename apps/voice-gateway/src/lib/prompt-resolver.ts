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

export function resolveSystemPrompt(
  prompts: PromptSnapshot[],
  dna: DNASnapshot | null,
  channelType = 'WIDGET',
  toolGuidance?: string,
): string {
  const layers: string[] = []

  // Layer 1 — platform baseline
  layers.push(
    'You are a professional AI voice assistant for a business. ' +
    'Be helpful, concise, and always on topic. ' +
    'Never make up information. If you do not know something, say so and offer to take a message or schedule a callback.'
  )

  // Layer 2 — tenant master prompt
  const tenantPrompt = prompts.find(p => p.scope === 'TENANT')
  if (tenantPrompt) layers.push(tenantPrompt.content)

  // Layer 3 — channel overlay
  const channelPrompt = prompts.find(p => p.scope === 'CHANNEL' && p.channelType === channelType)
  if (channelPrompt) layers.push(channelPrompt.content)

  // Layer 4 — role overlay (orchestrator default for widget)
  const rolePrompt = prompts.find(p => p.scope === 'ROLE' && p.agentRoleType === 'ORCHESTRATOR')
  if (rolePrompt) layers.push(rolePrompt.content)

  // Layer 5 — Business DNA injection
  if (dna) {
    const dnaLines: string[] = ['--- Business Knowledge ---']
    const stringify = (v: unknown) => v ? JSON.stringify(v) : null

    // Emit a prominent named identity directive at the top of the DNA block
    // so the model uses the agent's persona name and business name reliably
    // when greeting callers (instead of having to parse them out of the
    // identityJson dump below).
    const identity = (dna.identityJson ?? {}) as Record<string, unknown>
    const agentName = typeof identity['agentName'] === 'string' ? (identity['agentName'] as string).trim() : ''
    const businessName = typeof identity['businessName'] === 'string' ? (identity['businessName'] as string).trim() : ''
    if (agentName && businessName) {
      dnaLines.push(`You are ${agentName}, an AI assistant for ${businessName}. Introduce yourself by name when greeting a caller (for example: "Hi, this is ${agentName} from ${businessName} — how can I help?").`)
    } else if (agentName) {
      dnaLines.push(`Your name is ${agentName}. Introduce yourself by name when greeting a caller.`)
    } else if (businessName) {
      dnaLines.push(`You represent ${businessName}. Greet callers on behalf of ${businessName}.`)
    }

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

  return layers.join('\n\n')
}
