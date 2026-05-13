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

// ── Phase E.5 — Tenant booking preferences ──────────────────────────────────
// Working hours + slot length + min notice + max advance + buffers + tenant
// timezone. Drives searchAvailability for non-partner bookings. Same shape as
// the partner equivalent at /api/partner/booking-preferences (E.3).

router.get('/business-profile/booking-preferences', async (req, res, next) => {
  try {
    const prefs = await tenantService.getTenantBookingPreferences(req.user!.currentTenantId!)
    res.json({ data: prefs })
  } catch (err) { next(err) }
})

router.put('/business-profile/booking-preferences', async (req, res, next) => {
  try {
    const updated = await tenantService.updateTenantBookingPreferences(req.user!.currentTenantId!, req.body ?? {})
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// Logo upload — raw binary stream, Content-Type carries the mime type
// Frontend sends: fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: file })
router.post('/business-profile/logo', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const ct = req.headers['content-type']?.split(';')[0]?.trim() ?? ''
    // Per project image rules (memory:image-rules) — only raster formats are
    // accepted. SVG is intentionally excluded because partner-uploaded SVG is
    // a known XSS vector when later inlined into emails or HTML templates.
    const allowed: Record<string, string> = {
      'image/png':     'png',
      'image/jpeg':    'jpg',
      'image/webp':    'webp',
    }
    if (!allowed[ct]) throw new AppError('VALIDATION_ERROR', 'Only PNG, JPG, and WebP are allowed', 422)

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

// ──────────────────────────────────────────────────────────────────────────────
// Tenant members — add, list, change role, remove. Owner can manage; managers
// can list. Owner cannot be removed via this API (kill-switch protection).
// ──────────────────────────────────────────────────────────────────────────────

const MANAGER_ROLES   = new Set(['tenant_owner', 'tenant_manager'])
const ASSIGNABLE_ROLES = ['tenant_owner', 'tenant_manager', 'tenant_staff'] as const

async function getCurrentMember(tenantId: string, userId: string) {
  return prisma.tenantMember.findFirst({
    where: { tenantId, userId },
    include: { roleDefinition: true },
  })
}

// GET /api/tenants/current/members
router.get('/tenants/current/members', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user:           { select: { id: true, email: true, username: true, firstName: true, lastName: true, lastLoginAt: true, status: true } },
        roleDefinition: { select: { key: true, name: true } },
      },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
    })
    res.json({ data: members })
  } catch (err) { next(err) }
})

// POST /api/tenants/current/members  { email, roleKey }
router.post('/tenants/current/members', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const callerId = req.user!.id
    const { email, roleKey } = validate(z.object({
      email:   z.string().email(),
      roleKey: z.enum(ASSIGNABLE_ROLES),
    }), req.body)

    // Permission check — only owner/manager can add members
    const caller = await getCurrentMember(tenantId, callerId)
    if (!caller || !MANAGER_ROLES.has(caller.roleDefinition.key)) {
      throw new AppError('FORBIDDEN', 'Only owners and managers can add members', 403)
    }

    // Resolve user by email
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new AppError('NOT_FOUND', 'No user with that email — they need to sign up first, then you can add them.', 404)
    }

    // Already a member?
    const existing = await prisma.tenantMember.findFirst({ where: { tenantId, userId: user.id } })
    if (existing) {
      throw new AppError('CONFLICT', 'That user is already a member of this workspace', 409)
    }

    const role = await prisma.roleDefinition.findUnique({ where: { key: roleKey } })
    if (!role) throw new AppError('VALIDATION_ERROR', 'Invalid role', 422)

    const member = await prisma.tenantMember.create({
      data: {
        tenantId,
        userId:           user.id,
        roleDefinitionId: role.id,
        isOwner:          false,
      },
      include: {
        user:           { select: { id: true, email: true, username: true, firstName: true, lastName: true, status: true, lastLoginAt: true } },
        roleDefinition: { select: { key: true, name: true } },
      },
    })

    res.status(201).json({ data: member })
  } catch (err) { next(err) }
})

// PATCH /api/tenants/current/members/:userId  { roleKey }
router.patch('/tenants/current/members/:userId', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const callerId  = req.user!.id
    const targetId  = req.params['userId']!
    const { roleKey } = validate(z.object({
      roleKey: z.enum(ASSIGNABLE_ROLES),
    }), req.body)

    const caller = await getCurrentMember(tenantId, callerId)
    if (!caller || caller.roleDefinition.key !== 'tenant_owner') {
      throw new AppError('FORBIDDEN', 'Only the owner can change member roles', 403)
    }

    const target = await prisma.tenantMember.findFirst({ where: { tenantId, userId: targetId }, include: { roleDefinition: true } })
    if (!target) throw new AppError('NOT_FOUND', 'Member not found', 404)
    if (target.isOwner) throw new AppError('FORBIDDEN', 'Cannot change the owner role here', 403)

    const role = await prisma.roleDefinition.findUnique({ where: { key: roleKey } })
    if (!role) throw new AppError('VALIDATION_ERROR', 'Invalid role', 422)

    const updated = await prisma.tenantMember.update({
      where: { id: target.id },
      data:  { roleDefinitionId: role.id },
      include: {
        user:           { select: { id: true, email: true, username: true, firstName: true, lastName: true, status: true, lastLoginAt: true } },
        roleDefinition: { select: { key: true, name: true } },
      },
    })

    res.json({ data: updated })
  } catch (err) { next(err) }
})

// DELETE /api/tenants/current/members/:userId
router.delete('/tenants/current/members/:userId', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const callerId  = req.user!.id
    const targetId  = req.params['userId']!

    const caller = await getCurrentMember(tenantId, callerId)
    if (!caller || !MANAGER_ROLES.has(caller.roleDefinition.key)) {
      throw new AppError('FORBIDDEN', 'Only owners and managers can remove members', 403)
    }

    const target = await prisma.tenantMember.findFirst({ where: { tenantId, userId: targetId } })
    if (!target) throw new AppError('NOT_FOUND', 'Member not found', 404)
    if (target.isOwner) throw new AppError('FORBIDDEN', 'Cannot remove the workspace owner', 403)
    if (target.userId === callerId) throw new AppError('FORBIDDEN', 'Cannot remove yourself — ask another manager to do it', 403)

    await prisma.tenantMember.delete({ where: { id: target.id } })
    res.sendStatus(204)
  } catch (err) { next(err) }
})

export default router
