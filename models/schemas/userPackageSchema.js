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
    enum: ["đang hoạt động", "còn 10 ngày", "hết hạn", "đã hủy"],
    default: "đang hoạt động",
  },
  payment_status: {
    type: String,
    enum: ["chờ thanh toán", "đã thanh toán", "đã hủy"],
    default: "chờ thanh toán", // Đã sửa lại mặc định là chờ thanh toán
  },
  payment_method: {
    type: String,
    enum: ["bank-transfer", "qr-code", "vnpay", "momo", "bank-card", ""],
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
