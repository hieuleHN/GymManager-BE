import Permission from './schemas/permissionSchema.js';
import Job from './schemas/jobSchema.js';

export const getPermissionsByJob = async (jobId, callback) => {
  try {
    const permission = await Permission.findOne({ jobId }).populate('jobId', 'name');
    if (!permission) return callback(null, null);
    callback(null, permission);
  } catch (err) {
    callback(err);
  }
};

export const getAllPermissions = async (callback) => {
  try {
    const permissions = await Permission.find().populate('jobId', 'name').sort({ createdAt: -1 });
    callback(null, permissions);
  } catch (err) {
    callback(err);
  }
};

export const updatePermissions = async (jobId, permissions, callback) => {
  try {
    const result = await Permission.findOneAndUpdate(
      { jobId },
      { jobId, permissions, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const deletePermissions = async (jobId, callback) => {
  try {
    await Permission.findOneAndDelete({ jobId });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

const allFeatures = [
  { id: 'statistics', name: 'Dashboard / Thống kê / Chi phí' },
  { id: 'customers', name: 'Quản lý khách hàng' },
  { id: 'equipment', name: 'Quản lý thiết bị / Tủ đồ' },
  { id: 'packages', name: 'Quản lý gói tập / Hợp đồng' },
  { id: 'services', name: 'Quản lý dịch vụ / Chính sách / Giao diện' },
  { id: 'attendance', name: 'Quản lý điểm danh' },
  { id: 'products', name: 'Quản lý sản phẩm' },
  { id: 'clubs', name: 'Quản lý bộ môn / Cơ sở' },
  { id: 'staff', name: 'Quản lý nhân viên / Tuyển dụng' },
  { id: 'tasks', name: 'Quản lý công việc' },
  { id: 'payment', name: 'Quản lý thanh toán' },
  { id: 'training', name: 'Quản lý HLV / Lịch tập' },
  { id: 'schedule', name: 'Xác nhận lịch tập' },
  { id: 'wallet', name: 'Ví điện tử nhân viên' }
];

export const getAllFeatures = async (callback) => {
  callback(null, allFeatures);
};