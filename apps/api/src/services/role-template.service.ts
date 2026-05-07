import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'
import { getTemplate, listTemplatesPublic, type RoleTemplate } from '../lib/role-templates.js'

export function listTemplates() {
  return listTemplatesPublic()
}

/**
 * Applies a platform role template to a tenant. Three side effects, in order:
 *
 *   1. Creates a NEW PromptVersion row owned by the tenant, scope='ROLE',
 *      agentRoleType from the template, status=PUBLISHED. The content is
 *      copied from the template — once applied, the tenant owns it and
 *      can edit freely.
 *   2. Auto-provisions the AgentProfile for that role if missing, then
 *      points its promptVersionId at the new row + flips isEnabled=true.
 *   3. (Best-effort) Adds the template's suggestedPrimaryServices to the
 *      tenant's active BusinessDNA identity if no primaryServices is set
 *      yet. Skips silently if DNA is missing or already has the field.
 *
 * Re-applying the same template (or a different one to the same role) is
 * idempotent in spirit: it creates a fresh PromptVersion (preserving
 * history) and re-points the AgentProfile. The previous prompt stays in
 * the tenant's history as DRAFT/PUBLISHED — the tenant can switch back
 * via the existing prompt UI at any time.
 */
export async function applyTemplate(
  tenantId:    string,
  templateId:  string,
  userId:      string | null,
): Promise<{ promptVersionId: string; agentProfileId: string; templateId: string }> {
  const template = getTemplate(templateId)
  if (!template) throw new AppError('NOT_FOUND', `Role template "${templateId}" not found`, 404)

  // Compute next versionNumber for this tenant + role
  const latest = await prisma.promptVersion.findFirst({
    where:   { tenantId, scope: 'ROLE', agentRoleType: template.roleType },
    orderBy: { versionNumber: 'desc' },
    select:  { versionNumber: true },
  })
  const nextVersion = (latest?.versionNumber ?? 0) + 1

  const [promptVersion, agentProfile] = await prisma.$transaction(async (tx) => {
    const pv = await tx.promptVersion.create({
      data: {
        tenantId,
        scope:           'ROLE',
        agentRoleType:   template.roleType,
        name:            `${template.name} (from template)`,
        content:         template.promptContent,
        status:          'PUBLISHED',
        versionNumber:   nextVersion,
        createdByUserId: userId,
        publishedAt:     new Date(),
      },
    })

    const ap = await tx.agentProfile.upsert({
      where:  { tenantId_agentRoleType: { tenantId, agentRoleType: template.roleType } },
      update: { promptVersionId: pv.id, isEnabled: true, displayName: template.shortLabel },
      create: {
        tenantId,
        agentRoleType:    template.roleType,
        displayName:      template.shortLabel,
        isEnabled:        true,
        modelProvider:    'gemini',
        modelName:        'gemini-2.5-flash-native-audio-preview-09-2025',
        promptVersionId:  pv.id,
      },
    })

    return [pv, ap]
  })

  // Best-effort: seed primaryServices into DNA if empty. Non-fatal.
  if (template.suggestedPrimaryServices.length > 0) {
    try {
      await mergePrimaryServices(tenantId, template.suggestedPrimaryServices)
    } catch (err) {
      console.warn('[role-template] mergePrimaryServices failed (non-fatal):', (err as Error).message)
    }
  }

  await writeAuditLog({
    tenantId,
    actorType:    userId ? 'USER' : 'SYSTEM',
    actorUserId:  userId ?? undefined,
    action:       'agent.template_applied',
    targetType:   'AgentProfile',
    targetId:     agentProfile.id,
    metadataJson: { templateId, roleType: template.roleType, promptVersionId: promptVersion.id },
  })

  return {
    promptVersionId: promptVersion.id,
    agentProfileId:  agentProfile.id,
    templateId,
  }
}

async function mergePrimaryServices(tenantId: string, suggested: string[]): Promise<void> {
  const dna = await prisma.businessDNA.findFirst({ where: { tenantId, isActive: true } })
  if (!dna) return
  const identity = (dna.identityJson ?? {}) as Record<string, unknown>
  const existing = Array.isArray(identity['primaryServices']) ? identity['primaryServices'] as string[] : []
  if (existing.length > 0) return  // tenant already configured — don't overwrite

  await prisma.businessDNA.update({
    where: { id: dna.id },
    data:  { identityJson: { ...identity, primaryServices: suggested } },
  })
}
