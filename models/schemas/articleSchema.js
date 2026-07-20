import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['tin-tuc', 'meo-tap', 'dinh-duong', 'su-kien', 'khac'],
    default: 'tin-tuc'
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'authorModel'
  },
  authorModel: {
    type: String,
    required: true,
    enum: ['Staff', 'Customer']
  },
  authorName: {
    type: String,
    default: ''
  },
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'hidden'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('Article', articleSchema);
