import Service from './schemas/serviceSchema.js';
import fs from 'fs';
import path from 'path';

// Lấy tất cả dịch vụ
export const getAll = async (callback) => {
  try {
    const services = await Service.find().populate('location_id', 'address');
    callback(null, services);
  } catch (err) {
    callback(err);
  }
};

// Lấy dịch vụ theo ID
export const getById = async (id, callback) => {
  try {
    const service = await Service.findById(id).populate('location_id', 'address');
    if (!service) return callback(null, []);
    callback(null, [service]);
  } catch (err) {
    callback(err);
  }
};

// Tạo dịch vụ với ảnh
export const createWithImages = async (data, imagesData, callback) => {
  try {
    const { name, location_id } = data;
    const service = new Service({
      name,
      location_id,
      images: imagesData || []
    });
    const result = await service.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

// Cập nhật dịch vụ với ảnh
export const updateWithImages = async (id, data, imagesData, callback) => {
  try {
    const { name, location_id } = data;
    const service = await Service.findById(id);
    if (!service) return callback(new Error('NotFound'));
    
    const oldImageFiles = service.images.map(img => img.url);
    
    const updated = await Service.findByIdAndUpdate(
      id,
      { name, location_id, images: imagesData || [] },
      { new: true }
    );
    
    callback(null, { success: true, oldFiles: oldImageFiles });
  } catch (err) {
    callback(err);
  }
};

// Xóa dịch vụ và cascade
export const removeCascade = async (id, callback) => {
  try {
    const service = await Service.findById(id);
    if (!service) return callback(null, { fileNames: [] });
    
    const fileNames = service.images.map(img => img.url);
    
    // Xóa package và user_package liên quan
    const { default: Package } = await import('./schemas/packageSchema.js');
    const { default: UserPackage } = await import('./schemas/userPackageSchema.js');
    
    const packages = await Package.find({ service_id: id });
    for (const pkg of packages) {
      await UserPackage.deleteMany({ package_id: pkg._id });
    }
    await Package.deleteMany({ service_id: id });
    
    // Xóa service
    await Service.findByIdAndDelete(id);
    
    callback(null, { fileNames });
  } catch (err) {
    callback(err);
  }
};
