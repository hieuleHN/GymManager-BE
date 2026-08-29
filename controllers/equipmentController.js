import excelJS from "exceljs";
import mongoose from "mongoose";
import Equipment from "../models/schemas/equipmentSchema.js";

export const getAllEquipments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 15);
    const { locationId } = req.query;
    const filter = locationId ? { location_id: locationId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Equipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Equipment.countDocuments(filter),
    ]);
    res
      .status(200)
      .json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const getEquipmentsByLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    if (!locationId)
      return res.status(400).json({ message: "Thiếu mã cơ sở (locationId)!" });
    const equipments = await Equipment.find({ location_id: locationId });
    res.status(200).json(equipments);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findById(id).populate(
      "reports.assigned_to",
      "full_name email phone",
    );
    if (!equipment)
      return res.status(404).json({ message: "Không tìm thấy thiết bị này!" });
    res.status(200).json(equipment);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const createEquipment = async (req, res) => {
  try {
    const newEquipment = new Equipment(req.body);
    const savedEquipment = await newEquipment.save();
    res
      .status(201)
      .json({ message: "Thêm thiết bị thành công!", data: savedEquipment });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ!", errors: messages });
    }
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedEquipment = await Equipment.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedEquipment)
      return res
        .status(404)
        .json({ message: "Không tìm thấy thiết bị để cập nhật!" });
    res.status(200).json({
      message: "Cập nhật thiết bị thành công!",
      data: updatedEquipment,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ!", errors: messages });
    }
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEquipment = await Equipment.findByIdAndDelete(id);
    if (!deletedEquipment)
      return res
        .status(404)
        .json({ message: "Không tìm thấy thiết bị để xóa!" });
    res.status(200).json({ message: "Xóa thiết bị thành công!" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const reportEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusType, reason, affectedQuantity, assigned_to } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ message: "Vui lòng nhập lý do báo cáo!" });
    }

    const eq = await Equipment.findById(id);
    if (!eq)
      return res.status(404).json({ message: "Không tìm thấy thiết bị!" });

    const qty = Math.max(
      1,
      Math.min(parseInt(affectedQuantity) || 1, eq.quantity),
    );

    const equipment = await Equipment.findByIdAndUpdate(
      id,
      {
        $set: { status: statusType || "hỏng hóc" },
        $push: {
          reports: {
            statusType: statusType || "hỏng hóc",
            affectedQuantity: qty,
            reason: reason.trim(),
            reportedAt: new Date(),
            assigned_to: assigned_to || null,
            status: "pending",
          },
        },
      },
      { new: true, runValidators: true },
    );

    res
      .status(200)
      .json({ message: "Đã tạo phiếu sự cố/bảo trì!", data: equipment });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ!", errors: messages });
    }
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const resolveReport = async (req, res) => {
  try {
    const { id, reportId } = req.params;
    const { cost, result, downtime_days, assigned_to } = req.body;

    const eq = await Equipment.findOne({ _id: id, "reports._id": reportId });
    if (!eq)
      return res
        .status(404)
        .json({ message: "Không tìm thấy thiết bị hoặc phiếu báo cáo!" });

    const newCost = Math.max(0, Number(cost) || 0);
    const newDowntime = Math.max(0, Number(downtime_days) || 0);

    const equipment = await Equipment.findOneAndUpdate(
      { _id: id, "reports._id": reportId },
      {
        $set: {
          "reports.$.status": "resolved",
          "reports.$.cost": newCost,
          "reports.$.result": result ? result.trim() : "",
          "reports.$.assigned_to": assigned_to || null,
          "reports.$.resolvedAt": new Date(),
          "reports.$.downtime_days": newDowntime,
          status: "hoạt động",
          last_maintenance_date: new Date(),
        },
        $inc: {
          total_maintenance_cost: newCost,
          total_downtime_days: newDowntime,
        },
      },
      { new: true, runValidators: true },
    );

    res
      .status(200)
      .json({ message: "Đã hoàn tất xử lý phiếu!", data: equipment });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ!", errors: messages });
    }
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const exportEquipmentsToExcel = async (req, res) => {
  try {
    const { locationId } = req.query;
    let filter = {};
    if (locationId) {
      if (!mongoose.Types.ObjectId.isValid(locationId))
        return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
      filter.location_id = locationId;
    }

    const equipments = await Equipment.find(filter).populate(
      "location_id",
      "name",
    );
    if (!equipments || equipments.length === 0)
      return res.status(404).json({ message: "Không có dữ liệu thiết bị!" });

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bao_Cao_Thiet_Bi");

    worksheet.columns = [
      { header: "STT", key: "stt", width: 5 },
      { header: "Tên thiết bị", key: "name", width: 25 },
      { header: "Trạng thái", key: "status", width: 15 },
      { header: "Thời gian SD (Ngày)", key: "usage_days", width: 18 },
      { header: "Nguyên giá (VNĐ)", key: "unitPrice", width: 15 },
      {
        header: "Tổng phí sửa (VNĐ)",
        key: "total_maintenance_cost",
        width: 18,
      },
      { header: "TCO - Tổng chi phí sở hữu", key: "tco", width: 25 },
      { header: "Downtime (Ngày)", key: "total_downtime_days", width: 15 },
      { header: "Đề xuất thay mới", key: "replace_warning", width: 20 },
      { header: "Link Hóa đơn", key: "invoice_url", width: 30 },
      { header: "Link Bảo hành", key: "warranty_card_url", width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    const now = new Date();

    equipments.forEach((eq, index) => {
      const purchaseDate = new Date(eq.purchase_date || eq.createdAt);
      const usageDays = Math.max(
        1,
        Math.floor(
          (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      const tco = (eq.unitPrice || 0) + (eq.total_maintenance_cost || 0);
      const needsReplacement =
        eq.total_maintenance_cost > eq.unitPrice * 0.5 ||
        eq.total_downtime_days > 30;

      worksheet.addRow({
        stt: index + 1,
        name: eq.name,
        status: eq.status.toUpperCase(),
        usage_days: usageDays,
        unitPrice: eq.unitPrice,
        total_maintenance_cost: eq.total_maintenance_cost,
        tco: tco,
        total_downtime_days: eq.total_downtime_days || 0,
        replace_warning: needsReplacement ? "CẦN THAY MỚI" : "Bình thường",
        invoice_url: eq.invoice_url || "Chưa cập nhật",
        warranty_card_url: eq.warranty_card_url || "Chưa cập nhật",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Bao_Cao_Thiet_Bi.xlsx",
    );
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!", error: error.message });
  }
};

export const getEquipmentAlerts = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allEquipments = await Equipment.find({});
    const alerts = {
      maintenance_due: [],
      warranty_expiring: [],
      overdue_tickets: [],
      broken_long_time: [],
    };

    allEquipments.forEach((eq) => {
      try {
        if (!eq) return;

        // 1. Đến hạn bảo trì
        if (eq.status === "bảo trì") {
          alerts.maintenance_due.push(eq);
        }

        // 2. Hết hạn bảo hành trong vòng 30 ngày tới
        const wPeriod = Number(eq.warranty_period) || 0;
        let isWarrantyExpiring = false;

        if (wPeriod > 0 && (eq.purchase_date || eq.createdAt)) {
          const purchaseDate = new Date(eq.purchase_date || eq.createdAt);
          if (!isNaN(purchaseDate.getTime())) {
            const warrantyEndDate = new Date(purchaseDate);
            warrantyEndDate.setMonth(warrantyEndDate.getMonth() + wPeriod);

            if (
              warrantyEndDate >= now &&
              warrantyEndDate <= thirtyDaysFromNow
            ) {
              isWarrantyExpiring = true;
            }
          }
        }

        if (isWarrantyExpiring) {
          const exists = alerts.warranty_expiring.some(
            (item) =>
              item &&
              item._id &&
              eq._id &&
              item._id.toString() === eq._id.toString(),
          );
          if (!exists) alerts.warranty_expiring.push(eq);
        }

        const reports = Array.isArray(eq.reports) ? eq.reports : [];

        // 3. Hỏng quá N ngày (ví dụ: hỏng quá 7 ngày)
        if (eq.status === "hỏng hóc") {
          const hasOldBrokenReport = reports.some((r) => {
            try {
              if (
                !r ||
                r.status !== "pending" ||
                r.statusType !== "hỏng hóc" ||
                !r.reportedAt
              )
                return false;
              const repDate = new Date(r.reportedAt);
              return !isNaN(repDate.getTime()) && repDate <= sevenDaysAgo;
            } catch (e) {
              return false;
            }
          });
          if (hasOldBrokenReport) alerts.broken_long_time.push(eq);
        }

        // 4. Phiếu quá hạn (chờ xử lý quá 3 ngày)
        const overdue = reports.filter((r) => {
          try {
            if (!r || r.status !== "pending" || !r.reportedAt) return false;
            const repDate = new Date(r.reportedAt);
            return !isNaN(repDate.getTime()) && repDate <= threeDaysAgo;
          } catch (e) {
            return false;
          }
        });

        if (overdue.length > 0) {
          alerts.overdue_tickets.push({
            equipment_id: eq._id,
            name: eq.name,
            tickets: overdue,
          });
        }
      } catch (innerErr) {
        console.error("Lỗi xử lý thiết bị:", innerErr);
      }
    });

    return res.status(200).json({
      success: true,
      data: alerts,
      maintenance_due: alerts.maintenance_due,
      warranty_expiring: alerts.warranty_expiring,
      broken_long_time: alerts.broken_long_time,
      overdue_tickets: alerts.overdue_tickets,
    });
  } catch (error) {
    console.error("Lỗi API Alerts:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server!", error: error.message });
  }
};
