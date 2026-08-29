import mongoose from "mongoose";

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Tên thiết bị là bắt buộc"] },
  quantity: { type: Number, default: 1, min: [1, "Số lượng tối thiểu là 1"] },
  unitPrice: { type: Number, default: 0, min: [0, "Đơn giá không được âm"] },
  total: { type: Number, default: 0, min: [0, "Tổng tiền không được âm"] },
  status: {
    type: String,
    enum: ["hoạt động", "hỏng hóc", "bảo trì", "thiếu linh kiện"],
    default: "hoạt động",
  },
  supplier: { type: String, required: [true, "Nhà cung cấp là bắt buộc"] },
  phone: {
    type: String,
    required: [true, "Số điện thoại liên hệ là bắt buộc"],
    match: [
      /(03|05|07|08|09)+([0-9]{8})\b/,
      "Số điện thoại không đúng định dạng",
    ],
  },
  address: { type: String, required: [true, "Địa chỉ là bắt buộc"] },
  purchaser: { type: String, required: [true, "Người mua là bắt buộc"] },
  description: { type: String, default: "" },
  purchase_date: { type: Date, default: Date.now },
  warranty_period: {
    type: Number,
    default: 12,
    min: [0, "Thời gian bảo hành không được âm"],
  },
  maintenance_cycle_months: {
    type: Number,
    default: 0,
    min: [0, "Chu kỳ bảo trì không được âm"],
  },
  last_maintenance_date: { type: Date, default: Date.now },
  total_maintenance_cost: { type: Number, default: 0, min: 0 },
  total_downtime_days: { type: Number, default: 0, min: 0 },
  image_url: { type: String, default: "" },
  invoice_url: { type: String, default: "" },
  warranty_card_url: { type: String, default: "" },
  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: [true, "Cơ sở (Location) là bắt buộc"],
  },
  createdAt: { type: Date, default: Date.now },
  reports: [
    {
      statusType: {
        type: String,
        enum: ["hoạt động", "bảo trì", "hỏng hóc", "thiếu linh kiện"],
        default: "hoạt động",
      },
      affectedQuantity: {
        type: Number,
        default: 1,
        min: [1, "Số lượng ảnh hưởng tối thiểu là 1"],
      },
      reason: { type: String, required: [true, "Lý do báo cáo là bắt buộc"] },
      reportedAt: { type: Date, default: Date.now },
      assigned_to: { type: String, default: "" },
      cost: { type: Number, default: 0, min: 0 },
      result: { type: String, default: "" },
      resolvedAt: { type: Date, default: null },
      downtime_days: { type: Number, default: 0, min: 0 },
      status: {
        type: String,
        enum: ["pending", "processing", "resolved"],
        default: "pending",
      },
    },
  ],
});

export default mongoose.model("Equipment", equipmentSchema);
