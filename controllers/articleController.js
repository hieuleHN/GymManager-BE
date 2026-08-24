import Article, { ARTICLE_CATEGORIES } from '../models/schemas/articleSchema.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

const optionalStaffAuth = (req) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.includes('Bearer ')) return null;
    const token = header.split('Bearer ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && (decoded.isAdmin || decoded.isStaff)) return decoded;
    return null;
  } catch {
    return null;
  }
};

const buildImageValue = (req) => {
  if (req.file) {
    return `/uploads/articles/${req.file.filename}`;
  }
  const imageField = req.body?.image;
  if (typeof imageField === 'string' && imageField.trim()) {
    return imageField.trim();
  }
  return null;
};

export const list = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 100);
    const sort = req.query.sort === 'oldest' ? 1 : -1;

    const filter = {};
    const staff = optionalStaffAuth(req);
    const statusParam = req.query.status;

    if (statusParam && statusParam !== 'all' && ['draft', 'published', 'hidden'].includes(statusParam)) {
      filter.status = statusParam;
    } else if (statusParam === 'all' && staff) {
      filter.status = undefined;
      delete filter.status;
    } else {
      filter.status = 'published';
    }

    if (req.query.category && ARTICLE_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.title = re;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Article.find(filter).sort({ createdAt: sort }).skip(skip).limit(limit).lean(),
      Article.countDocuments(filter)
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const detail = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).lean();
    if (!article) return res.status(404).json({ message: 'Article not found' });

    const staff = optionalStaffAuth(req);
    if (article.status !== 'published' && !staff) {
      return res.status(404).json({ message: 'Article not found' });
    }
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const recordView = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).select('views');
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });
    res.json({ success: true, views: article.views });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const related = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 3, 10);
    const filter = {
      status: 'published',
      _id: { $ne: req.params.id }
    };
    if (req.query.category && ARTICLE_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }
    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { title, content, category, status, authorName, excerpt } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tiêu đề bài viết!' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung bài viết!' });
    }

    const image = buildImageValue(req);
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }

    const finalStatus = ['draft', 'published', 'hidden'].includes(status) ? status : 'draft';

    const article = new Article({
      title: title.trim(),
      content,
      excerpt: excerpt || '',
      category: ARTICLE_CATEGORIES.includes(category) ? category : 'khac',
      status: finalStatus,
      image: image || '',
      authorName: authorName || req.user?.fullName || 'Admin',
      authorId: req.user?.id || null,
      publishedAt: finalStatus === 'published' ? new Date() : null
    });

    const saved = await article.save();
    res.status(201).json({ message: 'Tạo bài viết thành công!', data: saved });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi tạo bài viết!' });
  }
};

export const update = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

    const { title, content, category, status, authorName, excerpt } = req.body;

    const image = buildImageValue(req);
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }

    if (title !== undefined && title.trim()) article.title = title.trim();
    if (content !== undefined) article.content = content;
    if (excerpt !== undefined) article.excerpt = excerpt;
    if (category !== undefined && ARTICLE_CATEGORIES.includes(category)) article.category = category;
    if (authorName !== undefined && authorName) article.authorName = authorName;
    if (image !== null) article.image = image;

    if (status !== undefined && ['draft', 'published', 'hidden'].includes(status)) {
      const wasPublished = article.status === 'published';
      article.status = status;
      if (status === 'published' && !wasPublished && !article.publishedAt) {
        article.publishedAt = new Date();
      }
    }

    await article.save();
    res.json({ message: 'Cập nhật bài viết thành công!', data: article });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi cập nhật bài viết!' });
  }
};

export const publish = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });
    article.status = 'published';
    if (!article.publishedAt) article.publishedAt = new Date();
    await article.save();
    res.json({ message: 'Đăng bài viết thành công!', data: article });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const unpublish = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });
    article.status = 'draft';
    await article.save();
    res.json({ message: 'Đã chuyển về bản nháp!', data: article });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết!' });

    if (article.image && article.image.startsWith('/uploads/articles/')) {
      const filePath = article.image.replace(/^\//, '');
      fs.promises.unlink(filePath).catch(() => {});
    }
    res.json({ message: 'Xóa bài viết thành công!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
