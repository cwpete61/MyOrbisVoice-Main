/**
 * Onboarding status — answers "what's left to set up?" for the dashboard
 * checklist at /onboarding. Each step reads the actual underlying resource
 * so the checklist is always truthful: configure something via the existing
 * pages, come back here, and the step flips to complete.
 *
 * Tier-aware: steps gated by entitlements the tenant doesn't have are
 * marked `locked: true` instead of being shown as TODO. The UI renders
 * locked steps with an "Upgrade plan to unlock" CTA, and progress is
 * computed only against UNLOCKED required steps so a Free-tier tenant
 * who can't reach Inbound/Phone/A2P still sees a path to 100%.
 *
 * Two completion signals per step (whichever is true):
 *   1. Data-based: the underlying resource exists / is configured
 *      (brandName + hours set, BusinessDNA published, prompt bound, etc.)
 *   2. User-marked: the tenant clicked "Save & Back to Get Started" on
 *      a step page and explicitly flagged that step done. Stored in
 *      Tenant.onboardingMarkedDone[stepKey] = true.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

type StepKey = 'profile' | 'dna' | 'agent' | 'channel' | 'number' | 'a2p'
const STEP_KEYS: readonly StepKey[] = ['profile', 'dna', 'agent', 'channel', 'number', 'a2p']

interface OnboardingStep {
  key:         StepKey
  label:       string
  description: string
  href:        string
  completed:   boolean
  optional?:   boolean
  /** True when the tenant's plan doesn't include this capability. The UI
   *  renders this as "Upgrade plan to unlock" instead of "to-do". Locked
   *  steps don't count against progress — they're not the user's fault. */
  locked?:     boolean
}

router.get('/onboarding/status', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!

  const [tenantRow, businessProfile, activeDNA, configuredAgent, inboundChannel, phoneCount, a2pApp, entitlements] = await Promise.all([
    // Tenant row — needed for onboardingMarkedDone (explicit user-marked
    // completion overrides). Always exists for an authenticated tenant.
    prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { onboardingMarkedDone: true },
    }),
    prisma.businessProfile.findFirst({
      where:  { tenantId },
      select: { brandName: true, businessHoursJson: true, addressLine1: true },
    }),
    prisma.businessDNA.findFirst({
      where:  { tenantId, isActive: true },
      select: { id: true },
    }),
    // Receptionist is "done" only once the user has explicitly bound a
    // published prompt to an enabled agent. Auto-provisioning enables a
    // few default agents on signup but doesn't bind prompts — checking
    // promptVersionId IS NOT NULL is the cleanest way to detect "user
    // actually visited /agents and configured something."
    prisma.agentProfile.findFirst({
      where:  { tenantId, isEnabled: true, NOT: { promptVersionId: null } },
      select: { id: true },
    }),
    prisma.channelConfig.findFirst({
      where:  { tenantId, channelType: 'INBOUND' },
      select: { isEnabled: true, promptVersionId: true },
    }),
    prisma.phoneNumber.count({ where: { tenantId } }),
    prisma.tenantA2PApplication.findUnique({
      where:  { tenantId },
      select: { status: true },
    }),
    // Tier capabilities — used to decide which steps are even reachable.
    prisma.tenantEntitlement.findMany({
      where:  { tenantId },
      select: { key: true, booleanValue: true, integerValue: true },
    }),
  ])

  // Explicit user-marked completions — overrides auto-detection so the
  // user can flag a step done even when auto-detection would say no.
  const markedDone = (tenantRow?.onboardingMarkedDone ?? {}) as Record<string, boolean>
  const isMarked = (k: StepKey) => markedDone[k] === true

  // Build a quick lookup. Booleans → boolean. Integers → number.
  const ent = new Map<string, boolean | number | null>()
  for (const e of entitlements) {
    ent.set(e.key, e.booleanValue ?? e.integerValue ?? null)
  }
  const inboundEnabled    = ent.get('inbound_enabled') === true
  const smsEnabled        = ent.get('sms_enabled') === true
  const maxPhoneNumbers   = (ent.get('max_phone_numbers') as number | null) ?? 0
  const phoneNumbersAllowed = maxPhoneNumbers > 0

  // Completion checks. Each step is "done" if EITHER the data-based
  // signal is true OR the user has explicitly marked it done via the
  // "Save & Back to Get Started" button.
  const profileDone = isMarked('profile') || (!!businessProfile?.brandName && !!businessProfile?.businessHoursJson)
  const dnaDone     = isMarked('dna')     || !!activeDNA
  const agentDone   = isMarked('agent')   || !!configuredAgent
  const channelDone = isMarked('channel') || !!inboundChannel?.isEnabled
  const numberDone  = isMarked('number')  || phoneCount > 0
  const a2pDone     = isMarked('a2p')     || a2pApp?.status === 'SUBMITTED' || a2pApp?.status === 'APPROVED'

  const steps: OnboardingStep[] = [
    { key: 'profile', label: 'Business Profile', description: 'Set your business name, hours, and contact details so the agent knows who it is representing.', href: '/settings',         completed: profileDone },
    { key: 'dna',     label: 'Business DNA',     description: 'Define your services, pricing notes, and operating rules. The agent uses this on every call.', href: '/business-dna',     completed: dnaDone },
    { key: 'agent',   label: 'Receptionist',     description: 'Pick a voice and bind a published prompt to the agent that will answer your calls.',           href: '/agents',           completed: agentDone },
    { key: 'channel', label: 'Inbound Channel',  description: 'Enable the inbound receptionist channel and bind your published prompt.',                       href: '/channels',         completed: channelDone, locked: !inboundEnabled },
    { key: 'number',  label: 'Phone Number',     description: 'Get a number for your business. Search by area code and purchase in one click.',                href: '/phone-numbers',    completed: numberDone,  locked: !phoneNumbersAllowed },
    { key: 'a2p',     label: 'SMS Compliance',   description: 'Register your business for A2P 10DLC so your AI agent can send SMS at full carrier throughput. Required if you plan to use SMS.', href: '/a2p',              completed: a2pDone, optional: true, locked: !smsEnabled },
  ]

  // Progress math: count only UNLOCKED steps so Free-tier tenants who
  // can't reach Inbound/Phone/A2P still have a reachable 100%. Locked
  // steps neither count as done nor as todo — they're just not on the
  // current plan.
  const reachable      = steps.filter(s => !s.locked)
  const completedCount = reachable.filter(s => s.completed).length
  const totalCount     = reachable.length
  const requiredSteps  = reachable.filter(s => !s.optional)
  const allRequiredDone = requiredSteps.every(s => s.completed)

  res.json({
    data: {
      steps,
      completedCount,
      totalCount,
      allComplete: allRequiredDone,
    },
  })
}))

// Explicit user-marked completion. Triggered by the "Save & Back to Get
// Started" button on a step page. Idempotent — calling this with a step
// that's already marked is a no-op.
const markStepDoneSchema = z.object({
  stepKey: z.enum(['profile', 'dna', 'agent', 'channel', 'number', 'a2p']),
})

router.post('/onboarding/mark-step-done', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const parsed = markStepDoneSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stepKey — must be one of profile/dna/agent/channel/number/a2p', 422)
  }

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { onboardingMarkedDone: true },
  })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)

  const current = (tenant.onboardingMarkedDone ?? {}) as Record<string, boolean>
  const next = { ...current, [parsed.data.stepKey]: true }
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { onboardingMarkedDone: next },
  })

  res.json({ data: { ok: true, markedDone: next } })
}))

export default router
