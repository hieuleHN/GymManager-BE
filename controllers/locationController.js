import * as LocationModel from '../models/locationModel.js';

export const getAllLocations = (req, res) => {
  LocationModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getLocationById = (req, res) => {
  LocationModel.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy cơ sở này!' });
    res.json(results[0]);
  });
};

export const createLocation = (req, res) => {
  const {address, phone } = req.body;
  if (!address) return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });

  LocationModel.create({ address, phone }, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Thêm cơ sở thành công!', location_id: result.insertId });
  });
};

export const updateLocation = (req, res) => {
  const {address, phone } = req.body;
  if (!address) return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });

  LocationModel.update(req.params.id, { address, phone }, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy cơ sở để cập nhật!' });
    res.json({ message: 'Cập nhật cơ sở thành công!' });
  });
};

export const deleteLocation = (req, res) => {
  LocationModel.remove(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Không thể xóa cơ sở vì đang vướng dữ liệu liên kết!' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy cơ sở để xóa!' });
    res.json({ message: 'Xóa cơ sở thành công!' });
  });
};