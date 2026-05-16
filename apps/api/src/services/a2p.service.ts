/**
 * A2P 10DLC submission engine — shared by tenant + partner + platform scopes.
 *
 * Two responsibilities:
 *   1. The 4-layer pre-submission validation gate (runValidationGate).
 *   2. The Twilio Trust Hub submission pipeline (submitA2PApplication),
 *      modeled as a resumable state machine.
 *
 * Submission has two modes (TenantA2PApplication.submissionMode):
 *   - 'mock'  — default. Local simulation: realistic-shaped fake SIDs, the
 *               full state machine runs, NO Twilio calls, NO TCR billing,
 *               NO live SMS. This is what exercises the UI + pipeline today.
 *   - 'live'  — real Trust Hub submission. Guarded: refuses unless the
 *               platform has flipped system-config `a2p_live_enabled` AND
 *               an operator set submissionMode='live'. The app must never
 *               submit a real registration without explicit authorization
 *               (see docs/twilio-a2p-automation.md).
 *
 * The engine never submits without a recorded customer authorization
 * (authorizedAt) and a passed validation gate.
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getOpenAiApiKey, getConfigValue } from './system-config.service.js'
import { checkWebsite } from './website-check.service.js'

/* ───────────────────────────── types ──────────────────────────────────── */

export type GateFinding = {
  ok: boolean | null // true = pass, false = hard fail, null = could not determine / skipped
  label: string
  detail: string
}

export type GateLayer = {
  layer: number
  name: string
  passed: boolean | null // false if any finding is a hard fail
  findings: GateFinding[]
}

export type ValidationReport = {
  passed: boolean // true only if no layer has a hard fail
  generatedAt: string
  layers: GateLayer[]
}

type A2PApp = Awaited<ReturnType<typeof loadApplication>>

/** Statuses from which the form may be edited / re-validated. Anything in
 *  the live submission pipeline (SUBMITTED…APPROVED) is locked. */
export const A2P_EDITABLE_STATUSES = [
  'DRAFT', 'VALIDATION_FAILED', 'READY_TO_SUBMIT', 'REJECTED', 'BRAND_FAILED',
] as const

/* ─────────────────────────── helpers ──────────────────────────────────── */

async function loadApplication(applicationId: string) {
  const app = await prisma.tenantA2PApplication.findUnique({ where: { id: applicationId } })
  if (!app) throw new AppError('NOT_FOUND', 'A2P application not found', 404)
  return app
}

function sampleMessages(app: A2PApp): string[] {
  const raw = app.sampleMessagesJson
  return Array.isArray(raw) ? raw.filter((m): m is string => typeof m === 'string') : []
}

/** Realistic-shaped fake Twilio SID for mock-mode submissions. */
function mockSid(prefix: string): string {
  const hex = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)]
  return `${prefix}${s}`
}

/* ───────────────────── Layer 1 — deterministic validator ──────────────── */

function validateDeterministic(app: A2PApp): GateLayer {
  const findings: GateFinding[] = []
  const need = (label: string, present: boolean, detail: string) =>
    findings.push({ ok: present, label, detail })

  need('Legal business name', !!app.legalName && app.legalName.length >= 2,
    app.legalName ? `"${app.legalName}"` : 'Missing — required, must match EIN registration')

  // EIN is required for everything except sole proprietors.
  if (app.businessType === 'SOLE_PROP') {
    findings.push({ ok: true, label: 'EIN', detail: 'Not required for sole proprietor' })
  } else {
    const einOk = !!app.ein && /^\d{2}-?\d{7}$/.test(app.ein)
    need('EIN / Tax ID', einOk,
      einOk ? app.ein! : 'Missing or malformed — required for non-sole-prop, format XX-XXXXXXX')
  }

  need('Business type', !!app.businessType, app.businessType || 'Missing')
  need('Industry / vertical', !!app.vertical && app.vertical.length >= 2, app.vertical || 'Missing')

  const addrOk = !!app.addressLine1 && !!app.city && !!app.region && !!app.postalCode
  need('Physical address', addrOk,
    addrOk ? `${app.addressLine1}, ${app.city}, ${app.region} ${app.postalCode}` : 'Incomplete address')

  const contactOk = !!app.contactFirstName && !!app.contactLastName && !!app.contactEmail && !!app.contactPhone
  need('Authorized representative', contactOk,
    contactOk ? `${app.contactFirstName} ${app.contactLastName}` : 'Incomplete contact details')

  // Website — TCR requires a reachable business URL with privacy/terms.
  if (app.websiteUrl) {
    const urlOk = /^https?:\/\/.+\..+/.test(app.websiteUrl)
    need('Website URL format', urlOk, urlOk ? app.websiteUrl : 'Malformed URL')
  } else {
    findings.push({ ok: false, label: 'Website URL', detail: 'Missing — TCR requires a published business website' })
  }

  // Sample messages.
  const samples = sampleMessages(app)
  need('Sample messages provided', samples.length >= 1,
    samples.length ? `${samples.length} sample message(s)` : 'At least one sample SMS is required')

  if (samples.length) {
    const tooLong = samples.filter((m) => m.length > 1600)
    findings.push({
      ok: tooLong.length === 0,
      label: 'Sample message length',
      detail: tooLong.length ? `${tooLong.length} sample(s) exceed 1600 chars` : 'All samples within length limit',
    })
    // At least one sample should carry opt-out language.
    const hasOptOut = samples.some((m) => /\b(stop|unsubscribe|opt[\s-]?out)\b/i.test(m))
    findings.push({
      ok: hasOptOut,
      label: 'Opt-out language in samples',
      detail: hasOptOut
        ? 'At least one sample includes STOP/unsubscribe language'
        : 'No sample mentions STOP / unsubscribe — carriers expect opt-out language',
    })
    // At least one sample should identify the business by name.
    const namesBusiness = app.legalName
      ? samples.some((m) => m.toLowerCase().includes(app.legalName.toLowerCase().split(/[\s,]/)[0] ?? ''))
      : false
    findings.push({
      ok: namesBusiness,
      label: 'Business identified in samples',
      detail: namesBusiness
        ? 'A sample identifies the sending business'
        : 'No sample names the business — carriers expect sender identification',
    })
  }

  return {
    layer: 1,
    name: 'Deterministic field validation',
    passed: findings.some((f) => f.ok === false) ? false : true,
    findings,
  }
}

/* ───────────────────── Layer 2 — AI compliance pre-check ───────────────── */

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

async function validateAiCompliance(app: A2PApp): Promise<GateLayer> {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey) {
    return {
      layer: 2,
      name: 'AI compliance pre-check',
      passed: null,
      findings: [{ ok: null, label: 'AI compliance pre-check', detail: 'Skipped — OpenAI API key not configured in System Settings' }],
    }
  }
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'

  const systemPrompt =
    'You are a Twilio A2P 10DLC compliance reviewer. Given a business SMS campaign ' +
    'registration, predict whether The Campaign Registry and carriers will approve it. ' +
    'Check: opt-in clarity, sample-message quality, use-case/sample alignment, prohibited ' +
    'content (loans, gambling, cannabis, etc.), business-name consistency. ' +
    'Respond ONLY with JSON: {"verdict":"pass"|"warn"|"fail","summary":string,' +
    '"issues":[{"label":string,"detail":string,"severity":"low"|"medium"|"high"}]}.'

  const userPrompt = JSON.stringify({
    legalName: app.legalName,
    businessType: app.businessType,
    vertical: app.vertical,
    useCase: app.useCase,
    websiteUrl: app.websiteUrl,
    sampleMessages: sampleMessages(app),
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    return {
      layer: 2,
      name: 'AI compliance pre-check',
      passed: null,
      findings: [{ ok: null, label: 'AI compliance pre-check', detail: 'Skipped — AI service unreachable, retry before submitting' }],
    }
  }
  clearTimeout(timer)

  if (!res.ok) {
    return {
      layer: 2,
      name: 'AI compliance pre-check',
      passed: null,
      findings: [{ ok: null, label: 'AI compliance pre-check', detail: `Skipped — AI service returned ${res.status}` }],
    }
  }

  const json = (await res.json().catch(() => null)) as ChatCompletionResponse | null
  const content = json?.choices?.[0]?.message?.content?.trim()
  let parsed: { verdict?: string; summary?: string; issues?: Array<{ label?: string; detail?: string; severity?: string }> } | null = null
  try { parsed = content ? JSON.parse(content) : null } catch { parsed = null }

  if (!parsed) {
    return {
      layer: 2,
      name: 'AI compliance pre-check',
      passed: null,
      findings: [{ ok: null, label: 'AI compliance pre-check', detail: 'Skipped — AI returned an unreadable response' }],
    }
  }

  const findings: GateFinding[] = []
  findings.push({
    ok: parsed.verdict === 'pass' ? true : parsed.verdict === 'fail' ? false : null,
    label: 'AI compliance verdict',
    detail: `${(parsed.verdict ?? 'unknown').toUpperCase()} — ${parsed.summary ?? 'no summary'}`,
  })
  for (const issue of parsed.issues ?? []) {
    findings.push({
      ok: issue.severity === 'high' ? false : null,
      label: `AI: ${issue.label ?? 'issue'}`,
      detail: `[${issue.severity ?? 'medium'}] ${issue.detail ?? ''}`,
    })
  }

  return {
    layer: 2,
    name: 'AI compliance pre-check',
    passed: findings.some((f) => f.ok === false) ? false : true,
    findings,
  }
}

/* ───────────────────── Layer 3 — live website check ────────────────────── */

async function validateWebsite(app: A2PApp): Promise<GateLayer> {
  if (!app.websiteUrl) {
    return {
      layer: 3,
      name: 'Live website check',
      passed: false,
      findings: [{ ok: false, label: 'Website', detail: 'No website URL on file — cannot run the live check' }],
    }
  }
  try {
    const result = await checkWebsite(app.websiteUrl)
    const findings: GateFinding[] = result.findings.map((f) => ({ ok: f.ok, label: f.label, detail: f.detail }))
    if (!result.reachable) {
      findings.push({ ok: null, label: 'Site crawl', detail: 'Site could not be crawled — verify the remaining checks manually' })
    }
    return {
      layer: 3,
      name: 'Live website check',
      passed: findings.some((f) => f.ok === false) ? false : true,
      findings,
    }
  } catch (e) {
    return {
      layer: 3,
      name: 'Live website check',
      passed: null,
      findings: [{ ok: null, label: 'Website', detail: `Check failed: ${e instanceof Error ? e.message : String(e)}` }],
    }
  }
}

/* ───────────────────── the gate (layers 1-3) ──────────────────────────── */

/**
 * Runs the 3 automated layers of the pre-submission gate and persists the
 * report. Layer 4 (customer authorization) is a separate explicit action —
 * see authorizeA2PApplication. The gate may only run from DRAFT /
 * VALIDATION_FAILED / READY_TO_SUBMIT.
 */
export async function runValidationGate(applicationId: string) {
  const app = await loadApplication(applicationId)
  if (!(A2P_EDITABLE_STATUSES as readonly string[]).includes(app.status)) {
    throw new AppError('CONFLICT', `Cannot validate an application in ${app.status} status`, 409)
  }

  await prisma.tenantA2PApplication.update({ where: { id: applicationId }, data: { status: 'VALIDATING' } })

  const layer1 = validateDeterministic(app)
  const [layer2, layer3] = await Promise.all([validateAiCompliance(app), validateWebsite(app)])
  const layers = [layer1, layer2, layer3]

  const report: ValidationReport = {
    passed: layers.every((l) => l.passed !== false),
    generatedAt: new Date().toISOString(),
    layers,
  }

  // A new gate run invalidates any prior authorization.
  return prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: {
      status: report.passed ? 'DRAFT' : 'VALIDATION_FAILED',
      validationReportJson: report as unknown as object,
      validatedAt: new Date(),
      authorizedAt: null,
      authorizedByUserId: null,
    },
  })
}

/* ───────────────────── Layer 4 — customer authorization ────────────────── */

/**
 * Records the explicit customer authorization to submit (gate layer 4).
 * Requires a passed gate. Moves the application to READY_TO_SUBMIT.
 */
export async function authorizeA2PApplication(applicationId: string, userId: string) {
  const app = await loadApplication(applicationId)
  const report = app.validationReportJson as unknown as ValidationReport | null
  if (!report || !report.passed) {
    throw new AppError('CONFLICT', 'Run the validation gate and resolve all failures before authorizing', 409)
  }
  if (!['DRAFT', 'VALIDATION_FAILED'].includes(app.status)) {
    throw new AppError('CONFLICT', `Cannot authorize an application in ${app.status} status`, 409)
  }
  return prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'READY_TO_SUBMIT', authorizedAt: new Date(), authorizedByUserId: userId },
  })
}

/* ───────────────────── submission engine ──────────────────────────────── */

/**
 * Submits the application through the Twilio Trust Hub pipeline. Requires
 * status READY_TO_SUBMIT (gate passed + customer authorized).
 *
 * In 'mock' mode the full pipeline runs locally and lands on
 * CAMPAIGN_PENDING; syncA2PStatus then advances it to APPROVED.
 * In 'live' mode the real Trust Hub submission runs — guarded.
 */
export async function submitA2PApplication(applicationId: string) {
  const app = await loadApplication(applicationId)
  if (app.status !== 'READY_TO_SUBMIT') {
    throw new AppError('CONFLICT', `Application must be READY_TO_SUBMIT (currently ${app.status})`, 409)
  }
  if (!app.authorizedAt) {
    throw new AppError('CONFLICT', 'Customer authorization is required before submitting', 409)
  }

  if (app.submissionMode === 'live') {
    return runLiveSubmission(app)
  }
  return runMockSubmission(applicationId)
}

/**
 * Local simulation of the Trust Hub pipeline. Persists a fake SID after
 * each step (resumable shape) and walks the state machine to CAMPAIGN_PENDING.
 */
async function runMockSubmission(applicationId: string) {
  const now = new Date()

  // Step 1 — Secondary Customer Profile bundle.
  await prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'SUBMITTED', submittedAt: now, rejectionReason: null, twilioCustomerProfileSid: mockSid('BU') },
  })
  // Step 2 — A2P TrustProduct (Trust Bundle).
  await prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'PROFILE_PENDING', twilioTrustProductSid: mockSid('BU') },
  })
  // Step 3 — BrandRegistration.
  await prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'BRAND_PENDING', twilioBrandSid: mockSid('BN') },
  })
  // Mock brands clear review instantly.
  await prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'BRAND_APPROVED' },
  })
  // Step 4 — Messaging Service.
  await prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { twilioMessagingServiceSid: mockSid('MG') },
  })
  // Step 5 — UsAppToPerson Campaign. Lands in review; syncA2PStatus approves it.
  return prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { status: 'CAMPAIGN_PENDING', twilioCampaignSid: mockSid('QE') },
  })
}

/**
 * Real Twilio Trust Hub submission. Intentionally guarded: the platform
 * must hold ISV approval and an operator must opt in. Until then this
 * throws rather than risk a real TCR-billed registration.
 *
 * When enabled, the implementation sequence (per docs/twilio-a2p-automation.md):
 *   1. Trust Hub Secondary Customer Profile  → twilioCustomerProfileSid
 *   2. A2P TrustProduct / Trust Bundle       → twilioTrustProductSid
 *   3. POST .../a2p/BrandRegistrations        → twilioBrandSid
 *   4. Messaging Service                      → twilioMessagingServiceSid
 *   5. UsAppToPerson campaign in the service  → twilioCampaignSid
 * Each step persists its SID before the next runs (resumable). Status
 * callbacks land on the webhook route and drive the state machine.
 */
async function runLiveSubmission(app: A2PApp): Promise<never> {
  const liveEnabled = (await getConfigValue('a2p_live_enabled')) === 'true'
  if (!liveEnabled) {
    throw new AppError(
      'NOT_CONFIGURED',
      'Live A2P submission is not enabled. The platform needs Twilio ISV approval and ' +
        'system-config `a2p_live_enabled` must be set before a real registration can be filed. ' +
        'Use mock mode to simulate the full pipeline in the meantime.',
      409,
    )
  }
  // ISV approval is in place — the real Trust Hub calls are wired here once
  // tested against Twilio test credentials. Guard stays until then.
  throw new AppError(
    'NOT_IMPLEMENTED',
    'Live Trust Hub submission is pending implementation against verified ISV credentials.',
    501,
  )
}

/* ───────────────────── status sync / webhook ingest ───────────────────── */

/**
 * Refreshes the application status from Twilio. In mock mode it advances
 * any in-review state to its resolved state. In live mode it polls the
 * Brand/Campaign resources (wired with runLiveSubmission).
 */
export async function syncA2PStatus(applicationId: string) {
  const app = await loadApplication(applicationId)

  if (app.submissionMode === 'mock') {
    const next: Record<string, string> = {
      SUBMITTED: 'PROFILE_PENDING',
      PROFILE_PENDING: 'BRAND_PENDING',
      BRAND_PENDING: 'BRAND_APPROVED',
      CAMPAIGN_PENDING: 'APPROVED',
    }
    const advanced = next[app.status]
    return prisma.tenantA2PApplication.update({
      where: { id: applicationId },
      data: {
        status: (advanced ?? app.status) as A2PApp['status'],
        lastTwilioSyncAt: new Date(),
        ...(advanced === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
    })
  }

  // Live mode: poll Twilio Brand/Campaign — wired alongside runLiveSubmission.
  return prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: { lastTwilioSyncAt: new Date() },
  })
}

/**
 * Applies a Twilio Trust Hub / Brand / Campaign status callback to the
 * matching application. Called by the webhook route after signature
 * validation. The payload's resource SID is matched against the stored
 * pipeline SIDs to find the row.
 */
export async function applyTwilioStatusCallback(payload: {
  resourceSid?: string
  status?: string
  failureReason?: string
}) {
  const { resourceSid, status, failureReason } = payload
  if (!resourceSid || !status) {
    throw new AppError('BAD_REQUEST', 'Status callback missing resourceSid or status', 400)
  }

  const app = await prisma.tenantA2PApplication.findFirst({
    where: {
      OR: [
        { twilioCustomerProfileSid: resourceSid },
        { twilioTrustProductSid: resourceSid },
        { twilioBrandSid: resourceSid },
        { twilioCampaignSid: resourceSid },
      ],
    },
  })
  if (!app) {
    // Unknown SID — not an error (could be a resource we don't track). No-op.
    return null
  }

  // Map a Twilio resource status onto our application state machine.
  const s = status.toUpperCase()
  let nextStatus: A2PApp['status'] | null = null
  let rejectionReason: string | null = null

  if (resourceSid === app.twilioBrandSid) {
    if (s === 'APPROVED') nextStatus = 'BRAND_APPROVED'
    else if (s === 'FAILED') { nextStatus = 'BRAND_FAILED'; rejectionReason = failureReason ?? 'Brand registration failed' }
    else if (s === 'IN_REVIEW' || s === 'PENDING') nextStatus = 'BRAND_PENDING'
    else if (s === 'SUSPENDED') nextStatus = 'SUSPENDED'
  } else if (resourceSid === app.twilioCampaignSid) {
    if (s === 'VERIFIED' || s === 'APPROVED' || s === 'SUCCESS') nextStatus = 'APPROVED'
    else if (s === 'FAILED' || s === 'REJECTED') { nextStatus = 'REJECTED'; rejectionReason = failureReason ?? 'Campaign rejected' }
    else if (s === 'IN_PROGRESS' || s === 'PENDING') nextStatus = 'CAMPAIGN_PENDING'
    else if (s === 'SUSPENDED') nextStatus = 'SUSPENDED'
  } else {
    // Customer Profile / TrustProduct callbacks.
    if (s === 'TWILIO-APPROVED' || s === 'COMPLIANT' || s === 'APPROVED') nextStatus = 'BRAND_PENDING'
    else if (s === 'TWILIO-REJECTED' || s === 'NONCOMPLIANT' || s === 'FAILED') {
      nextStatus = 'REJECTED'; rejectionReason = failureReason ?? 'Customer profile rejected'
    }
  }

  return prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(nextStatus === 'APPROVED' ? { approvedAt: new Date() } : {}),
      lastTwilioSyncAt: new Date(),
    },
  })
}
