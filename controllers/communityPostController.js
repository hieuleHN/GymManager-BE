import {
  createPost, getAllPosts, getPostById, updatePost, deletePost,
  toggleLike, incrementShare, incrementViews, getPostsByAuthor
} from '../models/communityPostModel.js';
import fs from 'fs';
import path from 'path';

export const create = (req, res) => {
  const { content, type, title } = req.body;
  if (!content) {
    if (req.files) req.files.forEach(f => fs.unlink(path.join('uploads', 'community', f.filename), () => {}));
    return res.status(400).json({ error: 'Nội dung bài viết là bắt buộc!' });
  }

  const images = req.files ? req.files.map(f => f.filename) : [];

  createPost({
    authorId: req.user.id,
    authorModel: req.user.isStaff ? 'Staff' : 'Customer',
    content,
    type: type || 'member',
    title: title || '',
    images
  }, (err, post) => {
    if (err) {
      req.files?.forEach(f => fs.unlink(path.join('uploads', 'community', f.filename), () => {}));
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ message: 'Đăng bài thành công!', post });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { type, status } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  else filter.status = { $ne: 'hidden' };

  getAllPosts(page, limit, filter, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
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
  const { content, title } = req.body;
  const updateData = {};
  if (content) updateData.content = content;
  if (title !== undefined) updateData.title = title;

  updatePost(req.params.id, updateData, (err, post) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Cập nhật bài viết thành công!', post });
  });
};

export const remove = (req, res) => {
  deletePost(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    result.images?.forEach(img => fs.unlink(path.join('uploads', 'community', img), () => {}));
    res.json({ message: 'Xóa bài viết thành công!' });
  });
};

export const like = (req, res) => {
  const userId = req.user.id;
  const userModel = req.user.isStaff ? 'Staff' : 'Customer';
  toggleLike(req.params.id, userId, userModel, (err, post) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Thành công!', likes: post.likes.length, liked: post.likes.some(l => l.userId.toString() === userId) });
  });
};

export const share = (req, res) => {
  incrementShare(req.params.id, (err, post) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Chia sẻ thành công!', shareCount: post.shareCount });
  });
};

export const view = (req, res) => {
  incrementViews(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
};

export const listByAuthor = (req, res) => {
  const { authorId, authorModel } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  getPostsByAuthor(authorId, authorModel, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const hide = (req, res) => {
  updatePost(req.params.id, { status: 'hidden' }, (err, post) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã ẩn bài viết!', post });
  });
};

export const unhide = (req, res) => {
  updatePost(req.params.id, { status: 'active' }, (err, post) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã khôi phục bài viết!', post });
  });
};
