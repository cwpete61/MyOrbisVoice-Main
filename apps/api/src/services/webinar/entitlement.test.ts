import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, checkEntitlementMock } = vi.hoisted(() => ({
  prismaMock: {
    webinar: { count: vi.fn() },
    interactionEvent: { count: vi.fn() },
  },
  checkEntitlementMock: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../entitlement.service.js', () => ({ checkEntitlement: checkEntitlementMock }))

const { webinarEnabled, webinarWhiteLabel, canPublishAnotherWebinar, aiCallsRemaining, monthStart } =
  await import('./entitlement.js')

beforeEach(() => vi.clearAllMocks())

/**
 * These gates decide whether the product runs and whether we spend money dialling
 * people. The rule that matters most: a MISSING entitlement must fail CLOSED. A tenant
 * with no row is not "unlimited", it is "not in plan".
 */
describe('webinarEnabled', () => {
  it('true only for an explicit true', async () => {
    checkEntitlementMock.mockResolvedValue(true)
    expect(await webinarEnabled('t1')).toBe(true)
  })
  it('fails closed when the entitlement is missing', async () => {
    checkEntitlementMock.mockResolvedValue(null)
    expect(await webinarEnabled('t1')).toBe(false)
  })
  it('fails closed on a non-boolean value', async () => {
    checkEntitlementMock.mockResolvedValue(5) // wrong valueType seeded
    expect(await webinarEnabled('t1')).toBe(false)
  })
})

describe('webinarWhiteLabel', () => {
  it('grants white-label only on explicit true', async () => {
    checkEntitlementMock.mockResolvedValue(true)
    expect(await webinarWhiteLabel('t1')).toBe(true)
  })
  it('missing key keeps the "Powered by" mark (fails closed to showing it)', async () => {
    checkEntitlementMock.mockResolvedValue(null)
    expect(await webinarWhiteLabel('t1')).toBe(false)
  })
})

describe('canPublishAnotherWebinar', () => {
  it('allows while under the cap', async () => {
    checkEntitlementMock.mockResolvedValue(3)
    prismaMock.webinar.count.mockResolvedValue(2)
    await expect(canPublishAnotherWebinar('t1')).resolves.toMatchObject({ ok: true, cap: 3, used: 2 })
  })
  it('blocks AT the cap, not just over it', async () => {
    checkEntitlementMock.mockResolvedValue(1)
    prismaMock.webinar.count.mockResolvedValue(1)
    await expect(canPublishAnotherWebinar('t1')).resolves.toMatchObject({ ok: false })
  })
  it('-1 means unlimited and does not even count', async () => {
    checkEntitlementMock.mockResolvedValue(-1)
    await expect(canPublishAnotherWebinar('t1')).resolves.toMatchObject({ ok: true })
    expect(prismaMock.webinar.count).not.toHaveBeenCalled()
  })
  it('missing key = cap 0 = blocked (fails closed)', async () => {
    checkEntitlementMock.mockResolvedValue(null)
    prismaMock.webinar.count.mockResolvedValue(0)
    await expect(canPublishAnotherWebinar('t1')).resolves.toMatchObject({ ok: false, cap: 0 })
  })
  it('counts only PUBLISHED — drafts are free', async () => {
    checkEntitlementMock.mockResolvedValue(2)
    prismaMock.webinar.count.mockResolvedValue(0)
    await canPublishAnotherWebinar('t1')
    expect(prismaMock.webinar.count).toHaveBeenCalledWith({ where: { tenantId: 't1', status: 'PUBLISHED' } })
  })
})

describe('aiCallsRemaining', () => {
  it('allows while under the monthly cap', async () => {
    checkEntitlementMock.mockResolvedValue(50)
    prismaMock.interactionEvent.count.mockResolvedValue(49)
    await expect(aiCallsRemaining('t1')).resolves.toMatchObject({ ok: true, cap: 50, used: 49 })
  })
  it('blocks at the cap', async () => {
    checkEntitlementMock.mockResolvedValue(50)
    prismaMock.interactionEvent.count.mockResolvedValue(50)
    await expect(aiCallsRemaining('t1')).resolves.toMatchObject({ ok: false })
  })
  it('cap 0 (free tier) blocks every call — scoring still runs, dialling does not', async () => {
    checkEntitlementMock.mockResolvedValue(0)
    prismaMock.interactionEvent.count.mockResolvedValue(0)
    await expect(aiCallsRemaining('t1')).resolves.toMatchObject({ ok: false, cap: 0 })
  })
  it('-1 is unlimited', async () => {
    checkEntitlementMock.mockResolvedValue(-1)
    await expect(aiCallsRemaining('t1')).resolves.toMatchObject({ ok: true })
    expect(prismaMock.interactionEvent.count).not.toHaveBeenCalled()
  })
  it('missing key fails closed rather than granting unlimited calls', async () => {
    checkEntitlementMock.mockResolvedValue(null)
    prismaMock.interactionEvent.count.mockResolvedValue(0)
    await expect(aiCallsRemaining('t1')).resolves.toMatchObject({ ok: false, cap: 0 })
  })

  // The meter must bill only for calls that actually happened. A call suppressed by the
  // compliance gate, or one that died on a Twilio error, cost nothing — counting it
  // would burn the customer's allowance for work we never did.
  it('counts CALLED events for this tenant in the current month only', async () => {
    checkEntitlementMock.mockResolvedValue(10)
    prismaMock.interactionEvent.count.mockResolvedValue(1)
    await aiCallsRemaining('t9')
    const arg = prismaMock.interactionEvent.count.mock.calls[0]![0] as {
      where: { tenantId: string; type: string; ts: { gte: Date } }
    }
    expect(arg.where.tenantId).toBe('t9')
    expect(arg.where.type).toBe('CALLED')
    expect(arg.where.ts.gte.getTime()).toBe(monthStart().getTime())
  })
})

describe('monthStart', () => {
  it('is the first instant of the current UTC month', () => {
    const m = monthStart(new Date('2026-07-17T23:45:12Z'))
    expect(m.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
  it('does not drift on the 1st', () => {
    const m = monthStart(new Date('2026-07-01T00:00:00Z'))
    expect(m.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
})
