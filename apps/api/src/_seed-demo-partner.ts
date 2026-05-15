import { prisma } from './lib/prisma.js'
import bcrypt from 'bcryptjs'

async function main() {
  const pwd = await bcrypt.hash('demo123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo-partner@example.com' },
    create: {
      email: 'demo-partner@example.com',
      username: 'demopartner',
      passwordHash: pwd,
      firstName: 'Lisa',
      lastName: 'Campbell',
      preferredTimezone: 'America/New_York',
    },
    update: { passwordHash: pwd },
  })

  // Skip TenantMember for now — booking page is public, doesn't need it.
  // (Tenant membership only matters for partner-portal login, which we'd
  // need RoleDefinition rows for; not the focus here.)

  // Fake Google connection so calendarReady is true on booking-info.
  // Slots endpoint will still fail trying to hit real Google free/busy,
  // but the page will render with empty slot columns (the "—" state).
  const conn = await prisma.integrationConnection.upsert({
    where: { id: 'demo-conn-1' },
    create: {
      id: 'demo-conn-1',
      provider: 'GOOGLE',
      status: 'CONNECTED',
      label: 'Demo Google',
      externalAccountId: 'demo-google-account',
      externalEmail: 'demo-partner@example.com',
    },
    update: {},
  })

  const aff = await prisma.affiliateAccount.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      referralCode: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      slug: 'demo',
      displayName: 'Lisa Campbell',
      businessName: 'Queen Umoja',
      bio: 'Coach/Consultant\nAI Digital Creator',
      partnerPageActive: true,
      bookingSlotDurationMin: 45,
      bookingMinNoticeMin: 60,
      bookingMaxAdvanceDays: 30,
      bookingTimezone: 'America/New_York',
      bookingHoursJson: {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
      },
      status: 'ACTIVE',
    },
    update: {
      slug: 'demo',
      displayName: 'Lisa Campbell',
      businessName: 'Queen Umoja',
      bio: 'Coach/Consultant\nAI Digital Creator',
      partnerPageActive: true,
      bookingSlotDurationMin: 45,
      bookingTimezone: 'America/New_York',
      bookingHoursJson: {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
      },
    },
  })

  // Wire the IntegrationConnection.affiliateAccount relation (one-to-one).
  await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: { affiliateAccount: { connect: { id: aff.id } } },
  })

  // Then link the AffiliateAccount.integrationConnectionId pointer.
  await prisma.affiliateAccount.update({
    where: { id: aff.id },
    data: { integrationConnectionId: conn.id },
  })

  console.log('SEEDED:')
  console.log('  partner slug:', aff.slug)
  console.log('  partnerPageActive:', true)
  console.log('  user email:    demo-partner@example.com')
  console.log('  user username: demopartner')
  console.log('  password:      demo123')
  await prisma.$disconnect()
}
main().catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
