import type { Request } from 'express'
import { prisma } from './prisma.js'
import { Prisma } from '@prisma/client'

interface AuditEntry {
  tenantId?: string
  actorType: 'USER' | 'ADMIN' | 'SYSTEM' | 'WORKFLOW'
  actorUserId?: string
  /** When set, this audit row was written by an admin acting through a
   *  tenant impersonation session. Lets the audit log distinguish
   *  "real tenant user did X" from "admin Y did X while impersonating". */
  impersonationSessionId?: string
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
        impersonationSessionId: entry.impersonationSessionId,
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

/** Wraps writeAuditLog with automatic impersonation-session attribution.
 *  Call this from route handlers that have a Request in scope — it pulls
 *  req.user.impersonationSessionId if the caller is an admin acting through
 *  a tenant support session. Falls through to a normal audit write otherwise. */
export async function writeAuditLogFromRequest(req: Request, entry: AuditEntry): Promise<void> {
  return writeAuditLog({
    ...entry,
    impersonationSessionId: entry.impersonationSessionId ?? req.user?.impersonationSessionId,
  })
}
