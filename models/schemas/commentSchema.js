import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true
  },
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Comment', commentSchema);
