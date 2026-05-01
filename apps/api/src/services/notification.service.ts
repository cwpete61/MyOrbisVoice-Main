import { prisma } from '../lib/prisma.js'

export type NotificationPriority = 'critical' | 'warning' | 'info'
export type NotificationType =
  | 'storage_warning'
  | 'storage_critical'
  | 'twilio_error'
  | 'google_expiring'
  | 'campaign_complete'
  | 'admin_broadcast'
  | 'opt_out_received'
  | 'contact_created'

export interface CreateNotificationInput {
  tenantId:  string
  type:      NotificationType
  priority:  NotificationPriority
  title:     string
  body:      string
  linkPath?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({ data: input })
}

export async function listNotifications(tenantId: string, limit = 50) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where:   { tenantId },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take:    limit,
    }),
    prisma.notification.count({ where: { tenantId, readAt: null } }),
  ])
  return { items, unreadCount }
}

export async function markRead(tenantId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, tenantId, readAt: null },
    data:  { readAt: new Date() },
  })
}

export async function markAllRead(tenantId: string) {
  return prisma.notification.updateMany({
    where: { tenantId, readAt: null },
    data:  { readAt: new Date() },
  })
}

// Called after every recording upload or quota check — deduplicates by type so
// we don't spam the tenant with repeated storage warnings
export async function maybeCreateStorageNotification(
  tenantId: string,
  pct: number,
) {
  if (pct < 90) return

  const type: NotificationType = pct >= 100 ? 'storage_critical' : 'storage_warning'
  const priority: NotificationPriority = pct >= 100 ? 'critical' : 'warning'

  // Only create one unread notification of this type at a time
  const existing = await prisma.notification.findFirst({
    where: { tenantId, type, readAt: null },
  })
  if (existing) return

  const pctLabel = Math.round(pct)

  await createNotification({
    tenantId,
    type,
    priority,
    title: pct >= 100
      ? 'Recording storage full — new recordings paused'
      : `Recording storage at ${pctLabel}% — upgrade soon`,
    body: pct >= 100
      ? 'Your recording storage quota has been reached. New call recordings are paused until storage is freed or your plan is upgraded.'
      : `You have used ${pctLabel}% of your recording storage quota. Upgrade your plan to avoid interruptions.`,
    linkPath: '/billing',
  })
}
