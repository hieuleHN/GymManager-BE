import CommunityReport from './schemas/communityReportSchema.js';
import CommunityPost from './schemas/communityPostSchema.js';

export const createReport = async (data, callback) => {
  try {
    const report = new CommunityReport(data);
    const saved = await report.save();
    await CommunityPost.findByIdAndUpdate(data.postId, { status: 'reported' });
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getAllReports = async (page = 1, limit = 20, status, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = {};
    if (status) query.status = status;
    const [data, total] = await Promise.all([
      CommunityReport.find(query)
        .populate('reporterId', 'fullName account email')
        .populate('postId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityReport.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updateReportStatus = async (id, status, callback) => {
  try {
    const report = await CommunityReport.findByIdAndUpdate(id, { status }, { new: true });
    if (!report) return callback({ message: 'Không tìm thấy báo cáo!' });
    if (status === 'dismissed') {
      await CommunityPost.findByIdAndUpdate(report.postId, { status: 'active' });
    }
    callback(null, report);
  } catch (err) {
    callback(err);
  }
};
