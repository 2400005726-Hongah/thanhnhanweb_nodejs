import prisma from '../config/prisma.js'

const writeAuditLog = async (
  {
    userId,
    role,
    action,
    entityType,
    entityId,
    description,
    actorName,
    reason,
    metadata,
  },
  database = prisma,
) => {
  if (!database.auditLog?.create) {
    return null
  }

  return database.auditLog.create({
    data: {
      userId,
      role,
      action,
      entityType,
      entityId: String(entityId),
      description,
      actorName: actorName || null,
      reason: reason || null,
      metadata: metadata || undefined,
    },
  })
}

export { writeAuditLog }
