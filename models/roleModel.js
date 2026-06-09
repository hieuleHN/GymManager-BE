import Role from './schemas/roleSchema.js';

export const getAll = async (callback) => {
  try {
    const roles = await Role.find();
    callback(null, roles);
  } catch (err) {
    callback(err);
  }
};

export const getById = async (id, callback) => {
  try {
    const role = await Role.findById(id);
    callback(null, [role]);
  } catch (err) {
    callback(err);
  }
};

export const create = async (name, callback) => {
  try {
    const role = new Role({ name });
    const result = await role.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const update = async (id, name, callback) => {
  try {
    const result = await Role.findByIdAndUpdate(id, { name }, { new: true });
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const remove = async (id, callback) => {
  try {
    await Role.findByIdAndDelete(id);
    callback(null, { affectedRows: 1 });
  } catch (err) {
    callback(err);
  }
};