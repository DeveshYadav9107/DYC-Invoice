// ─────────────────────────────────────────────────────────────────
// Audit Log Service — Enterprise action tracking
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';

/**
 * Creates an immutable audit log entry.
 */
export async function createAuditLog({
  organizationId,
  actorId,
  entityType,
  entityId,
  action,
  metadata = {},
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        organizationId: organizationId || null,
        actorId: actorId || null,
        entityType,
        entityId: entityId || null,
        action,
        metadata,
      },
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
    return null;
  }
}
