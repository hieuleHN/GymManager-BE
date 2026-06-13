import Discipline from './schemas/disciplineSchema.js';

export const createDiscipline = async (data, callback) => {
  try {
    const discipline = new Discipline(data);
    const saved = await discipline.save();
    callback(null, { disciplineId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllDisciplines = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = locationId ? { locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Discipline.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Discipline.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getDisciplineById = async (id, callback) => {
  try {
    const discipline = await Discipline.findById(id);
    if (!discipline) return callback(null, null);
    callback(null, discipline);
  } catch (err) {
    callback(err);
  }
};

export const updateDisciplineById = async (id, data, callback) => {
  try {
    const discipline = await Discipline.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!discipline) return callback({ message: 'Không tìm thấy bộ môn!' });
    callback(null, discipline);
  } catch (err) {
    callback(err);
  }
};

export const deleteDisciplineById = async (id, callback) => {
  try {
    const discipline = await Discipline.findByIdAndDelete(id);
    if (!discipline) return callback({ message: 'Không tìm thấy bộ môn!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};