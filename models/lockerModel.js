import mongoose from 'mongoose';
import LockerIssue from "./schemas/lockerIssueSchema.js";

export const getAll = async (page = 1, limit = 15, locationId, reporterId, status, fromDate, toDate) => {
  const filter = {};
  if (locationId) filter.locationId = new mongoose.Types.ObjectId(locationId);
  if (reporterId) filter.reporterId = new mongoose.Types.ObjectId(reporterId);
  if (status) filter.status = status;
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const skip = (page - 1) * limit;
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const [data, total] = await Promise.all([
    LockerIssue.aggregate([
      { $match: filter },
      { $addFields: {
        priorityOrder: { $switch: { branches: [
          { case: { $eq: ["$priority", "high"] }, then: 1 },
          { case: { $eq: ["$priority", "medium"] }, then: 2 },
          { case: { $eq: ["$priority", "low"] }, then: 3 },
        ], default: 2 } },
        _id: { $toString: "$_id" },
        reporterId: { $toString: "$reporterId" },
        locationId: { $cond: { if: "$locationId", then: { $toString: "$locationId" }, else: null } },
      }},
      { $sort: { priorityOrder: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: {
        priorityOrder: 0,
        __v: 0,
      }},
    ]),
    LockerIssue.countDocuments(filter),
  ]);
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getById = async (id) => {
  return LockerIssue.findById(id);
};

export const findPendingByLockerAndType = async (lockerNumber, issueType) => {
  return LockerIssue.findOne({
    lockerNumber,
    issueType,
    status: { $in: ['pending', 'in-progress'] },
  });
};

export const create = async (data) => {
  const { lockerNumber, issueType, description, reporterId, reporterName, locationId, image } = data;
  const issue = new LockerIssue({
    lockerNumber,
    issueType,
    description,
    reporterId,
    reporterName,
    status: "pending",
    locationId,
    image: image || null,
  });
  const saved = await issue.save();
  return { id: saved._id };
};

export const updateById = async (id, data) => {
  const issue = await LockerIssue.findByIdAndUpdate(
    id,
    { ...data, updatedAt: new Date() },
    { new: true },
  );
  if (!issue) throw new Error("Không tìm thấy vấn đề!");
  return issue;
};

export const markResolved = async (id) => {
  const issue = await LockerIssue.findByIdAndUpdate(
    id,
    { status: "resolved", updatedAt: new Date() },
    { new: true },
  );
  if (!issue) throw new Error("Không tìm thấy vấn đề!");
  return issue;
};

export const reject = async (id, rejectionReason) => {
  const issue = await LockerIssue.findByIdAndUpdate(
    id,
    { status: "rejected", rejectionReason, updatedAt: new Date() },
    { new: true },
  );
  if (!issue) throw new Error("Không tìm thấy vấn đề!");
  return issue;
};

export const deleteById = async (id) => {
  const issue = await LockerIssue.findByIdAndDelete(id);
  if (!issue) throw new Error("Không tìm thấy vấn đề!");
  return { success: true };
};
