import { createReport, getAllReports, updateReportStatus } from '../models/communityReportModel.js';
import { getPostById } from '../models/communityPostModel.js';
import { createNotification } from '../models/notificationModel.js';

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

    getPostById(postId, (err, post) => {
      if (!err && post && post.authorId.toString() !== req.user.id) {
        const recipientRole = post.authorModel === 'Staff' ? 'staff' : 'member';
        createNotification({
          recipientId: post.authorId,
          recipientRole,
          title: 'Báo cáo bài viết',
          message: `Bài viết của bạn đã bị báo cáo với lý do: ${title}.`,
          type: 'report',
          relatedPostId: post._id
        }, () => {});
      }
    });

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
