import * as ServiceModel from '../models/serviceModel.js';

export const getAllServices = (req, res) => {
  ServiceModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getServiceById = (req, res) => {
  ServiceModel.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy dịch vụ này!' });
    res.json(results[0]);
  });
};

export const createService = (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });

  ServiceModel.create({ name, description }, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Thêm dịch vụ thành công!', service_id: result.insertId });
  });
};

export const updateService = (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });

  ServiceModel.update(req.params.id, { name, description }, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy dịch vụ để cập nhật!' });
    res.json({ message: 'Cập nhật dịch vụ thành công!' });
  });
};

export const deleteService = (req, res) => {
  ServiceModel.remove(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Không thể xóa dịch vụ vì đang vướng dữ liệu liên kết!' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy dịch vụ để xóa!' });
    res.json({ message: 'Xóa dịch vụ thành công!' });
  });
};