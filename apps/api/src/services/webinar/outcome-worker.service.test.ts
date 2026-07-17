import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The hero rule and the CALLED meter. This is the legal boundary of the product:
 * getting it wrong means auto-dialling someone who never agreed to a call, or billing
 * a customer for a call that never left. Both are regressions a type-checker cannot
 * catch, so they are pinned here.
 */
const { prismaMock, appendEventMock, dispatchMock, enabledMock, quotaMock } = vi.hoisted(() => ({
  prismaMock: {
    outboundCampaign:   { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    outboundCallAttempt: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    engagementScore:    { findMany: vi.fn() },
    interactionEvent:   { findMany: vi.fn() },
    webinarPerson:      { findUnique: vi.fn(), findFirst: vi.fn() },
    webinar:            { findUnique: vi.fn() },
  },
  appendEventMock: vi.fn(),
  dispatchMock:    vi.fn(),
  enabledMock:     vi.fn(),
  quotaMock:       vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./events.service.js', () => ({ appendEvent: appendEventMock }))
vi.mock('../outbound.service.js', () => ({ dispatchPendingCalls: dispatchMock }))
vi.mock('./entitlement.js', () => ({ webinarEnabled: enabledMock, aiCallsRemaining: quotaMock }))

const { runTick } = await import('./outcome-worker.service.js')

/** Default: nothing to reconcile, one eligible engaged lead, plan wide open. */
function arrangeEligibleLead() {
  prismaMock.outboundCampaign.findMany.mockResolvedValue([])           // no bridges to reconcile
  prismaMock.engagementScore.findMany.mockResolvedValue([{ personId: 'p1', webinarId: 'w1', tenantId: 't1' }])
  prismaMock.interactionEvent.findMany.mockResolvedValue([{ type: 'CTA_CLICKED' }, { type: 'WATCHED' }])
  prismaMock.webinarPerson.findUnique.mockResolvedValue({ contactId: 'c1' })
  prismaMock.webinar.findUnique.mockResolvedValue({ title: 'Roofing 101' })
  enabledMock.mockResolvedValue(true)
  quotaMock.mockResolvedValue({ ok: true, cap: 100, used: 1 })
  prismaMock.outboundCampaign.findFirst.mockResolvedValue({ id: 'bridge1' })
  prismaMock.outboundCallAttempt.findFirst.mockResolvedValue(null)     // no prior attempt
  prismaMock.outboundCallAttempt.create.mockResolvedValue({ id: 'a1' })
  prismaMock.outboundCallAttempt.findUnique.mockResolvedValue({ status: 'PENDING', outcomeCode: null, providerCallId: 'CA1' })
}

beforeEach(() => vi.clearAllMocks())

describe('hero rule — who gets chased', () => {
  it('dials an engaged lead who clicked the CTA and never booked', async () => {
    arrangeEligibleLead()
    await runTick()
    expect(prismaMock.outboundCallAttempt.create).toHaveBeenCalled()
    expect(dispatchMock).toHaveBeenCalledWith('t1', 'bridge1')
  })

  it('does NOT dial someone who never clicked the CTA', async () => {
    arrangeEligibleLead()
    prismaMock.interactionEvent.findMany.mockResolvedValue([{ type: 'WATCHED' }])
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('does NOT dial someone who already booked — they converted', async () => {
    arrangeEligibleLead()
    prismaMock.interactionEvent.findMany.mockResolvedValue([{ type: 'CTA_CLICKED' }, { type: 'BOOKED' }])
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('does NOT dial someone who already purchased', async () => {
    arrangeEligibleLead()
    prismaMock.interactionEvent.findMany.mockResolvedValue([{ type: 'CTA_CLICKED' }, { type: 'PURCHASED' }])
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('does NOT dial twice — a prior CALLED ends the chase', async () => {
    arrangeEligibleLead()
    prismaMock.interactionEvent.findMany.mockResolvedValue([{ type: 'CTA_CLICKED' }, { type: 'CALLED' }])
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('does NOT dial a person with no Contact — no Contact means no consent state at all', async () => {
    arrangeEligibleLead()
    prismaMock.webinarPerson.findUnique.mockResolvedValue({ contactId: null })
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('never re-attempts a contact that already has an attempt on this bridge', async () => {
    arrangeEligibleLead()
    prismaMock.outboundCallAttempt.findFirst.mockResolvedValue({ id: 'prior' })
    await runTick()
    expect(prismaMock.outboundCallAttempt.create).not.toHaveBeenCalled()
    expect(dispatchMock).not.toHaveBeenCalled()
  })
})

describe('plan gates stop the spend', () => {
  it('does not dial when the product is not in the plan', async () => {
    arrangeEligibleLead()
    enabledMock.mockResolvedValue(false)
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('does not dial once the monthly AI-call cap is reached', async () => {
    arrangeEligibleLead()
    quotaMock.mockResolvedValue({ ok: false, cap: 50, used: 50 })
    await runTick()
    expect(dispatchMock).not.toHaveBeenCalled()
  })
})

describe('CALLED is emitted only for calls that really left', () => {
  function arrangeResolvedAttempt(outcomeCode: string) {
    prismaMock.engagementScore.findMany.mockResolvedValue([])   // skip the chase phase
    prismaMock.outboundCampaign.findMany.mockResolvedValue([{ id: 'b1', tenantId: 't1', audienceJson: { kind: 'webinar_hero_bridge', webinarId: 'w1' } }])
    prismaMock.outboundCallAttempt.findMany.mockResolvedValue([{ id: 'a1', contactId: 'c1', outcomeCode }])
    prismaMock.webinarPerson.findFirst.mockResolvedValue({ id: 'p1' })
  }

  it('emits CALLED with the real outcome when the call was answered', async () => {
    arrangeResolvedAttempt('answered')
    await runTick()
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CALLED', personId: 'p1', tenantId: 't1', webinarId: 'w1',
      meta: { callId: 'a1', outcome: 'answered' },
      traceId: 'webinar:called:a1',
    }))
  })

  it.each(['busy', 'no_answer'])('emits CALLED for a real dial that ended %s', async (code) => {
    arrangeResolvedAttempt(code)
    await runTick()
    expect(appendEventMock).toHaveBeenCalled()
  })

  // THE ONE THAT MATTERS: a suppressed call was never placed. Emitting CALLED would
  // both lie on the Sales Timeline and burn the customer's metered allowance.
  it('does NOT emit CALLED when the compliance gate suppressed the call', async () => {
    arrangeResolvedAttempt('opted_out_voice')
    await runTick()
    expect(appendEventMock).not.toHaveBeenCalled()
  })

  it('does NOT emit CALLED when dispatch failed before reaching the network', async () => {
    arrangeResolvedAttempt('dispatch_error: 20003: Authenticate')
    await runTick()
    expect(appendEventMock).not.toHaveBeenCalled()
  })
})

describe('tick resilience', () => {
  it('never throws out of the tick — a bad row must not kill the worker', async () => {
    prismaMock.outboundCampaign.findMany.mockRejectedValue(new Error('db down'))
    await expect(runTick()).resolves.toBeUndefined()
  })
})
