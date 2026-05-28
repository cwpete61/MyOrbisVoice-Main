import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, twilioMock, fetchMock } = vi.hoisted(() => {
  const fetch = vi.fn()
  return {
    prismaMock: {
      phoneNumber: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
    },
    twilioMock: {
      accountSid: 'ACmaster',
      incomingPhoneNumbers: (_sid: string) => ({ fetch }),
    },
    fetchMock: fetch,
  }
})

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./twilio.service.js', () => ({ getTwilioClient: async () => twilioMock }))

const { reconcileTwilioNumbers } = await import('./twilio-reconcile.service.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.auditLog.create.mockResolvedValue({})
})

describe('reconcileTwilioNumbers', () => {
  it('returns empty result when no purchased numbers exist', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    const r = await reconcileTwilioNumbers()
    expect(r.checkedCount).toBe(0)
    expect(r.drifts).toEqual([])
    expect(r.errors).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no drift when Twilio accountSid matches DB twilioSubaccountSid', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: 'ACtenant' },
    ])
    fetchMock.mockResolvedValueOnce({ accountSid: 'ACtenant' })
    const r = await reconcileTwilioNumbers()
    expect(r.checkedCount).toBe(1)
    expect(r.drifts).toEqual([])
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('no drift when DB subaccount is null and Twilio reports the master account', async () => {
    // null twilioSubaccountSid means "on master" per schema — must NOT flag.
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: null },
    ])
    fetchMock.mockResolvedValueOnce({ accountSid: 'ACmaster' })
    const r = await reconcileTwilioNumbers()
    expect(r.drifts).toEqual([])
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('flags drift when DB subaccount is null but Twilio shows a non-master account', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: null },
    ])
    fetchMock.mockResolvedValueOnce({ accountSid: 'ACsomeother' })
    const r = await reconcileTwilioNumbers()
    expect(r.drifts).toHaveLength(1)
    expect(r.drifts[0]).toMatchObject({ dbSubaccountSid: null, twilioSubaccountSid: 'ACsomeother' })
  })

  it('flags drift when Twilio shows different subaccount than DB', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: 'ACtenant' },
    ])
    fetchMock.mockResolvedValueOnce({ accountSid: 'ACpartner' })
    const r = await reconcileTwilioNumbers()
    expect(r.drifts).toHaveLength(1)
    expect(r.drifts[0]).toMatchObject({
      phoneNumberId: 'N1',
      dbSubaccountSid: 'ACtenant',
      twilioSubaccountSid: 'ACpartner',
      missingOnTwilio: false,
    })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'twilio.number.drift_detected',
          targetType: 'PhoneNumber',
          targetId: 'N1',
        }),
      }),
    )
  })

  it('flags missingOnTwilio when 404 / not-found', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: 'ACtenant' },
    ])
    const err: Error & { status?: number } = new Error('Resource not found 20404')
    fetchMock.mockRejectedValueOnce(err)
    const r = await reconcileTwilioNumbers()
    expect(r.drifts).toHaveLength(1)
    expect(r.drifts[0]?.missingOnTwilio).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('puts non-404 fetch errors into errors[], not drifts', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: 'ACtenant' },
    ])
    fetchMock.mockRejectedValueOnce(new Error('5xx server error'))
    const r = await reconcileTwilioNumbers()
    expect(r.drifts).toEqual([])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]?.message).toMatch(/5xx server error/)
  })

  it('respects limit option', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    await reconcileTwilioNumbers({ limit: 5 })
    expect(prismaMock.phoneNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    )
  })

  it('filters to PURCHASED + non-null twilioNumberSid', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    await reconcileTwilioNumbers()
    expect(prismaMock.phoneNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { purchaseStatus: 'PURCHASED', twilioNumberSid: { not: null } },
      }),
    )
  })

  it('handles many rows + records all drifts', async () => {
    prismaMock.phoneNumber.findMany.mockResolvedValue([
      { id: 'N1', e164Number: '+15550001', twilioNumberSid: 'PN1', twilioSubaccountSid: 'ACtenant' },
      { id: 'N2', e164Number: '+15550002', twilioNumberSid: 'PN2', twilioSubaccountSid: 'ACtenant' },
      { id: 'N3', e164Number: '+15550003', twilioNumberSid: 'PN3', twilioSubaccountSid: 'ACtenant' },
    ])
    // N1 matches, N2 drifts, N3 errors
    fetchMock
      .mockResolvedValueOnce({ accountSid: 'ACtenant' })
      .mockResolvedValueOnce({ accountSid: 'ACpartner' })
      .mockRejectedValueOnce(new Error('5xx'))
    const r = await reconcileTwilioNumbers()
    expect(r.checkedCount).toBe(3)
    expect(r.drifts).toHaveLength(1)
    expect(r.drifts[0]?.phoneNumberId).toBe('N2')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]?.phoneNumberId).toBe('N3')
  })
})
