import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenantMember: { findMany: vi.fn() },
    affiliateAccount: { findUnique: vi.fn() },
    phoneNumber: { findMany: vi.fn() },
  },
}))
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { listMyTwilioInventory } = await import('./twilio-inventory.service.js')

const SAMPLE_NUMBERS = [
  {
    id: 'N1',
    e164Number: '+15551234567',
    displayLabel: 'Main line',
    notes: null,
    twilioNumberSid: 'PNxxx',
    isInboundEnabled: true,
    isOutboundEnabled: true,
    isSmsEnabled: true,
    monthlyPriceCents: 200,
    partnerCapabilityTier: null,
    a2pStatus: 'APPROVED',
    purchaseStatus: 'PURCHASED',
    agentProfileId: null,
    createdAt: new Date('2026-01-01'),
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tenantMember.findMany.mockResolvedValue([])
  prismaMock.affiliateAccount.findUnique.mockResolvedValue(null)
  prismaMock.phoneNumber.findMany.mockResolvedValue([])
})

describe('listMyTwilioInventory', () => {
  it('returns empty + canTransfer=false when user owns nothing', async () => {
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts).toEqual([])
    expect(result.canTransfer).toBe(false)
  })

  it('skips tenants where TenantMember.isOwner=false (does the query filter)', async () => {
    await listMyTwilioInventory('U1')
    // The where-clause must require isOwner: true — assert the query is shaped that way.
    expect(prismaMock.tenantMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'U1', isOwner: true }) }),
    )
  })

  it('skips tenants without a TenantTwilioSubaccount', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([
      { tenant: { id: 'T1', displayName: 'Acme', twilioSubaccount: null } },
    ])
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts).toEqual([])
  })

  it('returns one tenant subaccount with its numbers', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([
      {
        tenant: {
          id: 'T1',
          displayName: 'Acme Co',
          twilioSubaccount: { id: 'SUB1', twilioSubaccountSid: 'ACtenant', status: 'ACTIVE' },
        },
      },
    ])
    prismaMock.phoneNumber.findMany.mockResolvedValueOnce(SAMPLE_NUMBERS)
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts).toHaveLength(1)
    expect(result.subaccounts[0]?.kind).toBe('tenant')
    expect(result.subaccounts[0]?.ownerEntityId).toBe('T1')
    expect(result.subaccounts[0]?.label).toBe('Acme Co')
    expect(result.subaccounts[0]?.twilioSubaccountSid).toBe('ACtenant')
    expect(result.subaccounts[0]?.numbers).toHaveLength(1)
    expect(result.canTransfer).toBe(false) // only one subaccount
  })

  it('skips a soft-deleted partner', async () => {
    prismaMock.affiliateAccount.findUnique.mockResolvedValue({
      id: 'P1',
      displayName: 'Partner Co',
      businessName: null,
      deletedAt: new Date(),
      twilioSubaccount: { id: 'SUB2', twilioSubaccountSid: 'ACpartner', status: 'ACTIVE' },
      user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@x.com' },
    })
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts).toEqual([])
  })

  it('skips a partner without a PartnerTwilioSubaccount', async () => {
    prismaMock.affiliateAccount.findUnique.mockResolvedValue({
      id: 'P1',
      displayName: 'Partner Co',
      businessName: null,
      deletedAt: null,
      twilioSubaccount: null,
      user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@x.com' },
    })
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts).toEqual([])
  })

  it('returns combined tenant + partner with canTransfer=true', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([
      {
        tenant: {
          id: 'T1',
          displayName: 'Acme Co',
          twilioSubaccount: { id: 'SUB1', twilioSubaccountSid: 'ACtenant', status: 'ACTIVE' },
        },
      },
    ])
    prismaMock.affiliateAccount.findUnique.mockResolvedValue({
      id: 'P1',
      displayName: 'Partner Co',
      businessName: null,
      deletedAt: null,
      twilioSubaccount: { id: 'SUB2', twilioSubaccountSid: 'ACpartner', status: 'ACTIVE' },
      user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@x.com' },
    })
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    const result = await listMyTwilioInventory('U1')
    expect(result.subaccounts.map((s) => s.kind)).toEqual(['tenant', 'partner'])
    expect(result.canTransfer).toBe(true)
  })

  it('partner label falls back to businessName then first+last then email', async () => {
    // Case A: displayName wins
    prismaMock.affiliateAccount.findUnique.mockResolvedValueOnce({
      id: 'P1', displayName: 'Alpha LLC', businessName: 'Alpha Biz', deletedAt: null,
      twilioSubaccount: { id: 'SUB', twilioSubaccountSid: 'AC', status: 'ACTIVE' },
      user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
    })
    let r = await listMyTwilioInventory('U1')
    expect(r.subaccounts[0]?.label).toBe('Alpha LLC')

    // Case B: businessName when no displayName
    vi.clearAllMocks()
    prismaMock.tenantMember.findMany.mockResolvedValue([])
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    prismaMock.affiliateAccount.findUnique.mockResolvedValueOnce({
      id: 'P1', displayName: null, businessName: 'Beta Inc', deletedAt: null,
      twilioSubaccount: { id: 'SUB', twilioSubaccountSid: 'AC', status: 'ACTIVE' },
      user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
    })
    r = await listMyTwilioInventory('U1')
    expect(r.subaccounts[0]?.label).toBe('Beta Inc')

    // Case C: first+last
    vi.clearAllMocks()
    prismaMock.tenantMember.findMany.mockResolvedValue([])
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    prismaMock.affiliateAccount.findUnique.mockResolvedValueOnce({
      id: 'P1', displayName: null, businessName: null, deletedAt: null,
      twilioSubaccount: { id: 'SUB', twilioSubaccountSid: 'AC', status: 'ACTIVE' },
      user: { firstName: 'Jane', lastName: 'Doe', email: 'a@b.com' },
    })
    r = await listMyTwilioInventory('U1')
    expect(r.subaccounts[0]?.label).toBe('Jane Doe')

    // Case D: email when names are blank
    vi.clearAllMocks()
    prismaMock.tenantMember.findMany.mockResolvedValue([])
    prismaMock.phoneNumber.findMany.mockResolvedValue([])
    prismaMock.affiliateAccount.findUnique.mockResolvedValueOnce({
      id: 'P1', displayName: null, businessName: null, deletedAt: null,
      twilioSubaccount: { id: 'SUB', twilioSubaccountSid: 'AC', status: 'ACTIVE' },
      user: { firstName: null, lastName: null, email: 'a@b.com' },
    })
    r = await listMyTwilioInventory('U1')
    expect(r.subaccounts[0]?.label).toBe('a@b.com')
  })

  it('partner number query filters by partnerId only (not tenantId)', async () => {
    prismaMock.affiliateAccount.findUnique.mockResolvedValue({
      id: 'P1', displayName: 'Partner Co', businessName: null, deletedAt: null,
      twilioSubaccount: { id: 'SUB2', twilioSubaccountSid: 'ACpartner', status: 'ACTIVE' },
      user: { firstName: null, lastName: null, email: 'a@b.com' },
    })
    await listMyTwilioInventory('U1')
    // The partner-side phoneNumber.findMany call should look up by partnerId
    expect(prismaMock.phoneNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partnerId: 'P1' } }),
    )
  })

  it('tenant number query excludes partner-owned rows (partnerId: null)', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([
      {
        tenant: {
          id: 'T1',
          displayName: 'Acme',
          twilioSubaccount: { id: 'SUB1', twilioSubaccountSid: 'ACtenant', status: 'ACTIVE' },
        },
      },
    ])
    await listMyTwilioInventory('U1')
    expect(prismaMock.phoneNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1', partnerId: null } }),
    )
  })
})
