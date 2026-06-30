import * as PolicyModel from '../models/policyModel.js';

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  PolicyModel.getAll(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  PolicyModel.getById(req.params.id, (err, policy) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!policy) return res.status(404).json({ error: 'Không tìm thấy chính sách!' });
    res.json(policy);
  });
};

export const create = (req, res) => {
  const { title, description, locationId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Vui lòng nhập tiêu đề chính sách!' });
  if (!description?.trim()) return res.status(400).json({ error: 'Vui lòng nhập mô tả chính sách!' });
  PolicyModel.create({ title: title.trim(), description: description.trim(), locationId }, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm chính sách!' });
    res.status(201).json({ message: 'Thêm chính sách thành công!', id: result.id });
  });
};

export const update = (req, res) => {
  const { title, description } = req.body;
  const data = {};
  if (title !== undefined) { if (!title.trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống!' }); data.title = title.trim(); }
  if (description !== undefined) { if (!description.trim()) return res.status(400).json({ error: 'Mô tả không được để trống!' }); data.description = description.trim(); }
  PolicyModel.updateById(req.params.id, data, (err, policy) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật chính sách thành công!', policy });
  });
};

export const remove = (req, res) => {
  PolicyModel.deleteById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa chính sách thành công!' });
  });
};