/**
 * MAGEED GROUP — Audit Logging Service
 * Records administrative actions to the AuditLog table.
 *
 * Usage:
 *   const { logAudit } = require('../utils/auditService');
 *   await logAudit({ action: 'CREATE', entity: 'product', entityId: 5, adminId: req.adminId, ip: req.ip, details: '...' });
 *
 * Uses singleton PrismaClient.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * Log an administrative action to the AuditLog table.
 * Non-blocking — errors are caught and logged, never thrown.
 *
 * @param {Object} params
 * @param {string} params.action - e.g. 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT'
 * @param {string} params.entity - e.g. 'product', 'order', 'company', 'customer', 'return'
 * @param {number} [params.entityId] - ID of the affected record
 * @param {number} [params.adminId] - Admin who performed the action
 * @param {string} [params.ip] - Request IP address
 * @param {string|object} [params.details] - Additional details (stringified if object)
 */
async function logAudit({ action, entity, entityId, adminId, ip, details }) {
  try {
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : details || null;

    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId || null,
        adminId: adminId || null,
        ip: ip || null,
        details: detailStr,
      },
    });
  } catch (err) {
    // Never throw — audit logging must not break business logic
    logger.error('AuditLog write failed:', { error: err.message, action, entity, entityId });
  }
}

/**
 * Get audit log entries with pagination and filtering.
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @param {string} [params.entity] - Filter by entity type
 * @param {string} [params.action] - Filter by action type
 * @param {number} [params.entityId] - Filter by entity ID
 * @param {number} [params.adminId] - Filter by admin
 */
async function getAuditLogs({ page = 1, limit = 50, entity, action, entityId, adminId } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (entityId) where.entityId = parseInt(entityId);
  if (adminId) where.adminId = parseInt(adminId);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

module.exports = { logAudit, getAuditLogs };
