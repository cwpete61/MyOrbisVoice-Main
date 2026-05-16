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
import { getPlatformTwilioClient } from './twilio.service.js'

type TwilioClient = Awaited<ReturnType<typeof getPlatformTwilioClient>>

/** Twilio-published Standard A2P 10DLC messaging policy SID (overridable
 *  via system-config `a2p_a2p_policy_sid`). */
const DEFAULT_A2P_POLICY_SID = 'RNb0d4771c2c98518d916a3d4cd70a8f8b'

/** Trust Hub policy SIDs for the Sole Proprietor A2P flow (businesses with
 *  no EIN). Starter Customer Profile + Sole Proprietor A2P Trust Bundle. */
const STARTER_PROFILE_POLICY_SID = 'RN806dd6cd175f314e1f96a9727ee271f4'
const SOLE_PROP_A2P_POLICY_SID   = 'RN670d5d2e282a6130ae063b234b6019c8'

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

/* ── Twilio enum mappers — internal codes → Twilio Trust Hub vocabularies ── */

function mapBusinessType(t: string): string {
  switch (t) {
    case 'SOLE_PROP':   return 'Sole Proprietorship'
    case 'LLC':         return 'Limited Liability Corporation'
    case 'CORP':        return 'Corporation'
    case 'NON_PROFIT':  return 'Non-profit Corporation'
    case 'PARTNERSHIP': return 'Partnership'
    default:            return 'Limited Liability Corporation'
  }
}

function mapCompanyType(t: string): string {
  return t === 'NON_PROFIT' ? 'non-profit' : 'private'
}

function mapBusinessIndustry(v: string): string {
  const m: Record<string, string> = {
    healthcare: 'HEALTHCARE', retail: 'RETAIL', professional_services: 'PROFESSIONAL_SERVICES',
    real_estate: 'REAL_ESTATE', financial: 'FINANCIAL', education: 'EDUCATION',
    hospitality: 'HOSPITALITY', auto: 'AUTOMOTIVE', technology: 'TECHNOLOGY',
  }
  return m[v] ?? 'PROFESSIONAL_SERVICES'
}

function mapUseCase(u: string): string {
  const m: Record<string, string> = {
    marketing: 'MARKETING', mixed: 'MIXED', customer_care: 'CUSTOMER_CARE',
    '2fa': '2FA', utility: 'ACCOUNT_NOTIFICATION',
  }
  return m[u] ?? 'MIXED'
}

/**
 * Creates + submits the A2P TrustProduct (A2P Messaging trust bundle) that
 * the BrandRegistration references. Assigns the already-built Customer
 * Profile bundle + a us_a2p_messaging_profile_information end-user.
 */
async function createA2PTrustProduct(client: TwilioClient, app: A2PApp, customerProfileSid: string): Promise<string> {
  const policySid = (await getConfigValue('a2p_a2p_policy_sid')) || DEFAULT_A2P_POLICY_SID
  const tp = await client.trusthub.v1.trustProducts.create({
    friendlyName: `${app.legalName} — A2P Messaging`,
    email:        app.contactEmail,
    policySid,
  })
  const endUser = await client.trusthub.v1.endUsers.create({
    type:         'us_a2p_messaging_profile_information',
    friendlyName: `${app.legalName} — A2P profile`,
    attributes:   { company_type: mapCompanyType(app.businessType) },
  })
  await client.trusthub.v1.trustProducts(tp.sid).trustProductsEntityAssignments.create({ objectSid: customerProfileSid })
  await client.trusthub.v1.trustProducts(tp.sid).trustProductsEntityAssignments.create({ objectSid: endUser.sid })
  await client.trusthub.v1.trustProducts(tp.sid).update({ status: 'pending-review' })
  return tp.sid
}

/**
 * Creates the UsAppToPerson campaign inside the Messaging Service. Called
 * once the Brand is approved (by syncA2PStatus). Incurs A2P campaign fees
 * in live (non-mock) mode.
 */
async function createUsAppToPersonCampaign(client: TwilioClient, app: A2PApp): Promise<string> {
  if (!app.twilioMessagingServiceSid || !app.twilioBrandSid) {
    throw new AppError('CONFLICT', 'Messaging Service and Brand are required before campaign creation', 409)
  }
  const brandType = (await getConfigValue('a2p_brand_type')) || 'STANDARD'
  // Twilio requires 2-5 samples, each ≥20 chars — pad if the form gave fewer.
  const fallbackSamples = [
    `Hi, this is ${app.legalName} confirming your upcoming appointment. Reply STOP to opt out.`,
    `Reminder from ${app.legalName}: your appointment is tomorrow. Reply STOP to opt out.`,
  ]
  const provided = sampleMessages(app).filter((s) => s.trim().length >= 20)
  const messageSamples = (provided.length >= 2 ? provided : [...provided, ...fallbackSamples]).slice(0, 5)
  // The embedded-link / embedded-phone flags must match actual sample
  // content — a mismatch is a documented campaign rejection cause.
  const hasEmbeddedLinks = messageSamples.some((s) => /https?:\/\//i.test(s))
  const hasEmbeddedPhone = messageSamples.some((s) => /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(s))
  // Privacy + Terms URLs — optional today, MANDATORY campaign fields from
  // 2026-06-30. Passed when configured.
  const privacyUrl = await getConfigValue('a2p_privacy_policy_url')
  const termsUrl   = await getConfigValue('a2p_terms_url')
  const campaign = await client.messaging.v1
    .services(app.twilioMessagingServiceSid)
    .usAppToPerson.create({
      brandRegistrationSid: app.twilioBrandSid,
      description:          `${app.legalName} sends ${app.useCase} SMS to customers who have opted in through the business website.`,
      messageSamples,
      usAppToPersonUsecase: brandType === 'SOLE_PROPRIETOR' ? 'SOLE_PROPRIETOR' : mapUseCase(app.useCase),
      hasEmbeddedLinks,
      hasEmbeddedPhone,
      messageFlow:          'End users opt in by checking an unchecked SMS-consent checkbox on the booking and contact forms at the business website. The checkbox states they agree to recurring automated messages, that message and data rates may apply, that consent is not a condition of purchase, and links to the privacy policy and terms.',
      optInKeywords:        ['START'],
      optInMessage:         `You are now opted in to messages from ${app.legalName}. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`,
      optOutKeywords:       ['STOP'],
      optOutMessage:        'You have been unsubscribed and will receive no further messages. Reply START to opt back in.',
      helpKeywords:         ['HELP'],
      helpMessage:          `${app.legalName}: Reply STOP to unsubscribe. Msg & data rates may apply.`,
      ...(privacyUrl ? { privacyPolicyUrl: privacyUrl } : {}),
      ...(termsUrl ? { termsAndConditionsUrl: termsUrl } : {}),
    })
  return campaign.sid
}

/**
 * Real Twilio Trust Hub submission — platform-scope. Guarded behind
 * `a2p_live_enabled`. Dispatches by `a2p_brand_type`:
 *   - SOLE_PROPRIETOR → runSoleProprietorSubmission (no EIN — OTP-verified)
 *   - STANDARD (default) → runStandardSubmission (EIN-registered business)
 * Both end at BRAND_PENDING; syncA2PStatus creates the campaign on approval.
 */
async function runLiveSubmission(app: A2PApp) {
  const liveEnabled = (await getConfigValue('a2p_live_enabled')) === 'true'
  if (!liveEnabled) {
    throw new AppError(
      'NOT_CONFIGURED',
      'Live A2P submission is not enabled. Set system-config `a2p_live_enabled = true` ' +
        'once the account is ready to file a real registration. Use mock mode meanwhile.',
      409,
    )
  }

  // ISV (per-tenant / per-partner) path uses Secondary Customer Profiles —
  // not yet wired. Platform-scope only for now.
  if (app.tenantId || app.partnerId) {
    throw new AppError(
      'NOT_IMPLEMENTED',
      'Live submission for tenant/partner scope (the ISV path) is not yet implemented. Platform-scope only.',
      501,
    )
  }

  const client = await getPlatformTwilioClient()
  const brandType = (await getConfigValue('a2p_brand_type')) || 'STANDARD'
  return brandType === 'SOLE_PROPRIETOR'
    ? runSoleProprietorSubmission(client, app)
    : runStandardSubmission(client, app)
}

/**
 * Standard / Low-Volume Standard brand path (EIN-registered business).
 * Reuses the account's Primary Customer Profile (config
 * `twilio_primary_customer_profile_sid`, must be submitted/approved — run
 * assemblePrimaryCustomerProfile first). Pipeline: Primary Customer Profile
 * → A2P TrustProduct → BrandRegistration → Messaging Service. Ends BRAND_PENDING.
 */
async function runStandardSubmission(client: TwilioClient, app: A2PApp) {
  // Step 1 — Primary Customer Profile (the account's own legal identity).
  const profileSid = await getConfigValue('twilio_primary_customer_profile_sid')
  if (!profileSid) {
    throw new AppError(
      'NOT_CONFIGURED',
      'Set system-config `twilio_primary_customer_profile_sid` to the account Primary Customer Profile SID. ' +
        'Run assemblePrimaryCustomerProfile first if it is still in draft.',
      409,
    )
  }
  const profile = await client.trusthub.v1.customerProfiles(profileSid).fetch()
  if (profile.status !== 'twilio-approved' && profile.status !== 'pending-review') {
    throw new AppError(
      'CONFLICT',
      `Primary Customer Profile is "${profile.status}" — it must be submitted (pending-review) or ` +
        'approved before brand registration. Run assemblePrimaryCustomerProfile.',
      409,
    )
  }
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, twilioCustomerProfileSid: profileSid },
  })

  const trustProductSid = app.twilioTrustProductSid ?? await createA2PTrustProduct(client, app, profileSid)
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'PROFILE_PENDING', twilioTrustProductSid: trustProductSid },
  })

  const useTwilioMock = (await getConfigValue('a2p_brand_mock')) === 'true'
  const brandType = (await getConfigValue('a2p_brand_type')) || 'STANDARD'
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: profileSid,
    a2PProfileBundleSid:      trustProductSid,
    brandType,
    mock:                     useTwilioMock,
  })
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'BRAND_PENDING', twilioBrandSid: brand.sid },
  })

  const svc = await client.messaging.v1.services.create({ friendlyName: `${app.legalName} — A2P` })
  return prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { twilioMessagingServiceSid: svc.sid },
  })
}

/**
 * Creates + submits the Starter Customer Profile for the Sole Proprietor
 * flow (no EIN). Holds the contact person's identity + the business
 * address. The OTP mobile is NOT here — it lives on the A2P trust bundle.
 */
async function createStarterCustomerProfile(client: TwilioClient, app: A2PApp): Promise<string> {
  const profile = await client.trusthub.v1.customerProfiles.create({
    friendlyName: `${app.legalName} — Starter Profile`,
    email:        app.contactEmail,
    policySid:    STARTER_PROFILE_POLICY_SID,
  })
  const endUser = await client.trusthub.v1.endUsers.create({
    type:         'starter_customer_profile_information',
    friendlyName: `${app.legalName} — starter info`,
    attributes: {
      email:        app.contactEmail,
      first_name:   app.contactFirstName,
      last_name:    app.contactLastName,
      phone_number: app.contactPhone,
    },
  })
  const address = await client.addresses.create({
    customerName: app.legalName,
    street:       app.addressLine1,
    city:         app.city,
    region:       app.region,
    postalCode:   app.postalCode,
    isoCountry:   app.country,
  })
  const doc = await client.trusthub.v1.supportingDocuments.create({
    friendlyName: `${app.legalName} — address`,
    type:         'customer_profile_address',
    attributes:   { address_sids: address.sid },
  })
  for (const objectSid of [endUser.sid, doc.sid]) {
    await client.trusthub.v1.customerProfiles(profile.sid).customerProfilesEntityAssignments.create({ objectSid })
  }
  await client.trusthub.v1.customerProfiles(profile.sid).update({ status: 'pending-review' })
  return profile.sid
}

/**
 * Creates + submits the Sole Proprietor A2P Trust Bundle. The
 * sole_proprietor_information end-user carries `mobile_phone_number` — the
 * mobile that receives the OTP verification text. That number must be a
 * real US/Canada mobile (not a CPaaS number) and can be used across at
 * most 3 Sole Proprietor brand registrations (TCR-enforced).
 */
async function createSoleProprietorTrustProduct(client: TwilioClient, app: A2PApp, customerProfileSid: string): Promise<string> {
  const otpMobile = (await getConfigValue('a2p_sole_prop_otp_mobile')) || app.contactPhone
  const tp = await client.trusthub.v1.trustProducts.create({
    friendlyName: `${app.legalName} — Sole Proprietor A2P`,
    email:        app.contactEmail,
    policySid:    SOLE_PROP_A2P_POLICY_SID,
  })
  const endUser = await client.trusthub.v1.endUsers.create({
    type:         'sole_proprietor_information',
    friendlyName: `${app.legalName} — sole proprietor`,
    attributes: {
      brand_name:          app.legalName,
      mobile_phone_number: otpMobile,
      vertical:            mapBusinessIndustry(app.vertical),
    },
  })
  await client.trusthub.v1.trustProducts(tp.sid).trustProductsEntityAssignments.create({ objectSid: customerProfileSid })
  await client.trusthub.v1.trustProducts(tp.sid).trustProductsEntityAssignments.create({ objectSid: endUser.sid })
  await client.trusthub.v1.trustProducts(tp.sid).update({ status: 'pending-review' })
  return tp.sid
}

/**
 * Sole Proprietor brand path (no EIN). Pipeline: Starter Customer Profile
 * → Sole Proprietor A2P Trust Bundle → SOLE_PROPRIETOR BrandRegistration
 * → Messaging Service. Submitting the brand sends an OTP to the sole
 * proprietor's mobile — they must reply within 24h or the OTP is resent
 * (see resendA2POtp). Ends BRAND_PENDING; syncA2PStatus polls + creates
 * the single allowed campaign on approval.
 */
async function runSoleProprietorSubmission(client: TwilioClient, app: A2PApp) {
  // Step 1 — Starter Customer Profile (created fresh — sole prop does not
  // use the account's Primary Customer Profile).
  const profileSid = app.twilioCustomerProfileSid ?? await createStarterCustomerProfile(client, app)
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, twilioCustomerProfileSid: profileSid },
  })

  // Step 2 — Sole Proprietor A2P Trust Bundle (carries the OTP mobile).
  const trustProductSid = app.twilioTrustProductSid ?? await createSoleProprietorTrustProduct(client, app, profileSid)
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'PROFILE_PENDING', twilioTrustProductSid: trustProductSid },
  })

  // Step 3 — SOLE_PROPRIETOR BrandRegistration. Submitting it sends the OTP.
  const useTwilioMock = (await getConfigValue('a2p_brand_mock')) === 'true'
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: profileSid,
    a2PProfileBundleSid:      trustProductSid,
    brandType:                'SOLE_PROPRIETOR',
    mock:                     useTwilioMock,
  })
  await prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { status: 'BRAND_PENDING', twilioBrandSid: brand.sid },
  })

  // Step 4 — Messaging Service.
  const svc = await client.messaging.v1.services.create({ friendlyName: `${app.legalName} — A2P` })
  return prisma.tenantA2PApplication.update({
    where: { id: app.id },
    data: { twilioMessagingServiceSid: svc.sid },
  })
}

/**
 * Re-sends the Sole Proprietor brand OTP. The OTP is sent automatically
 * when the brand is submitted; if the sole proprietor misses the 24h
 * window, call this to resend (valid up to 30 days after registration).
 */
export async function resendA2POtp(applicationId: string): Promise<{ ok: true }> {
  const app = await loadApplication(applicationId)
  if (!app.twilioBrandSid) {
    throw new AppError('CONFLICT', 'No brand registration yet — submit the application first', 409)
  }
  const client = await getPlatformTwilioClient()
  await client.messaging.v1.brandRegistrations(app.twilioBrandSid).brandRegistrationOtps.create()
  return { ok: true }
}

/**
 * Assembles + submits the account's Primary Customer Profile from a
 * platform-scope application's data: a business-information end-user, an
 * authorized-representative end-user, an address + supporting document,
 * the entity assignments, then `pending-review` to submit for Twilio
 * review. One-time account setup — the Primary Customer Profile is shared
 * by every platform-scope A2P submission.
 */
export async function assemblePrimaryCustomerProfile(
  applicationId: string,
): Promise<{ customerProfileSid: string; status: string }> {
  const app = await loadApplication(applicationId)
  const client = await getPlatformTwilioClient()
  const profileSid = await getConfigValue('twilio_primary_customer_profile_sid')
  if (!profileSid) {
    throw new AppError('NOT_CONFIGURED', 'Set system-config `twilio_primary_customer_profile_sid` first.', 409)
  }

  const bizInfo = await client.trusthub.v1.endUsers.create({
    type:         'customer_profile_business_information',
    friendlyName: `${app.legalName} — business info`,
    attributes: {
      business_name:                    app.legalName,
      business_type:                    mapBusinessType(app.businessType),
      business_registration_identifier: 'EIN',
      business_registration_number:     app.ein ?? '',
      business_identity:                'direct_customer',
      business_industry:                mapBusinessIndustry(app.vertical),
      business_regions_of_operation:    'USA_AND_CANADA',
      website_url:                      app.websiteUrl ?? '',
      social_media_profile_urls:        '',
    },
  })
  const authRep = await client.trusthub.v1.endUsers.create({
    type:         'authorized_representative_1',
    friendlyName: `${app.contactFirstName} ${app.contactLastName}`,
    attributes: {
      first_name:     app.contactFirstName,
      last_name:      app.contactLastName,
      email:          app.contactEmail,
      phone_number:   app.contactPhone,
      business_title: 'Authorized Representative',
      job_position:   'Director',
    },
  })
  const address = await client.addresses.create({
    customerName: app.legalName,
    street:       app.addressLine1,
    city:         app.city,
    region:       app.region,
    postalCode:   app.postalCode,
    isoCountry:   app.country,
  })
  const doc = await client.trusthub.v1.supportingDocuments.create({
    friendlyName: `${app.legalName} — address`,
    type:         'customer_profile_address',
    attributes:   { address_sids: address.sid },
  })
  for (const objectSid of [bizInfo.sid, authRep.sid, doc.sid]) {
    await client.trusthub.v1.customerProfiles(profileSid).customerProfilesEntityAssignments.create({ objectSid })
  }
  const updated = await client.trusthub.v1.customerProfiles(profileSid).update({ status: 'pending-review' })
  return { customerProfileSid: profileSid, status: updated.status }
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

  // Live mode: poll Twilio. Brand approval triggers campaign creation.
  const client = await getPlatformTwilioClient()
  let nextStatus: A2PApp['status'] = app.status
  let rejectionReason: string | null = null

  if (app.twilioBrandSid && ['SUBMITTED', 'PROFILE_PENDING', 'BRAND_PENDING'].includes(app.status)) {
    const brand = await client.messaging.v1.brandRegistrations(app.twilioBrandSid).fetch()
    const bs = (brand.status ?? '').toUpperCase()
    if (bs === 'APPROVED') nextStatus = 'BRAND_APPROVED'
    else if (bs === 'FAILED') {
      nextStatus = 'BRAND_FAILED'
      rejectionReason = 'Brand registration failed — check the Twilio Console for the rejection detail'
    } else nextStatus = 'BRAND_PENDING'
  }

  // Brand approved + Messaging Service ready + no campaign yet → create it.
  if (nextStatus === 'BRAND_APPROVED' && app.twilioMessagingServiceSid && !app.twilioCampaignSid) {
    const campaignSid = await createUsAppToPersonCampaign(client, app)
    await prisma.tenantA2PApplication.update({ where: { id: applicationId }, data: { twilioCampaignSid: campaignSid } })
    nextStatus = 'CAMPAIGN_PENDING'
  } else if (app.status === 'CAMPAIGN_PENDING' && app.twilioCampaignSid && app.twilioMessagingServiceSid) {
    const campaigns = await client.messaging.v1.services(app.twilioMessagingServiceSid).usAppToPerson.list({ limit: 20 })
    const c = campaigns.find((x) => x.sid === app.twilioCampaignSid)
    const cs = (c?.campaignStatus ?? '').toUpperCase()
    if (cs === 'VERIFIED' || cs === 'APPROVED') nextStatus = 'APPROVED'
    else if (cs === 'FAILED') { nextStatus = 'REJECTED'; rejectionReason = 'Campaign rejected by TCR' }
  }

  return prisma.tenantA2PApplication.update({
    where: { id: applicationId },
    data: {
      status: nextStatus,
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(nextStatus === 'APPROVED' ? { approvedAt: new Date() } : {}),
      lastTwilioSyncAt: new Date(),
    },
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
