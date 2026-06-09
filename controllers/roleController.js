import * as RoleModel from '../models/roleModel.js';

export const getAllRoles = (req, res) => {
  RoleModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getRoleById = (req, res) => {
  RoleModel.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy vai trò này!' });
    res.json(results[0]);
  });
};

export const createRole = (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên vai trò không được để trống!'});

  RoleModel.create(name, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Tạo vai trò thành công!', role_id: result.insertId });
  });
};

export const updateRole = (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên vai trò không được để trống!' });

  RoleModel.update(req.params.id, name, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy vai trò để cập nhật!' });
    res.json({ message: 'Cập nhật vai trò thành công!' });
  });
};

export const deleteRole = (req, res) => {
  RoleModel.remove(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Không thể xóa vai trò này vì có thể đang có User sử dụng!' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy vai trò để xóa!' });
    res.json({ message: 'Xóa vai trò thành công!' });
  });
};