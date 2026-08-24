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
    const { cost, result, downtime_days } = req.body;

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
}; // CHÚ Ý: Dấu ngoặc này là để đóng hàm resolveReport

export const exportEquipmentsToExcel = async (req, res) => {
  try {
    const { locationId } = req.query;
    let filter = {};

    if (locationId) {
      if (!mongoose.Types.ObjectId.isValid(locationId)) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
      }
      filter.location_id = locationId;
    }

    const equipments = await Equipment.find(filter).populate(
      "location_id",
      "name",
    );

    if (!equipments || equipments.length === 0) {
      return res.status(404).json({ message: "Không có dữ liệu thiết bị!" });
    }

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bao_Cao_Thiet_Bi");

    worksheet.columns = [
      { header: "STT", key: "stt", width: 5 },
      { header: "Tên thiết bị", key: "name", width: 25 },
      { header: "Trạng thái", key: "status", width: 15 },
      { header: "Nhà cung cấp", key: "supplier", width: 20 },
      { header: "Ngày mua", key: "purchase_date", width: 15 },
      { header: "Nguyên giá (VNĐ)", key: "unitPrice", width: 15 },
      {
        header: "Phí bảo trì (VNĐ)",
        key: "total_maintenance_cost",
        width: 20,
      },
      { header: "Downtime (Ngày)", key: "total_downtime_days", width: 18 },
      { header: "Tỷ lệ sẵn sàng (%)", key: "availability", width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    const now = new Date();

    equipments.forEach((eq, index) => {
      const purchaseDate = new Date(eq.purchase_date);
      let totalDays = Math.floor(
        (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (totalDays <= 0) totalDays = 1;

      const downtimeDays = eq.total_downtime_days || 0;
      let availability = ((totalDays - downtimeDays) / totalDays) * 100;

      availability = Math.max(0, Math.min(100, availability));

      worksheet.addRow({
        stt: index + 1,
        name: eq.name,
        status: eq.status.toUpperCase(),
        supplier: eq.supplier,
        purchase_date: purchaseDate.toLocaleDateString("vi-VN"),
        unitPrice: eq.unitPrice,
        total_maintenance_cost: eq.total_maintenance_cost,
        total_downtime_days: downtimeDays,
        availability: availability.toFixed(2) + "%",
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
