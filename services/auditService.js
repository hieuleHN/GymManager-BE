import AuditLog from '../models/schemas/auditLogSchema.js';

/**
 * Ghi audit log "ai / làm gì / khi nào" cho mọi thao tác quản trị.
 * Fire-and-forget: lỗi ghi log không được làm hỏng nghiệp vụ chính.
 *
 * logAudit(req, {
 *   action: 'PACKAGE_LIFECYCLE_CHANGE',
 *   entityType: 'Package',
 *   entityId: pkg._id,
 *   entityName: pkg.name,
 *   before: {...}, after: {...},
 *   description: 'Chuyển trạng thái nháp -> đang bán'
 * })
 */
export const logAudit = async (req, payload) => {
  try {
    const user = req?.user || {};
    await AuditLog.create({
      actor_id: user.id || null,
      actor_name: user.fullName || user.username || 'system',
      actor_role: user.role || '',
      action: payload.action,
      entity_type: payload.entityType || '',
      entity_id: payload.entityId || null,
      entity_name: payload.entityName || '',
      before: payload.before ?? null,
      after: payload.after ?? null,
      description: payload.description || '',
      ip:
        req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req?.socket?.remoteAddress ||
        '',
    });
  } catch (err) {
    console.error('[AuditLog] Lỗi ghi log:', err.message);
  }
};
