import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// Mock Prisma so we can drive the promotion gate's branches without a DB.
const { prismaMock, auditLog } = vi.hoisted(() => ({
  prismaMock: {
    webinarExtractedEmail: { findUnique: vi.fn(), update: vi.fn() },
    webinarSuppression: { findUnique: vi.fn() },
    webinarInviteContact: { create: vi.fn() },
  },
  auditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./audit.service.js', () => ({ log: auditLog }))

const { promoteToInvite } = await import('./promotion.service.js')

function extracted(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ee1',
    leadList: {
      id: 'L1',
      partnerId: 'P1',
      niche: 'dentist',
      location: 'atlanta',
      verificationMode: 'EXTERNAL_PROVIDER',
      allowedEmailTypes: ['business_domain_only', 'role_based_business'],
    },
    emailType: 'BUSINESS_DOMAIN',
    email: 'info@dentalclinic.com',
    normalizedEmail: 'info@dentalclinic.com',
    sourceUrl: 'https://dentalclinic.com/contact',
    verifications: [
      {
        providerStatus: 'deliverable',
        provider: 'reoon',
        disposable: false,
        mxValid: true,
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.webinarSuppression.findUnique.mockResolvedValue(null)
  prismaMock.webinarInviteContact.create.mockResolvedValue({ id: 'IC1' })
  prismaMock.webinarExtractedEmail.update.mockResolvedValue({})
})

describe('promoteToInvite — happy paths', () => {
  it('promotes BUSINESS_DOMAIN + deliverable + opted_in', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.contactId).toBe('IC1')
    expect(prismaMock.webinarInviteContact.create).toHaveBeenCalledOnce()
  })

  it('promotes ROLE_BASED_BUSINESS with MANUAL_LAWFUL_BASIS_REVIEWED + notes', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({ emailType: 'ROLE_BASED_BUSINESS' }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'MANUAL_LAWFUL_BASIS_REVIEWED',
      lawfulBasisNotes: 'Public business contact page',
    })
    expect(out.ok).toBe(true)
  })

  it('accepts risky verification when mode = SYNTAX_DNS_ONLY + mxValid', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({
        leadList: {
          ...extracted().leadList,
          verificationMode: 'SYNTAX_DNS_ONLY',
        },
        verifications: [{ providerStatus: 'risky', provider: 'internal_dns', disposable: false, mxValid: true }],
      }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(true)
  })
})

describe('promoteToInvite — gate failures', () => {
  it('rejects when ExtractedEmail not found', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(null)
    const out = await promoteToInvite({
      extractedEmailId: 'missing',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/not found/i)
  })

  it('rejects PERSONAL_FREE_MAIL emailType', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({ emailType: 'PERSONAL_FREE_MAIL' }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/not promotable/)
    expect(prismaMock.webinarInviteContact.create).not.toHaveBeenCalled()
  })

  it('rejects DISPOSABLE_DOMAIN emailType', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({ emailType: 'DISPOSABLE_DOMAIN' }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
  })

  it('rejects when no verification record', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({ verifications: [] }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/verification/)
  })

  it('rejects when verification.disposable = true', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({
        verifications: [{ providerStatus: 'deliverable', provider: 'reoon', disposable: true, mxValid: true }],
      }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/disposable/)
  })

  it('rejects providerStatus = undeliverable', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({
        verifications: [{ providerStatus: 'undeliverable', provider: 'reoon', disposable: false, mxValid: false }],
      }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
  })

  it('rejects providerStatus = risky in EXTERNAL_PROVIDER mode', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({
        verifications: [{ providerStatus: 'risky', provider: 'reoon', disposable: false, mxValid: true }],
      }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
  })

  it('rejects when suppression hit', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    prismaMock.webinarSuppression.findUnique.mockResolvedValue({
      id: 'S1', email: 'info@dentalclinic.com', reason: 'bounce',
    })
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/suppressed/)
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'suppression_hit' }),
    )
  })

  it('rejects when sourceUrl is null', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(
      extracted({ sourceUrl: null }),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/sourceUrl/)
  })

  it('rejects consentStatus = NOT_APPROVED', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'NOT_APPROVED',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/NOT_APPROVED/)
  })

  it('rejects MANUAL_LAWFUL_BASIS_REVIEWED without notes', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'MANUAL_LAWFUL_BASIS_REVIEWED',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/lawfulBasisNotes/)
  })

  it('rejects MANUAL_LAWFUL_BASIS_REVIEWED with empty-string notes', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'MANUAL_LAWFUL_BASIS_REVIEWED',
      lawfulBasisNotes: '   ',
    })
    expect(out.ok).toBe(false)
  })
})

describe('promoteToInvite — duplicate guard', () => {
  it('handles P2002 from unique index by marking source approved + returning duplicate reason', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    prismaMock.webinarInviteContact.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'duplicate key',
        { code: 'P2002', clientVersion: 'x' },
      ),
    )
    const out = await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(out.ok).toBe(false)
    expect((out as { reason: string }).reason).toMatch(/duplicate/)
    expect(prismaMock.webinarExtractedEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ classificationStatus: 'APPROVED' }) }),
    )
  })

  it('re-throws non-P2002 errors', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    prismaMock.webinarInviteContact.create.mockRejectedValue(
      new Error('unrelated failure'),
    )
    await expect(
      promoteToInvite({ extractedEmailId: 'ee1', consentStatus: 'OPTED_IN' }),
    ).rejects.toThrow('unrelated failure')
  })
})

describe('audit logging', () => {
  it('writes promoted_to_invite audit on success', async () => {
    prismaMock.webinarExtractedEmail.findUnique.mockResolvedValue(extracted())
    await promoteToInvite({
      extractedEmailId: 'ee1',
      consentStatus: 'OPTED_IN',
    })
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'promoted_to_invite',
        entityType: 'WebinarInviteContact',
      }),
    )
  })
})
