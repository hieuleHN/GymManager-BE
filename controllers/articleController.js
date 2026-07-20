import {
  createArticle, getAllArticles, getArticleById,
  updateArticle, deleteArticle, incrementArticleViews,
  getRelatedArticles
} from '../models/articleModel.js';
import { createNotification } from '../models/notificationModel.js';
import { getAllCustomerIds } from '../models/customerModel.js';

export const create = (req, res) => {
  const { title, content, category, authorName, status } = req.body;
  const image = req.file ? `/uploads/articles/${req.file.filename}` : (req.body.image || '');
  if (!title || !content) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc!' });
  }

  const isPublished = status === 'published';
  const articleData = {
    title,
    content,
    image,
    category: category || 'tin-tuc',
    authorId: req.user?.id || '000000000000000000000000',
    authorModel: req.user?.isStaff ? 'Staff' : 'Customer',
    authorName: authorName || req.user?.name || '',
    status: isPublished ? 'published' : 'draft',
    publishedAt: isPublished ? new Date() : null
  };

  createArticle(articleData, (err, article) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (isPublished) {
      getAllCustomerIds((err, customerIds) => {
        if (!err && customerIds?.length > 0) {
          customerIds.forEach(cId => {
            createNotification({
              recipientId: cId,
              recipientRole: 'member',
              title: 'Bài viết mới',
              message: article.title,
              type: 'new_article',
              relatedArticleId: article._id
            }, () => {});
          });
        }
      });
    }
    
    res.status(201).json({ message: 'Tạo bài viết thành công!', article });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const { category, status, sort } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (status && status !== 'all') filter.status = status;
  else if (!status) filter.status = 'published';

  const sortBy = ['newest', 'most_viewed', 'popular'].includes(sort) ? sort : 'popular';

  getAllArticles(page, limit, filter, sortBy, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getArticleById(req.params.id, (err, article) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });
    res.json(article);
  });
};

export const update = (req, res) => {
  const { title, content, category, status, authorName } = req.body;
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (req.file) updateData.image = `/uploads/articles/${req.file.filename}`;
  else if (req.body.image !== undefined) updateData.image = req.body.image;
  if (category !== undefined) updateData.category = category;
  if (status !== undefined) updateData.status = status;
  if (authorName !== undefined) updateData.authorName = authorName;

  if (status === 'published' && !updateData.publishedAt) {
    updateData.publishedAt = new Date();
  }

  updateArticle(req.params.id, updateData, (err, article) => {
    if (err) return res.status(400).json({ error: err.message });
    
    if (status === 'published') {
      getAllCustomerIds((err, customerIds) => {
        if (!err && customerIds?.length > 0) {
          customerIds.forEach(cId => {
            createNotification({
              recipientId: cId,
              recipientRole: 'member',
              title: 'Bài viết mới',
              message: article.title,
              type: 'new_article',
              relatedArticleId: article._id
            }, () => {});
          });
        }
      });
    }
    
    res.json({ message: 'Cập nhật bài viết thành công!', article });
  });
};

export const remove = (req, res) => {
  deleteArticle(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa bài viết thành công!' });
  });
};

export const view = (req, res) => {
  incrementArticleViews(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
};

export const related = (req, res) => {
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: 'Thiếu category' });
  getRelatedArticles(req.params.id, category, parseInt(req.query.limit) || 4, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};

export const publish = (req, res) => {
  updateArticle(req.params.id, { status: 'published', publishedAt: new Date() }, (err, article) => {
    if (err) return res.status(400).json({ error: err.message });
    
    getAllCustomerIds((err, customerIds) => {
      if (!err && customerIds?.length > 0) {
        const title = 'Bài viết mới';
        const message = `${article.title}`;
        customerIds.forEach(cId => {
          createNotification({
            recipientId: cId,
            recipientRole: 'member',
            title,
            message,
            type: 'new_article',
            relatedArticleId: article._id
          }, () => {});
        });
      }
    });
    
    res.json({ message: 'Đã đăng bài viết!', article });
  });
};

export const unpublish = (req, res) => {
  updateArticle(req.params.id, { status: 'hidden' }, (err, article) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã ẩn bài viết!', article });
  });
};
