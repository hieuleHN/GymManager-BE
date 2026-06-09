import UserPackage from './schemas/userPackageSchema.js';

// 1. API GET: Lấy danh sách gói tập dựa trên Location của User
export const getAvailablePackagesByUserId = async (userId, callback) => {
  try {
    const { default: User } = await import('./schemas/userSchema.js');
    const { default: Package } = await import('./schemas/packageSchema.js');
    const { default: Service } = await import('./schemas/serviceSchema.js');
    
    const user = await User.findById(userId).populate('locations.location_id');
    if (!user || user.locations.length === 0) {
      return callback(null, []);
    }
    
    const locationIds = user.locations.map(l => l.location_id._id);
    const services = await Service.find({ location_id: { $in: locationIds } });
    const serviceIds = services.map(s => s._id);
    
    const packages = await Package.find({ service_id: { $in: serviceIds }, is_active: true })
      .populate('service_id', 'name');
    
    const result = packages.map(p => ({
      service_id: p.service_id._id,
      service_name: p.service_id.name,
      package_id: p._id,
      package_name: p.name,
      price: p.price,
      description: p.description,
      duration_days: p.duration_days,
      is_active: p.is_active
    }));
    
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

// 2. API POST: Xử lý mua gói
export const subscribePackage = async (userId, packageId, callback) => {
  try {
    const { default: Package } = await import('./schemas/packageSchema.js');
    const pkg = await Package.findById(packageId);
    
    if (!pkg) return callback(new Error('Gói tập không tồn tại!'));
    if (!pkg.is_active) return callback(new Error('Gói tập này hiện tại đang tạm ngưng áp dụng!'));
    
    const { duration_days } = pkg;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration_days * 24 * 60 * 60 * 1000);
    
    const userPackage = new UserPackage({
      user_id: userId,
      package_id: packageId,
      start_date: startDate,
      end_date: endDate,
      status: 'đang hoạt động'
    });
    
    const result = await userPackage.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
