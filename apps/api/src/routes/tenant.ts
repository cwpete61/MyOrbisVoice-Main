import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as tenantService from '../services/tenant.service.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'
import { getEnv } from '@voiceautomation/config'
import path from 'node:path'
import fs from 'node:fs/promises'

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? '/app/uploads'
const MAX_SIZE = 2 * 1024 * 1024

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root'
      fields[key] = [...(fields[key] ?? []), issue.message]
    }
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fields)
  }
  return result.data
}

router.get('/tenants/current', async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenant(req.user!.currentTenantId!)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.patch('/tenants/current', async (req, res, next) => {
  try {
    const data = validate(tenantService.updateTenantSchema, req.body)
    const tenant = await tenantService.updateTenant(req.user!.currentTenantId!, data)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.get('/business-profile', async (req, res, next) => {
  try {
    const profile = await tenantService.getBusinessProfile(req.user!.currentTenantId!)
    res.json({ data: profile })
  } catch (err) { next(err) }
})

router.patch('/business-profile', async (req, res, next) => {
  try {
    const data = validate(tenantService.updateBusinessProfileSchema, req.body)
    const profile = await tenantService.upsertBusinessProfile(req.user!.currentTenantId!, data)
    res.json({ data: profile })
  } catch (err) { next(err) }
})

// Logo upload — raw binary stream, Content-Type carries the mime type
// Frontend sends: fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: file })
router.post('/business-profile/logo', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const ct = req.headers['content-type']?.split(';')[0]?.trim() ?? ''
    const allowed: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
    if (!allowed[ct]) throw new AppError('VALIDATION_ERROR', 'Only PNG, JPG and WebP are allowed', 422)

    // Read raw body from stream
    const chunks: Buffer[] = []
    let total = 0
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_SIZE) { reject(new AppError('VALIDATION_ERROR', 'Logo must be under 2 MB', 422)); return }
        chunks.push(chunk)
      })
      req.on('end', resolve)
      req.on('error', reject)
    })

    const buffer = Buffer.concat(chunks)
    const ext = allowed[ct]!
    const dir = path.join(UPLOADS_DIR, 'logos')
    const filePath = path.join(dir, `${tenantId}.${ext}`)
    const apiBase = getEnv().API_BASE_URL.replace(/\/$/, '')
    const logoUrl = `${apiBase}/uploads/logos/${tenantId}.${ext}`

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, buffer)

    await prisma.businessProfile.upsert({
      where: { tenantId },
      create: { tenantId, brandName: '', logoUrl },
      update: { logoUrl },
    })

    res.json({ data: { logoUrl } })
  } catch (err) { next(err) }
})

// Returns the logo URL for the current tenant
router.get('/business-profile/logo', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const profile = await prisma.businessProfile.findUnique({ where: { tenantId }, select: { logoUrl: true } })
    res.json({ data: { logoUrl: profile?.logoUrl ?? null } })
  } catch (err) { next(err) }
})

export default router
