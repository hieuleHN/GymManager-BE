import Policy from './schemas/policySchema.js';

export const getAllSimple = async () => {
  return Policy.find().sort({ createdAt: -1 });
};

export const getByIds = async (ids) => {
  return Policy.find({ _id: { $in: ids } });
};

export const getAll = async (page = 1, limit = 15, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Policy.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Policy.countDocuments()
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getById = async (id, callback) => {
  try {
    const policy = await Policy.findById(id);
    if (!policy) return callback(null, null);
    callback(null, policy);
  } catch (err) {
    callback(err);
  }
};

export const create = async (data, callback) => {
  try {
    const { title, description, locationId } = data;
    const policy = new Policy({ title, description, locationId });
    const saved = await policy.save();
    callback(null, { id: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const updateById = async (id, data, callback) => {
  try {
    const policy = await Policy.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
    if (!policy) return callback({ message: 'Không tìm thấy chính sách!' });
    callback(null, policy);
  } catch (err) {
    callback(err);
  }
};

export const deleteById = async (id, callback) => {
  try {
    const policy = await Policy.findByIdAndDelete(id);
    if (!policy) return callback({ message: 'Không tìm thấy chính sách!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};