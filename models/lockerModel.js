import LockerIssue from "./schemas/lockerIssueSchema.js";

export const getAll = async (page = 1, limit = 15, locationId, reporterId, status) => {
  const filter = {};
  if (locationId) filter.locationId = locationId;
  if (reporterId) filter.reporterId = reporterId;
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    LockerIssue.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
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

export const create = async (data) => {
  const { lockerNumber, issueType, description, reporterId, reporterName, locationId } = data;
  const issue = new LockerIssue({
    lockerNumber,
    issueType,
    description,
    reporterId,
    reporterName,
    status: "pending",
    locationId,
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
