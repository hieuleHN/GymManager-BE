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

const bookingSchemaV2 = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },

    // Vừa bổ sung: Loại buổi tập và PT
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
  BookingV2:
    mongoose.models.BookingV2 || mongoose.model("BookingV2", bookingSchemaV2),
};
