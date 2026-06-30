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
  const { name, salary, description, isAdmin } = req.body;
  if (!name || !salary) {
    return res.status(400).json({ error: 'Vui lòng nhập tên công việc và tiền lương!' });
  }
  if (salary <= 0) {
    return res.status(400).json({ error: 'Tiền lương phải lớn hơn 0!' });
  }
  createJob({ name, salary: Number(salary), description, isAdmin }, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm công việc!' });
    res.status(201).json({ message: 'Thêm công việc thành công!', jobId: result.jobId });
  });
};

export const update = (req, res) => {
  const { name, salary, description, isAdmin } = req.body;
  if (salary !== undefined && salary <= 0) {
    return res.status(400).json({ error: 'Tiền lương phải lớn hơn 0!' });
  }
  const data = { name, salary: salary !== undefined ? Number(salary) : undefined, description, isAdmin };
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