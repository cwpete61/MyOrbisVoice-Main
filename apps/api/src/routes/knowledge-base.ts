import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { checkEntitlement } from '../services/entitlement.service.js'
import * as kb from '../services/knowledge-base.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

// Multer in-memory storage. The file ends up in req.file.buffer.
// Limit at the multer layer matches our service-layer KB_MAX_FILE_BYTES so
// users never wait for an upload that we'd then reject.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: kb.KB_MAX_FILE_BYTES },
})

async function resolveCapBytes(tenantId: string): Promise<bigint> {
  const raw = await checkEntitlement(tenantId, 'kb_storage_mb')
  const mb  = typeof raw === 'number' ? raw : 0
  return BigInt(mb) * BigInt(1024 * 1024)
}

// POST /api/knowledge-base — multipart form-data, single field "file"
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file
    if (!file) throw new AppError('VALIDATION_ERROR', 'No file uploaded', 422)

    const tenantId = req.user!.currentTenantId!
    const capBytes = await resolveCapBytes(tenantId)
    if (capBytes === BigInt(0)) {
      throw new AppError(
        'FORBIDDEN',
        'Knowledge base is not included in your plan. Upgrade to Basic, Pro, Premier, or Enterprise.',
        403,
      )
    }

    const result = await kb.uploadKbFile({
      tenantId,
      uploadedById: req.user!.id,
      filename:     file.originalname,
      mimeType:     file.mimetype,
      buffer:       file.buffer,
      capBytes,
    })
    res.status(201).json({ data: result })
  } catch (err) { next(err) }
})

// GET /api/knowledge-base — list tenant's files
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const files = await kb.listKbFiles(tenantId)
    res.json({ data: files })
  } catch (err) { next(err) }
})

// GET /api/knowledge-base/usage — { usedBytes, capBytes, pct, fileCount }
router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const capBytes = await resolveCapBytes(tenantId)
    const usage    = await kb.getKbUsage(tenantId, capBytes)
    res.json({
      data: {
        usedBytes: usage.usedBytes.toString(),  // BigInt → string for JSON
        capBytes:  usage.capBytes.toString(),
        pct:       usage.pct,
        fileCount: usage.fileCount,
        capMb:     Number(usage.capBytes / BigInt(1024 * 1024)),
        usedMb:    Number(usage.usedBytes) / (1024 * 1024),
        maxFileMb: Math.floor(kb.KB_MAX_FILE_BYTES / (1024 * 1024)),
      },
    })
  } catch (err) { next(err) }
})

// GET /api/knowledge-base/:id/original — proxy the original file blob
router.get('/:id/original', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const id       = req.params['id']!
    const file     = await kb.downloadKbFile(tenantId, id)
    res.setHeader('Content-Type',        file.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`)
    res.send(file.buffer)
  } catch (err) { next(err) }
})

// DELETE /api/knowledge-base/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const id       = req.params['id']!
    await kb.deleteKbFile(tenantId, id, req.user!.id)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
