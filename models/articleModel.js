import Article from './schemas/articleSchema.js';

export const createArticle = async (data, callback) => {
  try {
    const article = new Article(data);
    const saved = await article.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getAllArticles = async (page = 1, limit = 12, filter = {}, sort = 'newest', callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { ...filter };

    let sortObj = { publishedAt: -1, createdAt: -1 };
    if (sort === 'most_viewed') sortObj = { views: -1, publishedAt: -1, createdAt: -1 };
    else if (sort === 'popular') sortObj = { views: -1, publishedAt: -1, createdAt: -1 };

    const [data, total] = await Promise.all([
      Article.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Article.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getArticleById = async (id, callback) => {
  try {
    const article = await Article.findById(id);
    if (!article) return callback(null, null);
    callback(null, article);
  } catch (err) {
    callback(err);
  }
};

export const updateArticle = async (id, data, callback) => {
  try {
    const article = await Article.findByIdAndUpdate(id, { ...data }, { new: true });
    if (!article) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, article);
  } catch (err) {
    callback(err);
  }
};

export const deleteArticle = async (id, callback) => {
  try {
    const article = await Article.findByIdAndDelete(id);
    if (!article) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const incrementArticleViews = async (id, callback) => {
  try {
    await Article.findByIdAndUpdate(id, { $inc: { views: 1 } });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const getRelatedArticles = async (articleId, category, limit = 4, callback) => {
  try {
    const data = await Article.find({
      _id: { $ne: articleId },
      category,
      status: 'published'
    })
      .sort({ publishedAt: -1 })
      .limit(limit);
    callback(null, data);
  } catch (err) {
    callback(err);
  }
};
