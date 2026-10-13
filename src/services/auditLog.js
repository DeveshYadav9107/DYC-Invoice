// ─────────────────────────────────────────────────────────────────
// Audit Log Service — Enterprise action tracking
// Records security, invoice modification, and export events
// ─────────────────────────────────────────────────────────────────

import prisma from '@/lib/prisma';

/**
 * Creates an immutable audit log entry.
 * @param {object} params
 * @param {string} [params.organizationId] - Tenant ID
 * @param {string} [params.actorId] - User ID performing the action
 * @param {string} params.entityType - 'INVOICE', 'EXPORT_BATCH', 'USER', 'ORGANIZATION', 'AUTH'
 * @param {string} [params.entityId] - ID of affected entity
 * @param {string} params.action - Action verb e.g. 'UPLOADED', 'EDITED', 'EXPORTED', 'LOGGED_IN'
 * @param {object} [params.metadata] - Additional JSON metadata
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
    // Audit logging should never crash primary user flow
    console.error('Failed to create audit log entry:', err);
    return null;
  }
}
