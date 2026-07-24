import mongoose from 'mongoose';

const communityPostSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'authorModel'
  },
  authorModel: {
    type: String,
    required: true,
    enum: ['Customer', 'Staff']
  },
  type: {
    type: String,
    enum: ['member', 'announcement'],
    default: 'member'
  },
  title: String,
  content: {
    type: String,
    required: true
  },
  images: [String],
  video: String,
  likes: [{
    userId: { type: mongoose.Schema.Types.ObjectId },
    userModel: { type: String, enum: ['Customer', 'Staff'] }
  }],
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'hidden', 'reported'],
    default: 'active'
  }
}, { timestamps: true });

export default mongoose.model('CommunityPost', communityPostSchema);
