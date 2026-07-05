import {
  createPost, getAllPosts, getPostById, getPostsByCustomer,
  updatePostById, deletePostById, getAnnouncements, getMemberPostsForAdmin
} from '../models/communityPostModel.js';
import { createNotification } from '../models/notificationModel.js';

export const create = (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung bài viết!' });
  }

  const postData = {
    content: content.trim(),
    authorType: req.user.isStaff ? 'staff' : 'member',
    isAnnouncement: req.body.isAnnouncement === 'true' || req.body.isAnnouncement === true
  };

  if (req.user.isStaff) {
    postData.staffId = req.user.id;
  } else {
    postData.customerId = req.user.id;
  }

  if (req.files?.images) {
    postData.images = req.files.images.map(f => f.filename);
  }

  createPost(postData, (err, post) => {
    if (err) return res.status(500).json({ error: 'Lỗi tạo bài viết: ' + err.message });
    res.status(201).json({ message: 'Đăng bài thành công!', post });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  getAllPosts(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách bài viết: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getPostById(req.params.id, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });
    res.json(post);
  });
};

export const update = (req, res) => {
  const { content } = req.body;
  const updateData = {};
  if (content) updateData.content = content;

  getPostById(req.params.id, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

    const isOwner = (post.customerId?._id?.toString() === req.user.id) ||
                    (post.staffId?._id?.toString() === req.user.id);
    if (!isOwner && !req.user.isStaff) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa bài viết này!' });
    }

    updatePostById(req.params.id, updateData, (err2, updated) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Cập nhật bài viết thành công!', post: updated });
    });
  });
};

export const remove = (req, res) => {
  getPostById(req.params.id, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

    const isOwner = (post.customerId?._id?.toString() === req.user.id) ||
                    (post.staffId?._id?.toString() === req.user.id);
    if (!isOwner && !req.user.isStaff) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này!' });
    }

    deletePostById(req.params.id, (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Xóa bài viết thành công!' });
    });
  });
};

export const myPosts = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  getPostsByCustomer(req.user.id, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy bài viết: ' + err.message });
    res.json(result);
  });
};

export const userPosts = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  getPostsByCustomer(req.params.userId, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy bài viết: ' + err.message });
    res.json(result);
  });
};

export const announcements = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  getAnnouncements(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy thông báo: ' + err.message });
    res.json(result);
  });
};

export const adminPosts = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  getMemberPostsForAdmin(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy bài viết: ' + err.message });
    res.json(result);
  });
};

export const hidePost = (req, res) => {
  if (!req.user.isStaff) return res.status(403).json({ error: 'Chỉ nhân viên mới có quyền này!' });
  updatePostById(req.params.id, { status: 'hidden' }, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã ẩn bài viết!', post });
  });
};

export const banPost = (req, res) => {
  if (!req.user.isStaff) return res.status(403).json({ error: 'Chỉ nhân viên mới có quyền này!' });
  updatePostById(req.params.id, { status: 'banned' }, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã cấm bài viết!', post });
  });
};

export const restorePost = (req, res) => {
  if (!req.user.isStaff) return res.status(403).json({ error: 'Chỉ nhân viên mới có quyền này!' });
  updatePostById(req.params.id, { status: 'active' }, (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã khôi phục bài viết!', post });
  });
};
