import Location from './schemas/locationSchema.js';
import Service from './schemas/serviceSchema.js';
import Package from './schemas/packageSchema.js';
import UserPackage from './schemas/userPackageSchema.js';

// 1. Lấy tất cả cơ sở kèm danh sách ảnh
export const getAll = async (callback) => {
  try {
    const locations = await Location.find();
    callback(null, locations);
  } catch (err) {
    callback(err);
  }
};

// 2. Lấy chi tiết một cơ sở kèm mảng ảnh
export const getById = async (id, callback) => {
  try {
    const location = await Location.findById(id);
    if (!location) return callback(null, []);
    callback(null, [location]);
  } catch (err) {
    callback(err);
  }
};

// 3. Tạo cơ sở mới với ảnh
export const createWithImages = async (locationData, imageDataArrays, callback) => {
  try {
    const { address, phone } = locationData;
    const location = new Location({
      address,
      phone,
      images: imageDataArrays || []
    });
    const result = await location.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

// 4. Cập nhật cơ sở và thay mới bộ ảnh
export const updateWithImages = async (id, locationData, imageDataArrays, callback) => {
  try {
    const { address, phone } = locationData;
    const location = await Location.findById(id);
    
    if (!location) {
      return callback(new Error('NotFound'));
    }

    const oldImageFiles = location.images.map(img => img.url);

    const updatedLocation = await Location.findByIdAndUpdate(
      id,
      {
        address,
        phone,
        images: imageDataArrays || []
      },
      { new: true }
    );

    callback(null, { affectedRows: 1, oldFiles: oldImageFiles });
  } catch (err) {
    callback(err);
  }
};

// 5. Xóa cơ sở (Xóa dữ liệu DB và trả về danh sách file để controller xóa vật lý)
export const remove = async (id, callback) => {
  try {
    const location = await Location.findById(id);
    
    if (!location) {
      return callback(null, { fileNames: [] });
    }

    const fileNames = location.images.map(img => img.url);
    
    // Xóa location và tất cả các services liên quan
    await Location.findByIdAndDelete(id);
    
    callback(null, { fileNames });
  } catch (err) {
    callback(err);
  }
};
