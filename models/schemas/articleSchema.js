import mongoose from 'mongoose';

const ARTICLE_CATEGORIES = ['tin-tuc', 'meo-tap', 'dinh-duong', 'su-kien', 'khac'];
const ARTICLE_STATUSES = ['draft', 'published', 'hidden'];

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  excerpt: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ARTICLE_CATEGORIES,
    default: 'tin-tuc'
  },
  authorName: {
    type: String,
    default: 'Admin'
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  status: {
    type: String,
    enum: ARTICLE_STATUSES,
    default: 'draft'
  },
  views: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

articleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

articleSchema.index({ status: 1, category: 1, createdAt: -1 });

export default mongoose.model('Article', articleSchema);
export { ARTICLE_CATEGORIES, ARTICLE_STATUSES };
