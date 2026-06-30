import Report from './schemas/reportSchema.js';

export const createReport = async (data, callback) => {
  try {
    const report = new Report(data);
    const saved = await report.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getReportsByTarget = async (targetId, callback) => {
  try {
    const reports = await Report.find({ targetId })
      .populate('reporterId', 'fullName phone email')
      .sort({ createdAt: -1 });
    callback(null, reports);
  } catch (err) {
    callback(err);
  }
};

export const getAllReports = async (page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Report.find()
        .populate('reporterId', 'fullName phone email')
        .populate('targetId', 'fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments()
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updateReportStatus = async (id, status, callback) => {
  try {
    const report = await Report.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
    callback(null, report);
  } catch (err) {
    callback(err);
  }
};
