import mongoose from "mongoose";

const lockerIssueSchema = new mongoose.Schema({
  lockerNumber: {
    type: String,
    required: true,
  },
  issueType: {
    type: String,
    enum: ["broken", "dirty", "lost-key", "other"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: null,
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
  priority: {
    type: String,
    enum: ["high", "medium", "low"],
    default: "medium",
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
  if (this.isNew || this.isModified("issueType")) {
    const priorityMap = { broken: "high", "lost-key": "medium", dirty: "low", other: "low" };
    this.priority = priorityMap[this.issueType] || "medium";
  }
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("LockerIssue", lockerIssueSchema);
