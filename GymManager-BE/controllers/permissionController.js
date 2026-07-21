import { getAllPermissions, getPermissionsByJob, updatePermissions, deletePermissions, getAllFeatures } from '../models/permissionModel.js';
import Job from './../models/schemas/jobSchema.js';

export const list = (req, res) => {
  getAllPermissions((err, permissions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(permissions);
  });
};

export const listFeatures = (req, res) => {
  getAllFeatures((err, features) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(features);
  });
};

export const getByJob = (req, res) => {
  const { jobId } = req.params;
  getPermissionsByJob(jobId, (err, permission) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(permission || { jobId, permissions: [] });
  });
};

export const update = (req, res) => {
  const { jobId, permissions } = req.body;
  if (!jobId || !permissions) {
    return res.status(400).json({ error: 'Vui lòng cung cấp công việc và quyền hạn!' });
  }
  updatePermissions(jobId, permissions, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật quyền!' });
    res.json({ message: 'Cập nhật phân quyền thành công!', permission: result });
  });
};

export const remove = (req, res) => {
  const { jobId } = req.params;
  deletePermissions(jobId, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa phân quyền thành công!' });
  });
};