import {
  createJob, getAllJobs, getJobById, updateJobById, deleteJobById
} from '../models/jobModel.js';

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  getAllJobs(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getJobById(req.params.id, (err, job) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!job) return res.status(404).json({ error: 'Không tìm thấy công việc!' });
    res.json(job);
  });
};

export const create = (req, res) => {
  const { name, description, isAdmin, permissions } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Vui lòng nhập tên công việc!' });
  }
  createJob({ name, description, isAdmin, permissions }, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm công việc!' });
    res.status(201).json({ message: 'Thêm công việc thành công!', jobId: result.jobId });
  });
};

export const update = (req, res) => {
  const { name, description, isAdmin, permissions } = req.body;
  const data = { name, description, isAdmin, permissions };
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  updateJobById(req.params.id, data, (err, job) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật công việc thành công!', job });
  });
};

export const remove = (req, res) => {
  deleteJobById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa công việc thành công!' });
  });
};