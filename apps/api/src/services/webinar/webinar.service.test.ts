import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The publish gate and the video-column translation.
 *
 * Both exist to stop the same class of bug: a webinar that looks live but cannot do its
 * job. A play button over nothing still emits WATCHED heartbeats, so a "published"
 * webinar with no video doesn't fail loudly — it quietly scores every lead on fiction
 * and feeds that to the hero rule. The gate is the only thing standing between that and
 * a prospect.
 */
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    webinar: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./identity.service.js', () => ({ resolvePerson: vi.fn() }))
vi.mock('./events.service.js', () => ({ appendEvent: vi.fn() }))
vi.mock('../appointment.service.js', () => ({ createAppointment: vi.fn() }))
vi.mock('../contact.service.js', () => ({ createContact: vi.fn() }))
vi.mock('../opt-out.service.js', () => ({ processOptIn: vi.fn() }))
vi.mock('./entitlement.js', () => ({ webinarWhiteLabel: vi.fn().mockResolvedValue(false) }))

const { assertPublishable, updateWebinar } = await import('./webinar.service.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.webinar.update.mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data))
})

describe('assertPublishable — a live webinar must be able to do its job', () => {
  it('passes when it has both a video and a CTA', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue({ videoProvider: 'YOUTUBE', videoAssetRef: 'dQw4w9WgXcQ', ctaUrl: 'https://cal.com/x' })
    await expect(assertPublishable('t1', 'w1')).resolves.toBeUndefined()
  })

  // THE ONE THAT MATTERS: this is the exact bug the feature exists to kill.
  it('refuses without a video — that ships a play button over nothing', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue({ videoProvider: null, videoAssetRef: null, ctaUrl: 'https://cal.com/x' })
    await expect(assertPublishable('t1', 'w1')).rejects.toThrow(/add a video/i)
  })

  it('refuses without a CTA — CTA_CLICKED is what triggers the follow-up call', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue({ videoProvider: 'YOUTUBE', videoAssetRef: 'dQw4w9WgXcQ', ctaUrl: null })
    await expect(assertPublishable('t1', 'w1')).rejects.toThrow(/CTA link/i)
  })

  it('names both when both are missing, so it takes one trip not two', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue({ videoProvider: null, videoAssetRef: null, ctaUrl: null })
    await expect(assertPublishable('t1', 'w1')).rejects.toThrow(/video.*and.*CTA/i)
  })

  // Half a video renders a broken player. Guard against the pair drifting apart.
  it('refuses a provider with no ref', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue({ videoProvider: 'YOUTUBE', videoAssetRef: null, ctaUrl: 'https://cal.com/x' })
    await expect(assertPublishable('t1', 'w1')).rejects.toThrow(/add a video/i)
  })

  it('is tenant-scoped — another tenant\'s webinar is a 404, not a pass', async () => {
    prismaMock.webinar.findFirst.mockResolvedValue(null)
    await expect(assertPublishable('t1', 'w1')).rejects.toThrow(/not found/i)
    expect(prismaMock.webinar.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'w1', tenantId: 't1' },
    }))
  })
})

describe('updateWebinar — videoUrl is an input, not a column', () => {
  beforeEach(() => prismaMock.webinar.findFirst.mockResolvedValue({ id: 'w1' }))

  it('expands a pasted URL into the provider/ref pair', async () => {
    const data = await updateWebinar('t1', 'w1', { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(data).toMatchObject({ videoProvider: 'YOUTUBE', videoAssetRef: 'dQw4w9WgXcQ' })
    // Passing videoUrl through to Prisma would throw on the unknown column.
    expect(data).not.toHaveProperty('videoUrl')
  })

  it('clears BOTH columns when the field is emptied — never half a video', async () => {
    expect(await updateWebinar('t1', 'w1', { videoUrl: '' })).toMatchObject({ videoProvider: null, videoAssetRef: null })
  })

  it('leaves the video alone when videoUrl is absent from the patch', async () => {
    const data = await updateWebinar('t1', 'w1', { title: 'New title' })
    expect(data).not.toHaveProperty('videoProvider')
    expect(data).not.toHaveProperty('videoAssetRef')
  })

  it('rejects a video URL we cannot parse rather than storing junk', async () => {
    await expect(updateWebinar('t1', 'w1', { videoUrl: 'https://evil.example/x' })).rejects.toThrow(/YouTube or Vimeo/)
  })

  // An href, not an iframe — but javascript: in an href still executes on click.
  it('rejects a javascript: CTA link', async () => {
    await expect(updateWebinar('t1', 'w1', { ctaUrl: 'javascript:alert(1)' })).rejects.toThrow(/not allowed/)
  })

  it('clears the CTA when emptied', async () => {
    expect(await updateWebinar('t1', 'w1', { ctaUrl: '' })).toMatchObject({ ctaUrl: null })
  })

  it('does not touch the CTA when absent', async () => {
    expect(await updateWebinar('t1', 'w1', { title: 'x' })).not.toHaveProperty('ctaUrl')
  })
})
