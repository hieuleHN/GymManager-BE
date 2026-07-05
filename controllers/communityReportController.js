import { createReport, getAllReports, updateReportStatus } from '../models/communityReportModel.js';

export const create = (req, res) => {
  const { postId, title, reason } = req.body;
  if (!postId || !title || !reason) {
    return res.status(400).json({ error: 'Thiếu thông tin báo cáo!' });
  }

  createReport({
    reporterId: req.user.id,
    reporterModel: req.user.isStaff ? 'Staff' : 'Customer',
    postId,
    title,
    reason
  }, (err, report) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Báo cáo thành công! Cảm ơn bạn đã đóng góp.', report });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { status } = req.query;
  getAllReports(page, limit, status, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const resolve = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Thiếu trạng thái!' });
  updateReportStatus(id, status, (err, report) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Cập nhật trạng thái báo cáo!', report });
  });
};
