import mongoose from 'mongoose';

const communityPostSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  authorType: {
    type: String,
    enum: ['member', 'staff'],
    default: 'member'
  },
  content: {
    type: String,
    required: true
  },
  images: [String],
  video: String,
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  likesCount: {
    type: Number,
    default: 0
  },
  commentsCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'hidden', 'reported', 'banned'],
    default: 'active'
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

communityPostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('CommunityPost', communityPostSchema);
