import mongoose from "mongoose";

const userPackageSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  package_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Package",
    required: true,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  duration_months: {
    type: Number,
    default: 1,
  },
  ptSessionsPerMonth: {
    type: Number,
    default: 0
  },
  isFullMonth: {
    type: Boolean,
    default: false
  },
  monthlySessions: [{
    month: Number,
    year: Number,
    total: Number,
    used: { type: Number, default: 0 }
  }],
  total_price: {
    type: Number,
    default: 0,
  },
  signature: {
    type: String,
    default: "",
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["chờ xác nhận", "đang hoạt động", "còn 10 ngày", "đang tạm ngưng", "hết hạn", "đã hủy"],
    default: "đang hoạt động",
  },
  // Phiếu gia hạn hộ do admin tạo, chờ duyệt
  is_renewal_ticket: {
    type: Boolean,
    default: false,
  },
  original_registration_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserPackage",
    default: null,
  },
  // Ngày bắt đầu dự kiến của phiếu gia hạn (chốt lại khi duyệt)
  proposed_start_date: {
    type: Date,
    default: null,
  },
  renewal_note: {
    type: String,
    default: "",
  },
  // Giá chốt tại thời điểm mua (hợp đồng cũ giữ giá cũ khi gói đổi giá)
  unit_price_applied: {
    type: Number,
    default: null,
  },
  price_snapshot: {
    unit_price: { type: Number, default: null },
    months: { type: Number, default: null },
    discount_percent: { type: Number, default: null },
  },
  // Theo dõi gửi nhắc thanh toán / nhắc gia hạn để chống spam
  payment_reminder_sent_at: {
    type: Date,
    default: null,
  },
  last_renewal_reminder_at: {
    type: Date,
    default: null,
  },
  frozenAt: {
    type: Date,
    default: null,
  },
  frozenUntil: {
    type: Date,
    default: null,
  },
  payment_status: {
    type: String,
    enum: ["chờ thanh toán", "đã thanh toán", "đã hủy"],
    default: "chờ thanh toán", // Đã sửa lại mặc định là chờ thanh toán
  },
  payment_method: {
    type: String,
    enum: ["bank-transfer", "qr-code", "vnpay", "momo", "bank-card", "wallet", ""],
    default: "",
  },
  vnpay_txn_ref: {
    type: String,
    default: null,
  },
  vnpay_bank_code: {
    type: String,
    default: null,
  },
  vnpay_bank_tran_no: {
    type: String,
    default: null,
  },
  vnpay_card_type: {
    type: String,
    default: null,
  },
  vnpay_transaction_no: {
    type: String,
    default: null,
  },
  payment_date: {
    type: Date,
    default: null,
  },
  confirmed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
  },
  confirmed_at: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userPackageSchema.pre("save", function (next) {
  if (this.isModified("start_date") && !this.end_date) {
    const end = new Date(this.start_date);
    end.setMonth(end.getMonth() + this.duration_months);
    this.end_date = end;
  }
  next();
});

export default mongoose.model("UserPackage", userPackageSchema);
