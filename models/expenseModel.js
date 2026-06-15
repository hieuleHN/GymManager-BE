import Expense from "./schemas/expenseSchema.js";

export const getAll = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = {};
    if (locationId) filter.locationId = locationId;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);
    callback(null, {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    callback(err);
  }
};

export const getById = async (id, callback) => {
  try {
    const expense = await Expense.findById(id);
    if (!expense) return callback(null, null);
    callback(null, expense);
  } catch (err) {
    callback(err);
  }
};

export const create = async (data, callback) => {
  try {
    const { category, description, amount, date, note, locationId } = data;
    const expense = new Expense({
      category,
      description,
      amount: Number(amount),
      date: new Date(date),
      note: note || "",
      locationId,
    });
    const saved = await expense.save();
    callback(null, { id: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const updateById = async (id, data, callback) => {
  try {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.date !== undefined) updateData.date = new Date(data.date);
    const expense = await Expense.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!expense) return callback({ message: "Không tìm thấy chi phí!" });
    callback(null, expense);
  } catch (err) {
    callback(err);
  }
};

export const deleteById = async (id, callback) => {
  try {
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return callback({ message: "Không tìm thấy chi phí!" });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};
