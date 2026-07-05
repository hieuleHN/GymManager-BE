import { createComment, getCommentsByPost, deleteComment } from '../models/communityCommentModel.js';

export const create = (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Nội dung bình luận là bắt buộc!' });

  createComment({
    postId,
    authorId: req.user.id,
    authorModel: req.user.isStaff ? 'Staff' : 'Customer',
    content
  }, (err, comment) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Bình luận thành công!', comment });
  });
};

export const list = (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  getCommentsByPost(postId, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const remove = (req, res) => {
  deleteComment(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa bình luận thành công!' });
  });
};
