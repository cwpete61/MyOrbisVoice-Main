/**
 * Onboarding status — answers "what's left to set up?" for the dashboard
 * checklist at /onboarding. Each step reads the actual underlying resource
 * so the checklist is always truthful: configure something via the existing
 * pages, come back here, and the step flips to complete.
 */
import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

interface OnboardingStep {
  key:         'profile' | 'dna' | 'agent' | 'channel' | 'number' | 'a2p'
  label:       string
  description: string
  href:        string
  completed:   boolean
  optional?:   boolean
}

router.get('/onboarding/status', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!

  const [businessProfile, activeDNA, receptionist, inboundChannel, phoneCount, a2pApp] = await Promise.all([
    prisma.businessProfile.findFirst({
      where:  { tenantId },
      select: { brandName: true, businessHoursJson: true, addressLine1: true },
    }),
    prisma.businessDNA.findFirst({
      where:  { tenantId, isActive: true },
      select: { id: true },
    }),
    // "Receptionist" in product copy maps to any enabled agent — typically
    // SECRETARY or ASSISTANT is what answers phones. Step is done when at
    // least one agent profile is enabled with a model picked.
    prisma.agentProfile.findFirst({
      where:  { tenantId, isEnabled: true, NOT: { modelName: '' } },
      select: { isEnabled: true, modelName: true },
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
  ])

  // Profile is "done" once brand name is set AND hours are configured
  const profileDone = !!businessProfile?.brandName && !!businessProfile?.businessHoursJson
  // DNA is "done" once a published version exists
  const dnaDone     = !!activeDNA
  // Agent is "done" once at least one agent is enabled with a model picked
  const agentDone   = !!receptionist
  // Channel is "done" once Inbound is enabled
  const channelDone = !!inboundChannel?.isEnabled
  // Number is "done" once at least one number is purchased
  const numberDone  = phoneCount > 0
  // A2P is "done" once the application has been submitted (or approved).
  // DRAFT and missing both count as not-done. REJECTED counts as not-done so
  // tenant returns to fix issues.
  const a2pDone     = a2pApp?.status === 'SUBMITTED' || a2pApp?.status === 'APPROVED'

  const steps: OnboardingStep[] = [
    { key: 'profile', label: 'Business Profile', description: 'Set your business name, hours, and contact details so the agent knows who it is representing.', href: '/settings',         completed: profileDone },
    { key: 'dna',     label: 'Business DNA',     description: 'Define your services, pricing notes, and operating rules. The agent uses this on every call.', href: '/business-dna',     completed: dnaDone },
    { key: 'agent',   label: 'Receptionist',     description: 'Pick a voice and tune the receptionist agent that will answer your calls.',                    href: '/agents',           completed: agentDone },
    { key: 'channel', label: 'Inbound Channel',  description: 'Enable the inbound receptionist channel and bind your published prompt.',                       href: '/channels',         completed: channelDone },
    { key: 'number',  label: 'Phone Number',     description: 'Get a number for your business. Search by area code and purchase in one click.',                href: '/phone-numbers',    completed: numberDone },
    { key: 'a2p',     label: 'SMS Compliance',   description: 'Register your business for A2P 10DLC so your AI agent can send SMS at full carrier throughput. Required if you plan to use SMS.', href: '/a2p',              completed: a2pDone, optional: true },
  ]

  // completedCount counts ALL steps that are done (including optional ones)
  // for progress-bar display. allComplete only requires REQUIRED steps so a
  // tenant who skips an optional step (e.g. A2P, if they aren't using SMS)
  // still sees "you are all set."
  const completedCount = steps.filter(s => s.completed).length
  const requiredSteps  = steps.filter(s => !s.optional)
  const allRequiredDone = requiredSteps.every(s => s.completed)

  res.json({
    data: {
      steps,
      completedCount,
      totalCount:  steps.length,
      allComplete: allRequiredDone,
    },
  })
}))

export default router
