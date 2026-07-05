import { createComment, getCommentsByPost, deleteCommentById } from '../models/commentModel.js';
import { getPostById } from '../models/communityPostModel.js';

export const addComment = (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung bình luận!' });
  }

  const { postId } = req.params;

  getPostById(postId, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

    const commentData = {
      postId,
      content: content.trim(),
      authorType: req.user.isStaff ? 'staff' : 'member'
    };

    if (req.user.isStaff) {
      commentData.staffId = req.user.id;
    } else {
      commentData.customerId = req.user.id;
    }

    createComment(commentData, (err2, comment) => {
      if (err2) return res.status(500).json({ error: 'Lỗi tạo bình luận: ' + err2.message });
      res.status(201).json({ message: 'Bình luận thành công!', comment });
    });
  });
};

export const listComments = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  getCommentsByPost(req.params.postId, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy bình luận: ' + err.message });
    res.json(result);
  });
};

export const removeComment = (req, res) => {
  deleteCommentById(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã xóa bình luận!' });
  });
};
