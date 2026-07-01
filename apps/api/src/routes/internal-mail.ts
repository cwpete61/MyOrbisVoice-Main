import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { AppError } from '@voiceautomation/shared'
import { ingestRawMessage } from '../services/mail-ingest.service.js'

/**
 * Legacy internal mail ingestion route — kept for a possible Postfix pipe path.
 * The live inbound path is now the IMAP poller (jobs/imap-poller.ts) reading the
 * Spacemail catch-all; both share ingestRawMessage(). See docs/email-setup.md.
 *
 * Auth: shared secret in `x-mail-ingest-token` vs MAIL_INGEST_TOKEN, constant-time.
 */
const router: IRouter = Router()

function internalMailAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env['MAIL_INGEST_TOKEN']
  const provided = req.headers['x-mail-ingest-token']
  if (!expected || expected.length < 16) { next(new AppError('UNAUTHORIZED', 'Mail ingest token not configured', 401)); return }
  if (typeof provided !== 'string' || provided.length !== expected.length) { next(new AppError('UNAUTHORIZED', 'Invalid mail ingest token', 401)); return }
  const a = Buffer.from(provided), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) { next(new AppError('UNAUTHORIZED', 'Invalid mail ingest token', 401)); return }
  next()
}

router.use('/internal/mail', internalMailAuth)

router.post('/internal/mail/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw: Buffer | string = req.body
    if (!raw || (typeof raw !== 'string' && !Buffer.isBuffer(raw))) {
      throw new AppError('VALIDATION_ERROR', 'Empty or invalid request body', 422)
    }
    const envelopeRecipient = (req.headers['x-original-recipient'] as string | undefined) ?? undefined
    const result = await ingestRawMessage(raw, envelopeRecipient)
    res.json({ data: result })
  } catch (err) { next(err) }
})

export default router
