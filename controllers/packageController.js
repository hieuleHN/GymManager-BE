import {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackageById,
  deletePackageById,
  getPackagesByDiscipline,
  getRelatedPackages,
} from "../models/packageModel.js";
import Package from "../models/schemas/packageSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import { isStaffViewer } from "../middleware/authMiddleware.js";
import { logAudit } from "../services/auditService.js";
import {
  canTransition,
  isValidStatus,
  LIFECYCLE,
  publicVisibilityFilter,
  statusLabel,
} from "../services/lifecycleService.js";
import {
  buildPriceTable,
  isPriceChanged,
  normalizeDurations,
  recordPriceHistory,
} from "../services/pricingService.js";

const OWNED_STATUSES = ["đang hoạt động", "còn 10 ngày", "đang tạm ngưng"];

// Trạng thái hiện tại của gói (tương thích dữ liệu cũ chưa có lifecycle_status)
export const resolveLifecycle = (pkg) =>
  pkg?.lifecycle_status || (pkg?.is_active ? LIFECYCLE.ACTIVE : LIFECYCLE.PAUSED);

export const addPackage = (req, res) => {
  // Tiếp nhận và bóc tách dữ liệu từ Request Body gửi lên từ Client
  const {
    name,
    price,
    description,
    duration_days,
    is_active,
    service_id,
    unitPrice,
    disciplineId,
    features,
    durations,
    contractA,
    contractB,
    contractTerms,
    locationId,
    ptSessionsPerMonth,
    isFullMonth,
    combo,
    disciplines,
    lifecycle_status,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Vui lòng cung cấp tên gói tập!" });
  }

  // Quy tắc giá: chỉ nhận đơn giá tháng gốc + bảng giảm giá. Giá từng mức do hệ thống tự tính.
  const baseUnitPrice = Number(unitPrice ?? price) || 0;
  const normalizedDurations = normalizeDurations(durations);

  // Gói mới luôn bắt đầu là "nháp" (trừ khi admin chủ động mở bán ngay)
  const initialLifecycle =
    isValidStatus(lifecycle_status) && lifecycle_status === LIFECYCLE.ACTIVE
      ? LIFECYCLE.ACTIVE
      : LIFECYCLE.DRAFT;

  const payload = {
    name,
    price: baseUnitPrice, // giữ tương thích trường cũ: price == đơn giá tháng gốc
    unitPrice: baseUnitPrice,
    description,
    duration_days,
    is_active: initialLifecycle === LIFECYCLE.ACTIVE,
    lifecycle_status: initialLifecycle,
    service_id,
    disciplineId,
    combo: !!combo,
    disciplines: disciplines || [],
    features,
    durations: normalizedDurations,
    contractA,
    contractB,
    contractTerms,
    locationId,
    ptSessionsPerMonth: isFullMonth ? 0 : (Number(ptSessionsPerMonth) || 0),
    isFullMonth: !!isFullMonth,
  };

  createPackage(payload, async (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Lỗi hệ thống khi thêm gói tập: " + err.message });

    // Ghi dòng lịch sử giá đầu tiên của gói
    await recordPriceHistory({
      pkg: result,
      staff: req.user,
      reason: "Khởi tạo gói tập",
    });

    await logAudit(req, {
      action: "PACKAGE_CREATE",
      entityType: "Package",
      entityId: result._id,
      entityName: result.name,
      after: { name: result.name, unitPrice: baseUnitPrice, durations: normalizedDurations, lifecycle_status: initialLifecycle },
      description: `Tạo gói tập "${result.name}" (trạng thái: ${statusLabel(initialLifecycle)})`,
    });

    res.status(201).json({
      message: "Thêm gói tập thành công!",
      packageId: result._id || result.insertId,
      data: { ...result.toObject?.(), lifecycle_status: initialLifecycle },
      price_table: buildPriceTable(result),
    });
  });
};

export const listPackages = async (req, res) => {
  // Chuẩn hóa và ép kiểu dữ liệu phân trang đầu vào từ Query Parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId, disciplineId } = req.query;

  // Staff đăng nhập (token hợp lệ) -> thấy toàn bộ gói + được lọc theo lifecycle/search.
  // Khách vãng lai / hội viên -> chỉ thấy gói "đang bán" (tự ẩn nháp/tạm ngưng/ngừng bán).
  const staffView = isStaffViewer(req);
  const filter = {};

  if (staffView) {
    const { status, search } = req.query;
    if (status && status !== "all") {
      if (isValidStatus(status)) filter.lifecycle_status = status;
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };

      // Tìm theo tên gói HOẶC theo hội viên sở hữu gói
      // (khớp tên / email / SĐT / tài khoản của hội viên)
      const customers = await Customer.find({
        $or: [
          { fullName: regex },
          { email: regex },
          { phone: regex },
          { account: regex },
        ],
      }).select("_id");

      let ownedPackageIds = [];
      if (customers.length > 0) {
        ownedPackageIds = await UserPackage.find({
          customer_id: { $in: customers.map((c) => c._id) },
        }).distinct("package_id");
      }

      if (ownedPackageIds.length > 0) {
        filter.$or = [{ name: regex }, { _id: { $in: ownedPackageIds } }];
      } else {
        filter.name = regex;
      }
    }
  } else {
    Object.assign(filter, publicVisibilityFilter());
  }

  if (locationId) filter.locationId = locationId;
  if (disciplineId) filter.disciplineId = disciplineId;

  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Package.find(filter)
        .populate("service_id", "name")
        .populate("disciplineId", "name")
        .populate("disciplines", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Package.countDocuments(filter),
    ]);

    // Kèm số hội viên đang sở hữu từng gói cho trang quản lý
    let ownerCounts = {};
    if (staffView && data.length > 0) {
      const ids = data.map((p) => p._id);
      const counts = await UserPackage.aggregate([
        { $match: { package_id: { $in: ids }, status: { $in: OWNED_STATUSES } } },
        { $group: { _id: "$package_id", count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => (ownerCounts[c._id] = c.count));
    }

    res.status(200).json({
      data: data.map((pkg) => ({
        ...pkg.toObject(),
        lifecycle_status: resolveLifecycle(pkg),
        ownerCount: ownerCounts[pkg._id] || 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách gói tập: " + err.message });
  }
};

export const getPackagesByDisciplineId = (req, res) => {
  const { disciplineId } = req.params;

  if (!disciplineId) {
    return res.status(400).json({ error: "Vui lòng cung cấp ID bộ môn!" });
  }

  // Staff thấy đủ trạng thái (trang quản lý), khách chỉ thấy gói đang bán
  const staffView = isStaffViewer(req);
  getPackagesByDiscipline(disciplineId, staffView, (err, packages) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Lỗi khi lấy gói tập theo bộ môn: " + err.message });
    res.status(200).json(
      packages.map((pkg) => ({
        ...pkg.toObject(),
        lifecycle_status: resolveLifecycle(pkg),
      })),
    );
  });
};

export const getPackageDetail = async (req, res) => {
  try {
    const packageId = req.params.id;
    const rows = await new Promise((resolve, reject) =>
      getPackageById(packageId, (err, result) => (err ? reject(err) : resolve(result))),
    );
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      return res.status(404).json({ error: "Không tìm thấy gói tập này!" });
    }

    const pkg = Array.isArray(rows) ? rows[0] : rows;

    // Khách chỉ xem được gói "đang bán"; staff xem được tất cả
    // (resolveLifecycle tự suy từ is_active với dữ liệu cũ chưa có lifecycle_status)
    if (!isStaffViewer(req) && resolveLifecycle(pkg) !== LIFECYCLE.ACTIVE) {
      return res.status(404).json({ error: "Gói tập này hiện không bán!" });
    }

    const [ownerCount, totalRegistrations] = await Promise.all([
      UserPackage.countDocuments({ package_id: packageId, status: { $in: OWNED_STATUSES } }),
      UserPackage.countDocuments({ package_id: packageId }),
    ]);

    const packageInfo = {
      ...pkg.toObject(),
      id: pkg._id,
      lifecycle_status: resolveLifecycle(pkg),
      ownerCount,
      totalRegistrations,
      price_table: buildPriceTable(pkg),
      members: [],
    };

    res.status(200).json(packageInfo);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
  }
};

export const updatePackage = async (req, res) => {
  const packageId = req.params.id;
  const {
    name,
    price,
    description,
    duration_days,
    is_active,
    service_id,
    unitPrice,
    disciplineId,
    features,
    durations,
    contractA,
    contractB,
    contractTerms,
    locationId,
    ptSessionsPerMonth,
    isFullMonth,
    combo,
    disciplines,
    lifecycle_status: requestedStatus,
  } = req.body;

  try {
    const existing = await Package.findById(packageId);
    if (!existing) {
      return res.status(404).json({ error: "Không tìm thấy gói tập để cập nhật!" });
    }

    const beforeLifecycle = resolveLifecycle(existing);
    let targetLifecycle = beforeLifecycle;

    // Ưu tiên lifecycle_status tường minh; nếu FE chỉ gửi {is_active} thì map:
    //   true -> đang bán, false -> tạm ngưng
    if (isValidStatus(requestedStatus)) {
      targetLifecycle = requestedStatus;
    } else if (typeof is_active === "boolean" && !("lifecycle_status" in req.body)) {
      targetLifecycle = is_active ? LIFECYCLE.ACTIVE : LIFECYCLE.PAUSED;
    }

    if (targetLifecycle !== beforeLifecycle && !canTransition(beforeLifecycle, targetLifecycle)) {
      return res.status(400).json({
        error: `Không thể chuyển gói từ "${statusLabel(beforeLifecycle)}" sang "${statusLabel(targetLifecycle)}"!`,
      });
    }

    // Quy tắc giá: chỉ nhận đơn giá tháng gốc + bảng giảm giá; giá từng mức hệ thống tự tính
    const baseUnitPrice = Number(unitPrice ?? price ?? existing.unitPrice) || 0;
    const normalizedDurations = normalizeDurations(durations ?? existing.durations);
    const priceChanged = isPriceChanged(existing, baseUnitPrice, normalizedDurations);

    const payload = {
      name,
      price: baseUnitPrice,
      unitPrice: baseUnitPrice,
      description,
      duration_days,
      service_id,
      disciplineId,
      combo: combo !== undefined ? !!combo : existing.combo,
      disciplines: disciplines || existing.disciplines || [],
      features,
      durations: normalizedDurations,
      contractA,
      contractB,
      contractTerms,
      locationId,
      ptSessionsPerMonth:
        isFullMonth !== undefined
          ? isFullMonth
            ? 0
            : Number(ptSessionsPerMonth) || 0
          : existing.ptSessionsPerMonth,
      isFullMonth: isFullMonth !== undefined ? !!isFullMonth : !!existing.isFullMonth,
      lifecycle_status: targetLifecycle,
      is_active: targetLifecycle === LIFECYCLE.ACTIVE, // đồng bộ cờ cũ cho các trang hiện có
      updatedAt: new Date(),
    };

    updatePackageById(packageId, payload, async (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Lỗi hệ thống khi cập nhật gói tập: " + err.message });
      if (!result)
        return res
          .status(404)
          .json({ error: "Không tìm thấy gói tập để cập nhật!" });

      // Đổi giá -> ghi lịch sử giá (áp cho hợp đồng mới; hợp đồng cũ giữ giá đã chốt)
      if (priceChanged) {
        await recordPriceHistory({
          pkg: result,
          oldUnitPrice: Number(existing.unitPrice ?? existing.price),
          oldDurations: existing.durations,
          staff: req.user,
          reason: "Cập nhật bảng giá qua API sửa gói",
        });
        await logAudit(req, {
          action: "PRICE_CHANGE",
          entityType: "Package",
          entityId: result._id,
          entityName: result.name,
          before: { unitPrice: existing.unitPrice, durations: existing.durations },
          after: { unitPrice: result.unitPrice, durations: result.durations },
          description: `Đổi giá gói "${result.name}": ${existing.unitPrice} -> ${result.unitPrice} đ/tháng`,
        });
      }

      if (targetLifecycle !== beforeLifecycle) {
        await logAudit(req, {
          action: "PACKAGE_LIFECYCLE_CHANGE",
          entityType: "Package",
          entityId: result._id,
          entityName: result.name,
          before: { lifecycle_status: beforeLifecycle },
          after: { lifecycle_status: targetLifecycle },
          description: `Đổi trạng thái gói "${result.name}": ${beforeLifecycle} -> ${targetLifecycle}`,
        });
      }

      await logAudit(req, {
        action: "PACKAGE_UPDATE",
        entityType: "Package",
        entityId: result._id,
        entityName: result.name,
        description: `Cập nhật thông tin gói tập "${result.name}"`,
      });

      res.status(200).json({
        message: "Cập nhật gói tập thành công!",
        data: { ...result.toObject(), lifecycle_status: targetLifecycle },
        priceChanged,
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listRelatedPackages = (req, res) => {
  const packageId = req.params.id;
  const limit = parseInt(req.query.limit) || 4;

  getPackageById(packageId, (err, rows) => {
    if (err)
      return res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      return res.status(404).json({ error: "Không tìm thấy gói tập!" });
    }

    const pkg = Array.isArray(rows) ? rows[0] : rows;
    const locationId = pkg.locationId?._id || pkg.locationId;
    const disciplineId = pkg.disciplineId?._id || pkg.disciplineId;

    getRelatedPackages(
      packageId,
      locationId,
      disciplineId,
      limit,
      (err2, related) => {
        if (err2)
          return res
            .status(500)
            .json({ error: "Lỗi hệ thống: " + err2.message });
        res.status(200).json(related);
      },
    );
  });
};

export const deletePackage = async (req, res) => {
  const packageId = req.params.id;

  // Kiểm tra tham số đầu vào trên đường dẫn URL (Path Parameter Validation)
  if (!packageId) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp ID gói tập cần xóa!" });
  }

  try {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy gói tập này hoặc gói đã bị xóa từ trước!" });
    }

    // CHẶN XÓA: gói đã từng có hội viên đăng ký -> chỉ được chuyển "ngừng bán"
    // để giữ nguyên lịch sử hợp đồng / doanh thu.
    const [ownerCount, totalRegistrations] = await Promise.all([
      UserPackage.countDocuments({ package_id: packageId, status: { $in: OWNED_STATUSES } }),
      UserPackage.countDocuments({ package_id: packageId }),
    ]);

    if (totalRegistrations > 0) {
      await logAudit(req, {
        action: "PACKAGE_DELETE_BLOCKED",
        entityType: "Package",
        entityId: packageId,
        entityName: pkg.name,
        before: { ownerCount, totalRegistrations },
        description: `Chặn xóa gói "${pkg.name}" vì đã có ${ownerCount} hội viên đang sở hữu (${totalRegistrations} lượt đăng ký)`,
      });

      return res.status(409).json({
        error:
          ownerCount > 0
            ? `Không thể xóa gói này vì đang có ${ownerCount} hội viên sở hữu! Vui lòng chuyển sang trạng thái NGỪNG BÁN thay vì xóa.`
            : "Không thể xóa gói vì đã tồn tại lịch sử đăng ký/hợp đồng! Vui lòng chuyển sang NGỪNG BÁN.",
        code: "PACKAGE_HAS_SUBSCRIBERS",
        ownerCount,
        totalRegistrations,
        suggestion: {
          method: "PATCH",
          url: `/api/packages/${packageId}/lifecycle-status`,
          body: { status: "ngừng bán" },
        },
      });
    }

    await Package.findByIdAndDelete(packageId);

    await logAudit(req, {
      action: "PACKAGE_DELETE",
      entityType: "Package",
      entityId: packageId,
      entityName: pkg.name,
      before: { name: pkg.name, unitPrice: pkg.unitPrice },
      description: `Xóa gói tập nháp "${pkg.name}" (chưa có hội viên)`,
    });

    res.status(200).json({
      message: "Xóa gói tập thành công!",
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi xóa gói tập: " + err.message });
  }
};
