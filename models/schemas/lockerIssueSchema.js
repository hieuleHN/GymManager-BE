import mongoose from "mongoose";

const lockerIssueSchema = new mongoose.Schema({
  lockerNumber: {
    type: String,
    required: true,
  },
  issueType: {
    type: String,
    enum: ["broken", "dirty", "lost-key"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  // Lấy trực tiếp từ req.user khi tạo báo cáo (xem lockerController.create),
  // không nhận từ client nữa để tránh giả mạo tên người báo cáo.
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true,
  },
  reporterName: {
    // lưu kèm tên tại thời điểm báo cáo để hiển thị nhanh, không cần populate
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "resolved", "rejected"],
    default: "pending",
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

lockerIssueSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("LockerIssue", lockerIssueSchema);
