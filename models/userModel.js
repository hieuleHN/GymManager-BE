import User from './schemas/userSchema.js';

// Hàm kiểm tra trùng lặp email/số điện thoại
export const checkExistingUser = async (email, phone, callback) => {
  try {
    const users = await User.find({ $or: [{ email }, { phone }] });
    callback(null, users);
  } catch (err) {
    callback(err);
  }
};

// Hàm tìm kiếm user theo tên đăng nhập
export const findUserByUsername = async (username, callback) => {
  try {
    const user = await User.findOne({ username });
    callback(null, user ? [user] : []);
  } catch (err) {
    callback(err);
  }
};

// HÀM TẠO USER MỚI
export const createUser = async (userData, callback) => {
  try {
    const { username, email, phone, password, role_id, location_id, service_id, package_id } = userData;
    const { default: Package } = await import('./schemas/packageSchema.js');
    const { default: UserPackage } = await import('./schemas/userPackageSchema.js');
    const { default: Role } = await import('./schemas/roleSchema.js');

    // Lấy role mặc định nếu không có
    let roleToUse = role_id;
    if (!roleToUse) {
      const defaultRole = await Role.findOne({ name: 'user' });
      roleToUse = defaultRole ? defaultRole._id : null;
    }

    // Tạo user
    const user = new User({
      username,
      email,
      phone,
      password,
      role_id: roleToUse,
      locations: [{
        location_id: location_id,
        services: [service_id]
      }]
    });
    const savedUser = await user.save();

    // Tạo user_package nếu có package_id
    if (package_id) {
      const pkg = await Package.findById(package_id);
      if (pkg) {
        const duration_days = pkg.duration_days;
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + duration_days * 24 * 60 * 60 * 1000);

        await UserPackage.create({
          user_id: savedUser._id,
          package_id: package_id,
          start_date: startDate,
          end_date: endDate,
          status: 'đang hoạt động'
        });
      }
    }

    callback(null, { userId: savedUser._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllUsers = async (callback) => {
  try {
    const users = await User.find()
      .populate('role_id', 'name')
      .populate('locations.location_id', 'address')
      .populate('locations.services', 'name');
    callback(null, users);
  } catch (err) {
    callback(err);
  }
};

export const getUserById = async (id, callback) => {
  try {
    const user = await User.findById(id)
      .populate('role_id', 'name')
      .populate('locations.location_id', 'address')
      .populate('locations.services', 'name');
    if (!user) return callback(null, []);
    callback(null, [user]);
  } catch (err) {
    callback(err);
  }
};

// CHỨC NĂNG: XÓA USER
export const deleteUserById = async (id, callback) => {
  try {
    const { default: UserPackage } = await import('./schemas/userPackageSchema.js');
    
    const user = await User.findById(id);
    if (!user) return callback(null, { success: false });
    
    const avatarToDelete = user.avatar;
    
    // Xóa user_package
    await UserPackage.deleteMany({ user_id: id });
    
    // Xóa user
    await User.findByIdAndDelete(id);
    
    callback(null, { success: true, avatarToDelete });
  } catch (err) {
    callback(err);
  }
};

// CHỨC NĂNG: CẬP NHẬT THÔNG TIN VÀ ẢNH
export const updateUserById = async (id, userData, hasRolePermission, callback) => {
  try {
    const { username, email, phone, first_name, last_name, avatar, role_id, location_id, service_id, package_id } = userData;
    const { default: Package } = await import('./schemas/packageSchema.js');
    const { default: UserPackage } = await import('./schemas/userPackageSchema.js');

    const user = await User.findById(id);
    if (!user) return callback(new Error('User not found'));
    
    // Cập nhật các trường
    user.username = username || user.username;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    
    if (avatar) user.avatar = avatar;
    
    // Chỉ admin/manager mới được thay đổi role
    if (hasRolePermission && role_id) {
      user.role_id = role_id;
    }
    
    // Cập nhật location/service
    if (location_id && service_id) {
      user.locations = [{
        location_id: location_id,
        services: [service_id]
      }];
    }
    
    const updatedUser = await user.save();
    
    // Xử lý package
    if (package_id) {
      const pkg = await Package.findById(package_id);
      if (pkg) {
        const existingPackage = await UserPackage.findOne({ user_id: id });
        if (!existingPackage) {
          const duration_days = pkg.duration_days;
          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + duration_days * 24 * 60 * 60 * 1000);
          
          await UserPackage.create({
            user_id: id,
            package_id: package_id,
            start_date: startDate,
            end_date: endDate,
            status: 'đang hoạt động'
          });
        } else {
          // Cập nhật package hiện tại
          const newEndDate = new Date(pkg.duration_days * 24 * 60 * 60 * 1000);
          await UserPackage.findByIdAndUpdate(existingPackage._id, {
            package_id: package_id,
            end_date: newEndDate,
            status: 'đang hoạt động'
          });
        }
      }
    }
    
    const oldAvatar = user.avatar && avatar ? user.avatar : null;
    callback(null, { affectedRows: 1, user: updatedUser, avatarToDelete: oldAvatar });
  } catch (err) {
    callback(err);
  }
};