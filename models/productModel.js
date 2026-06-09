import Product from './schemas/productSchema.js';

export const getAll = async (callback) => {
  try {
    const products = await Product.find()
      .populate('location_id', 'address');

    callback(null, products);
  } catch (err) {
    callback(err);
  }
};

export const getById = async (id, callback) => {
  try {
    const product = await Product.findById(id)
      .populate('location_id', 'address');

    if (!product) return callback(null, []);

    callback(null, [product]);
  } catch (err) {
    callback(err);
  }
};

export const getByLocation = async (locationId, callback) => {
  try {
    const products = await Product.find({
      location_id: locationId
    });

    callback(null, products);
  } catch (err) {
    callback(err);
  }
};

export const create = async (data, callback) => {
  try {
    const product = new Product(data);

    const result = await product.save();

    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const update = async (id, data, callback) => {
  try {
    const product = await Product.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );

    if (!product) {
      return callback(new Error('NotFound'));
    }

    callback(null, product);
  } catch (err) {
    callback(err);
  }
};

export const remove = async (id, callback) => {
  try {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return callback(new Error('NotFound'));
    }

    callback(null, product);
  } catch (err) {
    callback(err);
  }
};