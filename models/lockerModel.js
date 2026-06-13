import LockerIssue from './schemas/lockerIssueSchema.js';

export const getAll = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = {};
    if (locationId) filter.locationId = locationId;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      LockerIssue.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LockerIssue.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getById = async (id, callback) => {
  try {
    const issue = await LockerIssue.findById(id);
    if (!issue) return callback(null, null);
    callback(null, issue);
  } catch (err) {
    callback(err);
  }
};

export const create = async (data, callback) => {
  try {
    const { lockerNumber, issueType, description, reportedBy, locationId } = data;
    const issue = new LockerIssue({
      lockerNumber,
      issueType,
      description,
      reportedBy,
      status: 'pending',
      locationId
    });
    const saved = await issue.save();
    callback(null, { id: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const updateById = async (id, data, callback) => {
  try {
    const issue = await LockerIssue.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
    if (!issue) return callback({ message: 'Không tìm thấy vấn đề!' });
    callback(null, issue);
  } catch (err) {
    callback(err);
  }
};

export const markResolved = async (id, callback) => {
  try {
    const issue = await LockerIssue.findByIdAndUpdate(id, { status: 'resolved', updatedAt: new Date() }, { new: true });
    if (!issue) return callback({ message: 'Không tìm thấy vấn đề!' });
    callback(null, issue);
  } catch (err) {
    callback(err);
  }
};

export const deleteById = async (id, callback) => {
  try {
    const issue = await LockerIssue.findByIdAndDelete(id);
    if (!issue) return callback({ message: 'Không tìm thấy vấn đề!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};