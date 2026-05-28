/**
 * Webinar Marketing audit log helper. Wraps WebinarAuditLog inserts so
 * callers don't repeat the shape. Fire-and-forget — never block business
 * logic on audit-write failures.
 */
import { prisma } from '../../lib/prisma.js'

export type WebinarAuditAction =
  | 'list_created'
  | 'list_updated'
  | 'list_archived'
  | 'discovery_started'
  | 'discovery_completed'
  | 'url_crawled'
  | 'url_skipped'
  | 'email_extracted'
  | 'email_classified'
  | 'email_verified'
  | 'promoted_to_invite'
  | 'suppression_hit'
  | 'manual_review_approved'
  | 'manual_review_rejected'
  | 'exported_csv'
  | 'unsubscribe_received'

export interface WebinarAuditEntry {
  partnerId: string
  action: WebinarAuditAction
  entityType?: string
  entityId?: string
  details?: Record<string, unknown>
}

export async function log(entry: WebinarAuditEntry): Promise<void> {
  try {
    await prisma.webinarAuditLog.create({
      data: {
        partnerId: entry.partnerId,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        detailsJson: (entry.details ?? null) as never,
      },
    })
  } catch (err) {
    // Audit failures must not interrupt main flow. Log to stderr and move on.
    // eslint-disable-next-line no-console
    console.error('[webinar-marketing] audit log failed', err)
  }
}
