import {
  createDiscipline, getAllDisciplines, getDisciplineById,
  updateDisciplineById, deleteDisciplineById
} from '../models/disciplineModel.js';

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId } = req.query;
  getAllDisciplines(page, limit, locationId || null, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách bộ môn: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getDisciplineById(req.params.id, (err, discipline) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!discipline) return res.status(404).json({ error: 'Không tìm thấy bộ môn!' });
    res.json(discipline);
  });
};

export const create = (req, res) => {
  const { name, description, locationId } = req.body;
  if (!name || !locationId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tên bộ môn và cơ sở!' });
  }
  createDiscipline({ name, description, locationId }, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi thêm bộ môn: ' + err.message });
    res.status(201).json({ message: 'Thêm bộ môn thành công!', disciplineId: result.disciplineId });
  });
};

export const update = (req, res) => {
  const { name, description, locationId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tên bộ môn!' });
  }
  const data = { name, description, locationId };
  updateDisciplineById(req.params.id, data, (err, discipline) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật bộ môn thành công!', discipline });
  });
};

export const remove = (req, res) => {
  deleteDisciplineById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa bộ môn thành công!' });
  });
};