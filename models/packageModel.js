import Package from './schemas/packageSchema.js';

// 1. CREATE: Tạo một gói tập mới
export const createPackage = async (packageData, callback) => {
  try {
    const { name, price, description, duration_days, is_active, service_id } = packageData;
    const pkg = new Package({
      name,
      price,
      description,
      duration_days,
      is_active: is_active !== undefined ? is_active : true,
      service_id
    });
    const result = await pkg.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

// 2. READ (Danh sách): Lấy toàn bộ danh sách gói tập
export const getAllPackages = async (callback) => {
  try {
    const packages = await Package.find().populate('service_id', 'name');
    callback(null, packages);
  } catch (err) {
    callback(err);
  }
};

// 3. READ (Chi tiết + JOIN)
export const getPackageById = async (id, callback) => {
  try {
    const pkg = await Package.findById(id).populate('service_id', 'name').exec();
    if (!pkg) return callback(null, []);
    callback(null, [pkg]);
  } catch (err) {
    callback(err);
  }
};

// 4. UPDATE: Cập nhật thông tin gói tập
export const updatePackageById = async (id, packageData, callback) => {
  try {
    const { name, price, description, duration_days, is_active, service_id } = packageData;
    const result = await Package.findByIdAndUpdate(
      id,
      { name, price, description, duration_days, is_active, service_id },
      { new: true }
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

// 5. DELETE: Xóa gói tập
export const deletePackageById = async (id, callback) => {
  try {
    const { default: UserPackage } = await import('./schemas/userPackageSchema.js');
    await UserPackage.deleteMany({ package_id: id });
    await Package.findByIdAndDelete(id);
    callback(null, { affectedRows: 1 });
  } catch (err) {
    callback(err);
  }
};
