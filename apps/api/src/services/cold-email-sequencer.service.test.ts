import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocked Prisma + send service — lets us test the sequencer's decision logic
// (when a lead advances, stops, completes) without a database.
const { prismaMock, sendColdEmail } = vi.hoisted(() => ({
  prismaMock: {
    coldEmailCampaign: { findMany: vi.fn(), update: vi.fn() },
    coldEmailCampaignLead: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
  sendColdEmail: vi.fn(),
}))
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./cold-email.service.js', () => ({ sendColdEmail }))

const { runSequencerTick } = await import('./cold-email-sequencer.service.js')

const past = new Date(Date.now() - 86_400_000) // due
const future = new Date(Date.now() + 86_400_000) // not due

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    partnerId: 'p1',
    status: 'ACTIVE',
    touches: [
      { touchNumber: 1, delayDays: 0, subject: 'Hi', bodyHtml: '<p>1</p>' },
      { touchNumber: 2, delayDays: 3, subject: 'Follow', bodyHtml: '<p>2</p>' },
    ],
    ...overrides,
  }
}
function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cl1',
    currentTouch: 0,
    nextTouchAt: past,
    createdAt: past,
    lead: { email: 'biz@example.com' },
    ...overrides,
  }
}

/** Set up one campaign + its leads for a tick. */
function arrange(c: Record<string, unknown>, leads: Record<string, unknown>[]) {
  prismaMock.coldEmailCampaign.findMany.mockResolvedValue([c])
  prismaMock.coldEmailCampaignLead.findMany.mockResolvedValue(leads)
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.coldEmailCampaign.update.mockResolvedValue({})
  prismaMock.coldEmailCampaignLead.update.mockResolvedValue({})
  prismaMock.coldEmailCampaignLead.count.mockResolvedValue(1) // leads remain → campaign stays ACTIVE
})

describe('runSequencerTick', () => {
  it('no active campaigns → does nothing', async () => {
    prismaMock.coldEmailCampaign.findMany.mockResolvedValue([])
    const result = await runSequencerTick()
    expect(result).toEqual({ campaigns: 0, processed: 0, sent: 0 })
    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('unscheduled lead → schedules touch 1, does not send', async () => {
    arrange(campaign(), [lead({ nextTouchAt: null })])
    await runSequencerTick()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nextTouchAt: expect.any(Date) }) }),
    )
    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('lead not yet due → skipped entirely', async () => {
    arrange(campaign(), [lead({ nextTouchAt: future })])
    const result = await runSequencerTick()
    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(prismaMock.coldEmailCampaignLead.update).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
  })

  it('due lead, SENT, a follow-up exists → advances to IN_PROGRESS', async () => {
    arrange(campaign(), [lead({ currentTouch: 0 })])
    sendColdEmail.mockResolvedValue({ outcome: 'SENT', sendId: 's1' })
    const result = await runSequencerTick()
    expect(sendColdEmail).toHaveBeenCalledOnce()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentTouch: 1, status: 'IN_PROGRESS' }) }),
    )
    expect(result.sent).toBe(1)
  })

  it('due lead, SENT, no follow-up left → COMPLETED', async () => {
    arrange(campaign(), [lead({ currentTouch: 1 })]) // next touch = 2 (last)
    sendColdEmail.mockResolvedValue({ outcome: 'SENT', sendId: 's1' })
    await runSequencerTick()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentTouch: 2, status: 'COMPLETED', nextTouchAt: null }) }),
    )
  })

  it('due lead, SUPPRESSED → STOPPED', async () => {
    arrange(campaign(), [lead({ currentTouch: 0 })])
    sendColdEmail.mockResolvedValue({ outcome: 'SUPPRESSED', sendId: 's1' })
    await runSequencerTick()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STOPPED' }) }),
    )
  })

  it('due lead, BLOCKED → left untouched for the next tick', async () => {
    arrange(campaign(), [lead({ currentTouch: 0 })])
    sendColdEmail.mockResolvedValue({ outcome: 'BLOCKED', sendId: 's1' })
    const result = await runSequencerTick()
    expect(prismaMock.coldEmailCampaignLead.update).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
  })

  it('lead already past the last touch → COMPLETED without sending', async () => {
    arrange(campaign(), [lead({ currentTouch: 2 })]) // next touch = 3, none exists
    await runSequencerTick()
    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  it('due lead with no email → STOPPED, never sent', async () => {
    arrange(campaign(), [lead({ currentTouch: 0, lead: { email: null } })])
    await runSequencerTick()
    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(prismaMock.coldEmailCampaignLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STOPPED' }) }),
    )
  })

  it('campaign with all leads finished → marked COMPLETED', async () => {
    arrange(campaign(), [])
    prismaMock.coldEmailCampaignLead.count.mockResolvedValue(0) // no leads in flight
    await runSequencerTick()
    expect(prismaMock.coldEmailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  it('campaign with no touches → skipped', async () => {
    arrange(campaign({ touches: [] }), [lead()])
    const result = await runSequencerTick()
    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(result.processed).toBe(0)
  })
})
