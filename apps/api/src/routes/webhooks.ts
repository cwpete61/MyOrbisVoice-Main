import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { handleStripeWebhook } from '../services/stripe.service.js'

const router: IRouter = Router()

// Mounted at /api/webhooks/stripe in index.ts — route path is '/'
router.post(
  '/',
  // raw body required for signature verification — express.json() must not run before this
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sig = req.headers['stripe-signature']
      if (!sig || typeof sig !== 'string') {
        res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'Missing stripe-signature header' }] })
        return
      }
      await handleStripeWebhook(req.body as Buffer, sig)
      res.json({ received: true })
    } catch (err) {
      next(err)
    }
  },
)

export { router as webhooksRouter }
