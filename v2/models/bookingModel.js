const mongoose = require("mongoose");

const BOOKING_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
};
const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUS.PENDING]: "Chờ xác nhận",
  [BOOKING_STATUS.CONFIRMED]: "Đã xác nhận",
  [BOOKING_STATUS.COMPLETED]: "Hoàn thành",
  [BOOKING_STATUS.CANCELLED]: "Đã hủy",
  [BOOKING_STATUS.REJECTED]: "Bị từ chối",
};

const SESSION_TYPE = {
  PERSONAL: "PERSONAL",
  GROUP: "GROUP",
  CLASS: "CLASS",
  OTHER: "OTHER",
};
const SESSION_TYPE_LABELS = {
  [SESSION_TYPE.PERSONAL]: "Huấn luyện 1-1",
  [SESSION_TYPE.GROUP]: "Huấn luyện nhóm",
  [SESSION_TYPE.CLASS]: "Lớp tập thể",
  [SESSION_TYPE.OTHER]: "Khác",
};

const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.PENDING]: "Chờ thanh toán",
  [PAYMENT_STATUS.PAID]: "Đã thanh toán",
  [PAYMENT_STATUS.CANCELLED]: "Đã hủy",
};

const bookingSchemaV2 = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true, trim: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerV2",
      default: null,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },

    // Gói tập
    userPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserPackageV2",
      default: null,
    },
    packageName: { type: String, default: "" },

    sessionType: {
      type: String,
      enum: Object.values(SESSION_TYPE),
      default: SESSION_TYPE.PERSONAL,
    },
    disciplineName: { type: String, default: "" },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffV2",
      default: null,
    },
    trainerName: { type: String, default: "" },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, default: 60 },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
    },
    rejectionReason: { type: String, default: "" },
    note: { type: String, default: "" },

    // Thanh toán & Điểm danh
    price: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentMethod: { type: String, default: "" },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceV2",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = {
  BOOKING_STATUS,
  BOOKING_STATUS_LABELS,
  SESSION_TYPE,
  SESSION_TYPE_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  BookingV2:
    mongoose.models.BookingV2 || mongoose.model("BookingV2", bookingSchemaV2),
};
