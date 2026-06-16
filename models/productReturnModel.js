import ProductReturn from './schemas/productReturnSchema.js';

export const createReturn = async (data, callback) => {
  try {
    const productReturn = new ProductReturn(data);
    const saved = await productReturn.save();
    callback(null, { returnId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllReturns = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = locationId ? { locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ProductReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ProductReturn.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getReturnById = async (id, callback) => {
  try {
    const productReturn = await ProductReturn.findById(id);
    if (!productReturn) return callback(null, null);
    callback(null, productReturn);
  } catch (err) {
    callback(err);
  }
};

export const deleteReturnById = async (id, callback) => {
  try {
    const productReturn = await ProductReturn.findByIdAndDelete(id);
    if (!productReturn) return callback({ message: 'Không tìm thấy phiếu trả hàng!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};