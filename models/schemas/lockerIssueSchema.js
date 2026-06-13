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
  reportedBy: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "resolved"],
    default: "pending",
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
