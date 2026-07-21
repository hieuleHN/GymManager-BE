import Job from './schemas/jobSchema.js';

export const createJob = async (data, callback) => {
  try {
    const existing = await Job.findOne({ name: data.name });
    if (existing) return callback({ message: 'Tên công việc đã tồn tại!' });
    const job = new Job({
      name: data.name,
      salary: data.salary || 0,
      description: data.description || '',
      isAdmin: data.isAdmin || false,
      permissions: data.permissions || []
    });
    const saved = await job.save();
    callback(null, { jobId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllJobs = async (page = 1, limit = 15, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Job.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments()
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getJobById = async (id, callback) => {
  try {
    const job = await Job.findById(id);
    if (!job) return callback(null, null);
    callback(null, job);
  } catch (err) {
    callback(err);
  }
};

export const updateJobById = async (id, data, callback) => {
  try {
    const job = await Job.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
    if (!job) return callback({ message: 'Không tìm thấy công việc!' });
    callback(null, job);
  } catch (err) {
    callback(err);
  }
};

export const deleteJobById = async (id, callback) => {
  try {
    const job = await Job.findByIdAndDelete(id);
    if (!job) return callback({ message: 'Không tìm thấy công việc!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};