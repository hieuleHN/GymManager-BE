import AuditLog from "../models/schemas/auditLogSchema.js";

/**
 * Tra cứu audit log - ai/làm gì/khi nào (chỉ admin)
 * GET /api/audit-logs?page=1&limit=20&entity_type=&action=&actor_id=&from=&to=&q=
 */
export const listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const { entity_type, action, actor_id, entity_id, from, to } = req.query;

    const filter = {};
    if (entity_type) filter.entity_type = entity_type;
    if (action) filter.action = action;
    if (actor_id) filter.actor_id = actor_id;
    if (entity_id) filter.entity_id = entity_id;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Tìm nhanh theo mô tả / tên đối tượng / tên người thực hiện
    if (req.query.q && req.query.q.trim()) {
      const escaped = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ description: regex }, { entity_name: regex }, { actor_name: regex }];
    }

    const [total, data] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
