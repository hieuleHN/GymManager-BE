import Package from "../models/schemas/packageSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import Notification from "../models/schemas/notificationSchema.js";
import { logAudit } from "../services/auditService.js";
import { computeTierPrice } from "../services/pricingService.js";
import { addMonths, allocatePtSessions } from "../services/ptSessionService.js";

const ACTIVE_STATUSES = ["đang hoạt động", "còn 10 ngày", "đang tạm ngưng"];

const createMemberNotification = async ({ customerId, title, message, type, userPackageId }) => {
  try {
    await Notification.create({
      recipientId: customerId,
      recipientRole: "member",
      title,
      message,
      type,
      relatedUserPackageId: userPackageId || undefined,
    });
  } catch (err) {
    console.error("[UserPackageAdmin] Lỗi tạo thông báo:", err.message);
  }
};

// ============================================================
// GIA HẠN HỘ: khách hết hạn -> admin tạo phiếu gia hạn -> duyệt là xong
// POST /api/user-packages/admin-renew
// body: { customerId, package_id?, registrationId?, duration_months, locationId?, note? }
// ============================================================
export const adminRenewPackage = async (req, res) => {
  try {
    const { customerId, package_id, registrationId, duration_months, locationId, note } =
      req.body;

    if (!customerId) return res.status(400).json({ error: "Thiếu mã khách hàng!" });
    if (!duration_months || Number(duration_months) <= 0)
      return res.status(400).json({ error: "Vui lòng chọn số tháng gia hạn!" });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: "Không tìm thấy khách hàng!" });

    // Xác định hợp đồng gốc: ưu tiên registrationId, không thì lấy hợp đồng mới nhất của khách
    let original = null;
    if (registrationId) {
      original = await UserPackage.findOne({ _id: registrationId, customer_id: customerId });
      if (!original)
        return res.status(404).json({ error: "Không tìm thấy hợp đồng gốc của khách!" });
    }

    const pkgId = package_id || original?.package_id;
    if (!pkgId)
      return res.status(400).json({ error: "Vui lòng chọn gói tập cần gia hạn!" });

    const pkg = await Package.findById(pkgId);
    if (!pkg) return res.status(404).json({ error: "Gói tập không tồn tại!" });
    if (pkg.lifecycle_status && pkg.lifecycle_status !== "đang bán") {
      return res
        .status(400)
        .json({ error: "Gói này hiện KHÔNG bán. Vui lòng chọn gói khác hoặc mở bán lại gói." });
    }

    // Giá theo bảng giá hiện hành - cấm gõ tay
    let pricing;
    try {
      pricing = computeTierPrice(pkg, duration_months);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Ngày bắt đầu dự kiến: nếu hợp đồng gốc còn hạn thì nối tiếp sau ngày hết hạn
    const now = new Date();
    let proposedStart = now;
    if (original?.end_date && new Date(original.end_date) > now) {
      proposedStart = new Date(original.end_date);
    }

    const ticket = await UserPackage.create({
      customer_id: customerId,
      package_id: pkg._id,
      locationId: locationId || original?.locationId || pkg.locationId || null,
      duration_months: pricing.months,
      ptSessionsPerMonth: pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth || 0),
      isFullMonth: !!pkg.isFullMonth,
      monthlySessions: [],
      total_price: pricing.total_price,
      unit_price_applied: pricing.unit_price,
      price_snapshot: {
        unit_price: pricing.unit_price,
        months: pricing.months,
        discount_percent: pricing.discount_percent,
      },
      signature: "",
      start_date: proposedStart,
      end_date: addMonths(proposedStart, pricing.months),
      proposed_start_date: proposedStart,
      status: "chờ xác nhận",
      payment_status: "chờ thanh toán",
      is_renewal_ticket: true,
      original_registration_id: original?._id || null,
      renewal_note: note || "",
    });

    await logAudit(req, {
      action: "ADMIN_RENEW_CREATE",
      entityType: "UserPackage",
      entityId: ticket._id,
      entityName: `${customer.fullName} - ${pkg.name}`,
      after: {
        customerId,
        packageName: pkg.name,
        months: pricing.months,
        total_price: pricing.total_price,
        proposedStart,
      },
      description: `Tạo phiếu gia hạn hộ "${pkg.name}" ${pricing.months} tháng cho ${customer.fullName}`,
    });

    await createMemberNotification({
      customerId,
      title: "Phiếu gia hạn gói tập đã được tạo",
      message: `Nhân viên đã tạo phiếu gia hạn gói "${pkg.name}" (${pricing.months} tháng). Phiếu đang chờ duyệt.`,
      type: "package_renewed",
      userPackageId: ticket._id,
    });

    res.status(201).json({
      message: "Đã tạo phiếu gia hạn! Vui lòng duyệt để hoàn tất.",
      data: ticket,
      pricing,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// NÂNG CẤP HỘ (admin/staff): chỉ cho lên gói giá >= để không phải hoàn tiền
// POST /api/user-packages/admin-upgrade
// body: { customerId, currentRegistrationId, newPackageId }
// - Hủy gói cũ, tạo gói mới giữ nguyên ngày hết hạn còn lại
// - Buổi PT gói mới = tổng buổi mới (theo thời gian còn lại) trừ đi số buổi đã dùng ở gói cũ
// ============================================================
export const adminUpgradePackage = async (req, res) => {
  try {
    const { customerId, currentRegistrationId, newPackageId } = req.body;
    if (!customerId || !currentRegistrationId || !newPackageId) {
      return res.status(400).json({ error: "Thiếu mã khách / gói hiện tại / gói mới!" });
    }
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: "Không tìm thấy khách hàng!" });

    const currentReg = await UserPackage.findOne({ _id: currentRegistrationId, customer_id: customerId }).populate("package_id");
    if (!currentReg) return res.status(404).json({ error: "Không tìm thấy gói hiện tại của khách!" });
    if (currentReg.status === "hết hạn" || currentReg.status === "đã hủy" || (currentReg.end_date && new Date(currentReg.end_date) < new Date())) {
      return res.status(400).json({ error: "Gói đã hết hạn/hủy - vui lòng Gia hạn trước khi Nâng cấp!" });
    }

    const newPkg = await Package.findById(newPackageId);
    if (!newPkg) return res.status(404).json({ error: "Gói tập mới không tồn tại!" });
    if (newPkg.lifecycle_status && newPkg.lifecycle_status !== "đang bán") {
      return res.status(400).json({ error: "Gói mới hiện không bán để nâng cấp!" });
    }

    const currentUnit = Number(currentReg.package_id?.unitPrice) || (currentReg.total_price ? Math.round(currentReg.total_price / (currentReg.duration_months || 1)) : 0);
    const newUnit = Number(newPkg.unitPrice || 0);
    if (newUnit < currentUnit) {
      return res.status(400).json({ error: `Gói mới (${newUnit.toLocaleString("vi-VN")}đ) phải có giá cao hơn hoặc bằng gói hiện tại (${currentUnit.toLocaleString("vi-VN")}đ). Không cho hạ cấp để tránh phải hoàn tiền.` });
    }

    const now = new Date();
    const startDate = new Date(currentReg.start_date);
    const endDate = new Date(currentReg.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    const remainingDays = Math.max(0, Math.ceil((endDate - now) / 86400000));
    if (!remainingDays) return res.status(400).json({ error: "Gói đã hết hạn, không thể nâng cấp!" });

    const remainingValue = Math.floor((currentReg.total_price / totalDays) * remainingDays);
    const newPackageCost = Math.floor((Number(newPkg.unitPrice || newPkg.price || 0) / 30) * remainingDays);
    const amountToPay = Math.max(0, newPackageCost - remainingValue);
    if (remainingValue > newPackageCost) {
      return res.status(400).json({ error: `Nâng cấp sang gói này sẽ phải hoàn ${(remainingValue - newPackageCost).toLocaleString("vi-VN")}đ. Vui lòng chọn gói giá cao hơn để không thất thoát ngân sách.` });
    }

    // Buổi PT: tổng mới (theo thời gian còn lại) trừ đã dùng cũ, trừ dần từ tháng sớm nhất
    const oldUsedPt = (currentReg.monthlySessions || []).reduce((s, m) => s + (Number(m.used) || 0), 0);
    const remainingMonths = Math.max(1, Math.ceil(remainingDays / 30));
    let monthlySessions = allocatePtSessions(now, remainingMonths, newPkg);
    if (!newPkg.isFullMonth && oldUsedPt > 0 && monthlySessions.length) {
      let toDeduct = oldUsedPt;
      for (const m of monthlySessions) {
        if (toDeduct <= 0) break;
        const take = Math.min(toDeduct, Number(m.total) || 0);
        m.used = take;
        toDeduct -= take;
      }
    }
    const newTotalPt = newPkg.isFullMonth ? -1 : monthlySessions.reduce((s, m) => s + (Number(m.total) || 0), 0);
    const newRemainingPt = newPkg.isFullMonth ? -1 : monthlySessions.reduce((s, m) => s + Math.max(0, (Number(m.total) || 0) - (Number(m.used) || 0)), 0);

    currentReg.status = "đã hủy";
    currentReg.payment_status = "đã hủy";
    await currentReg.save();

    const created = await UserPackage.create({
      customer_id: customerId,
      package_id: newPkg._id,
      locationId: currentReg.locationId || newPkg.locationId || null,
      duration_months: remainingMonths,
      ptSessionsPerMonth: newPkg.isFullMonth ? 0 : (newPkg.ptSessionsPerMonth || 0),
      isFullMonth: !!newPkg.isFullMonth,
      monthlySessions,
      total_price: newPackageCost,
      unit_price_applied: newUnit,
      price_snapshot: { unit_price: newUnit, months: remainingMonths, discount_percent: 0 },
      original_registration_id: currentReg._id,
      signature: "",
      start_date: now,
      end_date: endDate,
      status: "đang hoạt động",
      payment_status: "đã thanh toán",
      payment_method: "",
    });

    await logAudit(req, {
      action: "ADMIN_UPGRADE",
      entityType: "UserPackage",
      entityId: created._id,
      entityName: `${customer.fullName} - ${currentReg.package_id?.name} -> ${newPkg.name}`,
      after: { oldReg: currentReg._id, newPackage: newPkg.name, amountToPay, remainingDays, oldUsedPt, newRemainingPt },
      description: `Nâng cấp gói "${currentReg.package_id?.name}" lên "${newPkg.name}" cho ${customer.fullName} (bù thêm ${amountToPay.toLocaleString("vi-VN")}đ)`,
    });

    await createMemberNotification({
      customerId,
      title: "Gói tập đã được nâng cấp",
      message: `Gói "${currentReg.package_id?.name}" của bạn đã được nâng cấp lên "${newPkg.name}". Thời hạn giữ nguyên đến ${endDate.toLocaleDateString("vi-VN")}${newPkg.isFullMonth ? "" : `, còn ${newRemainingPt} buổi HLV (đã trừ ${oldUsedPt} buổi đã dùng ở gói cũ)`}.`,
      type: "package_renewed",
      userPackageId: created._id,
    });

    res.json({
      message: `Đã nâng cấp lên "${newPkg.name}" thành công${amountToPay ? ` (cần thu thêm ${amountToPay.toLocaleString("vi-VN")}đ)` : ""}!`,
      data: created,
      pricing: { remainingDays, remainingValue, newPackageCost, amountToPay },
      pt: { oldUsed: oldUsedPt, newTotal: newTotalPt, newRemaining: newRemainingPt, remainingMonths, isUnlimited: !!newPkg.isFullMonth },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Danh sách phiếu gia hạn chờ duyệt
// GET /api/user-packages/renewal-tickets?page=&limit=&status=&search=
export const listRenewalTickets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const { status, search } = req.query;

    const filter = { is_renewal_ticket: true };
    if (status && status !== "all") filter.status = status;

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      const customers = await Customer.find({
        $or: [{ fullName: regex }, { phone: regex }, { account: regex }],
      }).select("_id");
      filter.customer_id = { $in: customers.map((c) => c._id) };
    }

    const [total, data] = await Promise.all([
      UserPackage.countDocuments(filter),
      UserPackage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer_id", "fullName email phone account")
        .populate("package_id", "name unitPrice ptSessionsPerMonth isFullMonth")
        .populate("original_registration_id", "end_date")
        .populate("confirmed_by", "fullName name"),
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

// ============================================================
// DANH SÁCH KHÁCH SẮP HẾT HẠN / ĐÃ HẾT HẠN (để gửi nhắc gia hạn hàng loạt)
// GET /api/user-packages/expiring?within_days=10&page=1&limit=15&include_expired=true&locationId=
// ============================================================
export const listExpiring = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const withinDays = Math.max(1, parseInt(req.query.within_days) || 10);
    const includeExpired = String(req.query.include_expired) === "true";
    const { locationId } = req.query;

    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + withinDays);

    const endFilter = includeExpired
      ? { $lte: until }
      : { $gte: now, $lte: until };

    const filter = {
      payment_status: "đã thanh toán",
      status: { $in: ACTIVE_STATUSES },
      end_date: endFilter,
    };
    if (locationId) filter.locationId = locationId;

    const [total, data] = await Promise.all([
      UserPackage.countDocuments(filter),
      UserPackage.find(filter)
        .sort({ end_date: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer_id", "fullName email phone account avatar gender")
        .populate("package_id", "name unitPrice"),
    ]);

    res.json({
      within_days: withinDays,
      include_expired: includeExpired,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: data.map((reg) => ({
        _id: reg._id,
        customer: reg.customer_id,
        packageName: reg.package_id?.name,
        start_date: reg.start_date,
        end_date: reg.end_date,
        remaining_days: Math.ceil((new Date(reg.end_date) - now) / 86400000),
        last_renewal_reminder_at: reg.last_renewal_reminder_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GỬI NHẮC GIA HẠN HÀNG LOẠT: chọn danh sách khách sắp hết hạn -> bấm gửi notification
// POST /api/user-packages/renewal-reminders/send
// body: { registrationIds?: [...], within_days?: 10 }
// Chống spam: mỗi hợp đồng chỉ nhận nhắc 1 lần / 24 giờ.
// ============================================================
export const sendRenewalReminders = async (req, res) => {
  try {
    const { registrationIds } = req.body;
    const withinDays = Math.max(1, parseInt(req.body?.within_days) || 10);
    const DAY_MS = 86400000;

    let targets = [];
    if (Array.isArray(registrationIds) && registrationIds.length > 0) {
      // Admin tự tick chọn -> gửi đúng những người đó, không lọc thêm điều kiện
      // (tránh âm thầm bỏ sót hợp đồng cũ thiếu trường payment_status)
      targets = await UserPackage.find({ _id: { $in: registrationIds } });
    } else {
      // Không chọn cụ thể -> lấy toàn bộ khách trong danh sách sắp hết hạn/hết hạn
      // theo đúng bộ lọc mà tab "Khách sắp hết hạn" đang hiển thị.
      // Chặn sàn 90 ngày quá khứ để không nhắc phải hợp đồng chết từ lâu.
      const now = new Date();
      const until = new Date(now);
      until.setDate(until.getDate() + withinDays);
      const floor = new Date(now.getTime() - 90 * DAY_MS);
      targets = await UserPackage.find({
        payment_status: "đã thanh toán",
        status: { $in: ACTIVE_STATUSES },
        end_date: { $gte: floor, $lte: until },
      });
    }

    const now = Date.now();
    let sent = 0;
    const skipped = [];

    for (const reg of targets) {
      if (
        reg.last_renewal_reminder_at &&
        now - new Date(reg.last_renewal_reminder_at).getTime() < DAY_MS
      ) {
        skipped.push(String(reg._id));
        continue;
      }

      const daysLeft = Math.ceil((new Date(reg.end_date) - now) / DAY_MS);
      const endStr = new Date(reg.end_date).toLocaleDateString("vi-VN");
      const message =
        daysLeft >= 0
          ? `Gói tập của bạn sẽ hết hạn sau ${daysLeft} ngày (${endStr}). Gia hạn ngay để không gián đoạn buổi tập nhé!`
          : `Gói tập của bạn đã hết hạn từ ngày ${endStr}. Gia hạn ngay hôm nay để tiếp tục tập luyện nhé!`;

      await createMemberNotification({
        customerId: reg.customer_id,
        title: "Nhắc gia hạn gói tập",
        message,
        type: "renewal_reminder",
        userPackageId: reg._id,
      });

      reg.last_renewal_reminder_at = new Date();
      await reg.save();
      sent += 1;
    }

    await logAudit(req, {
      action: "RENEWAL_REMIND_BULK",
      entityType: "UserPackage",
      entityId: null,
      entityName: `${sent} hội viên`,
      after: { requested: targets.length, sent, skipped: skipped.length, withinDays },
      description: `Gửi ${sent} thông báo nhắc gia hạn hàng loạt`,
    });

    res.json({
      message: `Đã gửi ${sent} nhắc gia hạn${skipped.length ? `, bỏ qua ${skipped.length} hợp đồng đã được nhắc trong 24h` : ""}.`,
      sent,
      skippedCount: skipped.length,
      skippedRegistrationIds: skipped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// NHẮC THANH TOÁN ĐƠN CHỜ (admin bấm nhắc thủ công cho 1 đơn)
// POST /api/user-packages/:id/payment-reminder
// ============================================================
export const sendPaymentReminder = async (req, res) => {
  try {
    const reg = await UserPackage.findById(req.params.id).populate(
      "package_id",
      "name unitPrice"
    );
    if (!reg) return res.status(404).json({ error: "Không tìm thấy đơn đăng ký!" });

    if (reg.payment_status !== "chờ thanh toán") {
      return res
        .status(400)
        .json({ error: `Đơn này không ở trạng thái chờ thanh toán (hiện tại: ${reg.payment_status})` });
    }

    const hoursLeft = Math.max(
      0,
      Math.ceil(72 - (Date.now() - new Date(reg.createdAt).getTime()) / 3600000)
    );

    await createMemberNotification({
      customerId: reg.customer_id,
      title: "Nhắc thanh toán gói tập",
      message: `Đơn đăng ký gói "${reg.package_id?.name}" (${Number(reg.total_price).toLocaleString("vi-VN")} đ) đang chờ thanh toán. Đơn sẽ tự hủy sau khoảng ${hoursLeft} giờ nếu chưa thanh toán.`,
      type: "payment_reminder",
      userPackageId: reg._id,
    });

    reg.payment_reminder_sent_at = new Date();
    await reg.save();

    await logAudit(req, {
      action: "PAYMENT_REMIND",
      entityType: "UserPackage",
      entityId: reg._id,
      entityName: reg.package_id?.name || "",
      description: `Gửi nhắc thanh toán cho đơn gói "${reg.package_id?.name}"`,
    });

    res.json({ message: "Đã gửi thông báo nhắc thanh toán cho khách!", hoursLeftToCancel: hoursLeft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
