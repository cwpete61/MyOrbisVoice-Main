#!/usr/bin/env node
/**
 * Seed a demo partner the driver can log in as. Idempotent (upsert).
 * Resolves @prisma/client + bcryptjs from apps/api; reads DATABASE_URL from
 * apps/api/.env (or root .env) if not already set.
 *
 *   node .claude/skills/run-myorbisvoice/seed-demo.mjs
 *   → gmb-demo@local.test / Demo1234!
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const req = createRequire(resolve(root, 'apps/api/package.json'))

if (!process.env.DATABASE_URL) {
  for (const p of [resolve(root, 'apps/api/.env'), resolve(root, '.env')]) {
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/^DATABASE_URL=(.+)$/m)
    if (m) { process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, ''); break }
  }
}

const { PrismaClient } = req('@prisma/client')
const bcrypt = req('bcryptjs')
const prisma = new PrismaClient()

const EMAIL = 'gmb-demo@local.test'
const PASSWORD = 'Demo1234!'

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  update: { passwordHash: await bcrypt.hash(PASSWORD, 10), status: 'ACTIVE' },
  create: { email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10), status: 'ACTIVE', firstName: 'GMB', lastName: 'Demo' },
})
await prisma.affiliateAccount.upsert({
  where: { userId: user.id },
  update: { status: 'ACTIVE', partnerPageActive: true },
  create: { userId: user.id, referralCode: 'GMBDEMO', status: 'ACTIVE', slug: 'gmb-demo', displayName: 'GMB Demo Partner', businessName: 'Acme Local Marketing', partnerPhone: '(610) 555-0100', partnerPageActive: true },
})
console.log('demo partner ready →', EMAIL, '/', PASSWORD)
await prisma.$disconnect()
