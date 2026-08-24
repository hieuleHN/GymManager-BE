import Package from "../models/schemas/packageSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import PackagePriceHistory from "../models/schemas/packagePriceHistorySchema.js";
import {
  logAudit,
} from "../services/auditService.js";
import {
  buildPriceTable,
  computeTierPrice,
} from "../services/pricingService.js";
import {
  canTransition,
  isValidStatus,
  LIFECYCLE,
  statusLabel,
} from "../services/lifecycleService.js";
import { generatePackageContractPdf } from "../utils/packageContractPdf.js";

// ============================================================
// 1. VÒNG ĐỜI GÓI: nháp -> đang bán -> tạm ngưng -> ngừng bán
// PATCH /api/packages/:id/lifecycle-status   body: { status, reason? }
// Gói không còn "đang bán" sẽ tự ẩn khỏi trang khách.
// ============================================================
export const changeLifecycleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!isValidStatus(status)) {
      return res.status(400).json({
        error: "Trạng thái không hợp lệ! Chỉ nhận: nháp | đang bán | tạm ngưng | ngừng bán",
      });
    }

    const pkg = await Package.findById(id);
    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });

    const from = pkg.lifecycle_status || (pkg.is_active ? LIFECYCLE.ACTIVE : LIFECYCLE.PAUSED);
    if (from === status) {
      return res.status(400).json({ error: `Gói đã ở trạng thái "${statusLabel(status)}" rồi!` });
    }
    if (!canTransition(from, status)) {
      return res.status(400).json({
        error: `Không thể chuyển từ "${statusLabel(from)}" sang "${statusLabel(status)}". Chỉ cho phép: ${(
          canTransitionList(from) || []
        ).join(", ")}`,
      });
    }

    // Chặn mở bán lại nếu... không có gì chặn - nhưng luôn ghi audit bên dưới
    pkg.lifecycle_status = status;
    pkg.is_active = status === LIFECYCLE.ACTIVE;
    pkg.status_changed_at = new Date();
    pkg.status_changed_by = req.user.id;
    pkg.updatedAt = new Date();
    await pkg.save();

    await logAudit(req, {
      action: "PACKAGE_LIFECYCLE_CHANGE",
      entityType: "Package",
      entityId: pkg._id,
      entityName: pkg.name,
      before: { lifecycle_status: from },
      after: { lifecycle_status: status, reason: reason || "" },
      description: `Đổi trạng thái gói "${pkg.name}": ${from} -> ${status}${reason ? ` (${reason})` : ""}`,
    });

    res.json({
      message: `Đã chuyển gói sang trạng thái "${statusLabel(status)}"`,
      data: { _id: pkg._id, name: pkg.name, lifecycle_status: status, is_active: pkg.is_active },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function canTransitionList(from) {
  const map = {
    [LIFECYCLE.DRAFT]: ["đang bán", "ngừng bán"],
    [LIFECYCLE.ACTIVE]: ["tạm ngưng", "ngừng bán"],
    [LIFECYCLE.PAUSED]: ["đang bán", "ngừng bán"],
    [LIFECYCLE.DISCONTINUED]: ["đang bán"],
  };
  return map[from];
}

// ============================================================
// 2. Số người đang sở hữu gói + danh sách ai đang dùng (phân trang + tìm kiếm)
// GET /api/packages/:id/subscribers?page=1&limit=15&search=&status=
// ============================================================
export const listSubscribers = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const { search, status } = req.query;

    const pkg = await Package.findById(id).select("name unitPrice");
    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });

    const filter = { package_id: id };

    // Mặc định: hội viên đang sở hữu (đang hoạt động/còn 10 ngày/tạm ngưng) và đã thanh toán
    const OWNED_STATUSES = ["đang hoạt động", "còn 10 ngày", "đang tạm ngưng"];
    if (status && status !== "all") {
      filter.status = status;
      if (status === "owned") filter.status = { $in: OWNED_STATUSES };
    } else {
      filter.status = { $in: OWNED_STATUSES };
    }
    if (req.query.payment_status) {
      filter.payment_status = req.query.payment_status;
    }

    // Tìm kiếm theo tên / email / SĐT / tài khoản
    let customerIds = null;
    if (search && search.trim()) {
      const Customer = (await import("../models/schemas/customerSchema.js")).default;
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const customers = await Customer.find({
        $or: [{ fullName: regex }, { email: regex }, { phone: regex }, { account: regex }],
      }).select("_id");
      customerIds = customers.map((c) => c._id);
      filter.customer_id = { $in: customerIds };
    }

    const [total, activeOwnerCount, data] = await Promise.all([
      UserPackage.countDocuments(filter),
      UserPackage.countDocuments({ package_id: id, status: { $in: OWNED_STATUSES } }),
      UserPackage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer_id", "fullName email phone account avatar gender")
        .populate("locationId", "title"),
    ]);

    res.json({
      package: { _id: pkg._id, name: pkg.name, unitPrice: pkg.unitPrice },
      ownerCount: activeOwnerCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: data.map((reg) => ({
        _id: reg._id,
        customer: reg.customer_id,
        start_date: reg.start_date,
        end_date: reg.end_date,
        remaining_days: reg.end_date
          ? Math.max(0, Math.ceil((new Date(reg.end_date) - Date.now()) / 86400000))
          : null,
        duration_months: reg.duration_months,
        total_price: reg.total_price,
        status: reg.status,
        payment_status: reg.payment_status,
        locationId: reg.locationId,
        createdAt: reg.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Số người đang sở hữu gói (badge nhanh trên danh sách)
// GET /api/packages/:id/owner-count
export const getOwnerCount = async (req, res) => {
  try {
    const count = await UserPackage.countDocuments({
      package_id: req.params.id,
      status: { $in: ["đang hoạt động", "còn 10 ngày", "đang tạm ngưng"] },
    });
    res.json({ package_id: req.params.id, ownerCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// 3. LỊCH SỬ GIÁ + ÁP GIÁ THEO THỜI ĐIỂM
// GET /api/packages/:id/price-history?page=1&limit=20
// Hợp đồng cũ giữ giá cũ: total_price đã snapshot trong UserPackage.
// ============================================================
export const getPriceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    const filter = { package_id: id };
    const [total, data] = await Promise.all([
      PackagePriceHistory.countDocuments(filter),
      PackagePriceHistory.find(filter)
        .sort({ changed_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      data: data.map((h) => ({
        _id: h._id,
        unit_price_old: h.unit_price_old,
        unit_price: h.unit_price,
        durations_old: h.durations_old,
        durations: h.durations,
        reason: h.reason,
        changed_by: h.changed_by,
        changed_by_name: h.changed_by_name,
        changed_at: h.changed_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bảng giá tự tính của gói (mọi mức tháng)
// GET /api/packages/:id/price-table
export const getPriceTable = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });

    res.json({
      package_id: pkg._id,
      name: pkg.name,
      ...buildPriceTable(pkg),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xem trước giá cho N tháng (FE gọi khi chọn thời hạn, cấm tự nhân giá)
// POST /api/packages/preview-price   body: { package_id, months }
// POST /api/packages/:id/preview-price?months=6
export const previewPrice = async (req, res) => {
  try {
    let packageId = req.params.id || req.body?.package_id;
    let months = Number(req.body?.months ?? req.query.months);
    if (!packageId) return res.status(400).json({ error: "Thiếu package_id!" });
    if (!months || months <= 0)
      return res.status(400).json({ error: "Thiếu hoặc sai số tháng (months)!" });

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });

    const pricing = computeTierPrice(pkg, months);
    res.json({ package_id: pkg._id, package_name: pkg.name, ...pricing });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ============================================================
// 4. XUẤT HỢP ĐỒNG + BẢNG GIÁ THEO GÓI (để in ra ký cho khách)
// GET /api/packages/:id/contract-pdf  -> application/pdf
// ============================================================
export const exportContractPdf = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id)
      .populate("disciplineId", "name")
      .populate("disciplines", "name")
      .populate("locationId", "title address signature");

    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });

    // Khách chưa đăng nhập vẫn cần xem để ký -> cho phép qua optionalAuth,
    // chỉ chặn khi gói chưa công bố và người xem không phải staff.
    if (
      !req.user?.isStaff &&
      (pkg.lifecycle_status || (pkg.is_active ? LIFECYCLE.ACTIVE : LIFECYCLE.PAUSED)) ===
        LIFECYCLE.DRAFT
    ) {
      return res.status(403).json({ error: "Gói đang ở trạng thái nháp, chưa thể xuất hợp đồng!" });
    }

    const pdfBuffer = generatePackageContractPdf(pkg);

    await logAudit(req, {
      action: "PACKAGE_CONTRACT_EXPORT",
      entityType: "Package",
      entityId: pkg._id,
      entityName: pkg.name,
      description: `Xuất hợp đồng + bảng giá gói "${pkg.name}"`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="hop-dong-bang-gia-${pkg.name || pkg._id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
