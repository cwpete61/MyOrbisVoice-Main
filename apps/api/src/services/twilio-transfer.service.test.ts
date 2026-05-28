import { describe, it, expect, vi, beforeEach } from 'vitest'

// We mock the inventory service so we control which subaccounts the user
// "owns" without touching Prisma for that path. We also mock Prisma for the
// transfer path itself (phoneNumber + auditLog + tenant) and the Twilio
// client for the actual provider call.

const { listMock, prismaMock, twilioMock, twilioUpdateMock } = vi.hoisted(() => {
  const update = vi.fn()
  return {
    listMock: vi.fn(),
    prismaMock: {
      phoneNumber: { findUnique: vi.fn(), update: vi.fn() },
      tenant: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(async (ops: unknown[]) => {
        // Just run ops sequentially — they're all Prisma calls in this test.
        const results: unknown[] = []
        for (const op of ops) results.push(await op)
        return results
      }),
    },
    twilioMock: {
      incomingPhoneNumbers: (_sid: string) => ({ update }),
    },
    twilioUpdateMock: update,
  }
})

vi.mock('./twilio-inventory.service.js', () => ({ listMyTwilioInventory: listMock }))
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./twilio.service.js', () => ({ getTwilioClient: async () => twilioMock }))

const { previewNumberTransfer, transferNumber } = await import('./twilio-transfer.service.js')

function tenantSub(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'tenant' as const,
    subaccountRecordId: 'SUBREC1',
    twilioSubaccountSid: 'ACtenant',
    ownerEntityId: 'T1',
    label: 'Acme Co',
    status: 'ACTIVE',
    numbers: [],
    ...overrides,
  }
}
function partnerSub(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'partner' as const,
    subaccountRecordId: 'SUBREC2',
    twilioSubaccountSid: 'ACpartner',
    ownerEntityId: 'P1',
    label: 'Partner Co',
    status: 'ACTIVE',
    numbers: [],
    ...overrides,
  }
}
function num(overrides: Record<string, unknown> = {}) {
  return {
    id: 'N1',
    e164Number: '+15551234567',
    displayLabel: null,
    notes: null,
    twilioNumberSid: 'PNxxx',
    isInboundEnabled: true,
    isOutboundEnabled: true,
    isSmsEnabled: false,
    monthlyPriceCents: 200,
    partnerCapabilityTier: null,
    a2pStatus: 'NOT_REQUIRED',
    purchaseStatus: 'PURCHASED',
    agentProfileId: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  twilioUpdateMock.mockResolvedValue({})
  prismaMock.tenant.findFirst.mockResolvedValue({ id: 'PLATFORM' })
})

// ─── previewNumberTransfer ────────────────────────────────────────────────

describe('previewNumberTransfer — blockers', () => {
  it('throws 404 when number not in any owned subaccount', async () => {
    listMock.mockResolvedValue({ subaccounts: [tenantSub({ numbers: [] })], canTransfer: false })
    await expect(
      previewNumberTransfer('U1', 'missing', { kind: 'partner', partnerId: 'P1' }),
    ).rejects.toThrow(/not found/i)
  })

  it('flags TARGET_NOT_OWNED when target subaccount not in user inventory', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] })],
      canTransfer: false,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'PSomeoneElse' })
    expect(r.ok).toBe(false)
    expect(r.blockers.map((b) => b.code)).toContain('TARGET_NOT_OWNED')
  })

  it('flags SAME_SUBACCOUNT when source and target are the same record', async () => {
    const t = tenantSub({ numbers: [num()] })
    listMock.mockResolvedValue({ subaccounts: [t, t], canTransfer: false })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'tenant', tenantId: 'T1' })
    expect(r.blockers.map((b) => b.code)).toContain('SAME_SUBACCOUNT')
  })

  it('flags NOT_PURCHASED when number is pending', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ purchaseStatus: 'PENDING' })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.blockers.map((b) => b.code)).toContain('NOT_PURCHASED')
    expect(r.ok).toBe(false)
  })

  it('flags MISSING_TWILIO_SID when twilioNumberSid is null', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ twilioNumberSid: null })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.blockers.map((b) => b.code)).toContain('MISSING_TWILIO_SID')
  })

  it('flags A2P_PENDING_REVIEW for PENDING_QUEUE', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ a2pStatus: 'PENDING_QUEUE' })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.blockers.map((b) => b.code)).toContain('A2P_PENDING_REVIEW')
  })

  it('flags A2P_PENDING_REVIEW for SUBMITTED', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ a2pStatus: 'SUBMITTED' })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.blockers.map((b) => b.code)).toContain('A2P_PENDING_REVIEW')
  })
})

describe('previewNumberTransfer — warnings', () => {
  it('always emits BRIEF_ROUTING_GAP, CREDIT_LEDGER_STAYS, CHANGES_AGENT_OWNER', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] }), partnerSub()],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    const codes = r.warnings.map((w) => w.code)
    expect(codes).toContain('BRIEF_ROUTING_GAP')
    expect(codes).toContain('CREDIT_LEDGER_STAYS')
    expect(codes).toContain('CHANGES_AGENT_OWNER')
  })

  it('adds A2P_REREGISTRATION when current a2pStatus = APPROVED', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ a2pStatus: 'APPROVED', isSmsEnabled: true })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.warnings.map((w) => w.code)).toContain('A2P_REREGISTRATION')
  })

  it('adds WEBHOOK_REROUTE when number isSmsEnabled', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ isSmsEnabled: true })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.warnings.map((w) => w.code)).toContain('WEBHOOK_REROUTE')
  })

  it('does NOT add A2P_REREGISTRATION when a2pStatus = NOT_REQUIRED', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] }), partnerSub()],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.warnings.map((w) => w.code)).not.toContain('A2P_REREGISTRATION')
  })

  it('ok=true when no blockers (warnings alone do not block)', async () => {
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub({ numbers: [num({ a2pStatus: 'APPROVED', isSmsEnabled: true })] }),
        partnerSub(),
      ],
      canTransfer: true,
    })
    const r = await previewNumberTransfer('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(r.ok).toBe(true)
    expect(r.blockers).toHaveLength(0)
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

// ─── transferNumber ───────────────────────────────────────────────────────

describe('transferNumber', () => {
  it('refuses if preflight has blockers', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num({ purchaseStatus: 'PENDING' })] }), partnerSub()],
      canTransfer: true,
    })
    await expect(
      transferNumber('U1', 'N1', { kind: 'partner', partnerId: 'P1' }),
    ).rejects.toThrow(/Cannot transfer/i)
    expect(twilioUpdateMock).not.toHaveBeenCalled()
  })

  it('happy path: Twilio update + DB swap + audit log run in transaction', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] }), partnerSub()],
      canTransfer: true,
    })
    prismaMock.phoneNumber.findUnique.mockResolvedValue({
      id: 'N1', e164Number: '+15551234567',
      twilioNumberSid: 'PNxxx', tenantId: 'T1', partnerId: null, a2pStatus: 'NOT_REQUIRED',
    })
    prismaMock.phoneNumber.update.mockResolvedValue({})
    prismaMock.auditLog.create.mockResolvedValue({})

    const r = await transferNumber('U1', 'N1', { kind: 'partner', partnerId: 'P1' }, 'iphash')
    expect(twilioUpdateMock).toHaveBeenCalledWith({ accountSid: 'ACpartner' })
    expect(r.fromSubaccountSid).toBe('ACtenant')
    expect(r.toSubaccountSid).toBe('ACpartner')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('partner target sets partnerId + nulls tenantId to platform + resets agent', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] }), partnerSub()],
      canTransfer: true,
    })
    prismaMock.phoneNumber.findUnique.mockResolvedValue({
      id: 'N1', e164Number: '+15551234567',
      twilioNumberSid: 'PNxxx', tenantId: 'T1', partnerId: null, a2pStatus: 'APPROVED',
    })

    await transferNumber('U1', 'N1', { kind: 'partner', partnerId: 'P1' })
    expect(prismaMock.phoneNumber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'N1' },
        data: expect.objectContaining({
          tenantId: 'PLATFORM',
          partnerId: 'P1',
          twilioSubaccountSid: 'ACpartner',
          a2pStatus: 'NOT_REQUIRED',
          agentProfileId: null,
        }),
      }),
    )
  })

  it('tenant target sets tenantId + nulls partnerId', async () => {
    // User owns BOTH and is moving from partner subaccount back to tenant.
    listMock.mockResolvedValue({
      subaccounts: [
        tenantSub(),
        partnerSub({ numbers: [num({ id: 'N2' })] }),
      ],
      canTransfer: true,
    })
    prismaMock.phoneNumber.findUnique.mockResolvedValue({
      id: 'N2', e164Number: '+15551234567',
      twilioNumberSid: 'PNyyy', tenantId: 'PLATFORM', partnerId: 'P1', a2pStatus: 'NOT_REQUIRED',
    })
    await transferNumber('U1', 'N2', { kind: 'tenant', tenantId: 'T1' })
    expect(prismaMock.phoneNumber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'T1',
          partnerId: null,
          twilioSubaccountSid: 'ACtenant',
        }),
      }),
    )
  })

  it('Twilio failure leaves DB untouched + throws PROVIDER_ERROR', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num()] }), partnerSub()],
      canTransfer: true,
    })
    prismaMock.phoneNumber.findUnique.mockResolvedValue({
      id: 'N1', e164Number: '+15551234567',
      twilioNumberSid: 'PNxxx', tenantId: 'T1', partnerId: null, a2pStatus: 'NOT_REQUIRED',
    })
    twilioUpdateMock.mockRejectedValue(new Error('Twilio API error: 21610'))
    await expect(
      transferNumber('U1', 'N1', { kind: 'partner', partnerId: 'P1' }),
    ).rejects.toThrow(/Twilio transfer failed/i)
    expect(prismaMock.phoneNumber.update).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('audit log captures from/to + previousA2pStatus + ipHash', async () => {
    listMock.mockResolvedValue({
      subaccounts: [tenantSub({ numbers: [num({ a2pStatus: 'APPROVED' })] }), partnerSub()],
      canTransfer: true,
    })
    prismaMock.phoneNumber.findUnique.mockResolvedValue({
      id: 'N1', e164Number: '+15551234567',
      twilioNumberSid: 'PNxxx', tenantId: 'T1', partnerId: null, a2pStatus: 'APPROVED',
    })
    await transferNumber('U1', 'N1', { kind: 'partner', partnerId: 'P1' }, 'iphash16')
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: 'USER',
          actorUserId: 'U1',
          action: 'twilio.number.transfer',
          targetType: 'PhoneNumber',
          targetId: 'N1',
          ipHash: 'iphash16',
          metadataJson: expect.objectContaining({
            fromSubaccountSid: 'ACtenant',
            toSubaccountSid: 'ACpartner',
            fromKind: 'tenant',
            toKind: 'partner',
            previousA2pStatus: 'APPROVED',
          }),
        }),
      }),
    )
  })
})
