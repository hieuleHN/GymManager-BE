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

const bookingSchemaV2 = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 60,
    },
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
  BookingV2:
    mongoose.models.BookingV2 || mongoose.model("BookingV2", bookingSchemaV2),
};
