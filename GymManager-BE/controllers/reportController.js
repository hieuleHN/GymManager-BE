import { createReport, getReportsByTarget, getAllReports, updateReportStatus } from '../models/reportModel.js';

export const create = (req, res) => {
  const { targetId, title, reason } = req.body;
  if (!targetId || !title || !reason) {
    return res.status(400).json({ error: 'Thiếu thông tin báo cáo!' });
  }
  createReport({ reporterId: req.user.id, targetId, title, reason }, (err, report) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Báo cáo thành công!', report });
  });
};

export const listByTarget = (req, res) => {
  const { targetId } = req.params;
  getReportsByTarget(targetId, (err, reports) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(reports);
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  getAllReports(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const resolve = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Thiếu trạng thái!' });
  updateReportStatus(id, status, (err, report) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cập nhật trạng thái báo cáo!', report });
  });
};
