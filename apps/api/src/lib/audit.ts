import { prisma } from './prisma.js'
import { Prisma } from '@prisma/client'

interface AuditEntry {
  tenantId?: string
  actorType: 'USER' | 'ADMIN' | 'SYSTEM' | 'WORKFLOW'
  actorUserId?: string
  action: string
  targetType?: string
  targetId?: string
  metadataJson?: Record<string, unknown>
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        action: entry.action,
        targetType: entry.targetType ?? 'System',
        tenantId: entry.tenantId,
        actorUserId: entry.actorUserId,
        targetId: entry.targetId,
        metadataJson: entry.metadataJson
          ? (entry.metadataJson as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    })
  } catch {
    // Non-fatal — never let audit failure block a user action
  }
}
