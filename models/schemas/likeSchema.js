import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

likeSchema.index({ postId: 1, customerId: 1 }, { sparse: true });
likeSchema.index({ postId: 1, staffId: 1 }, { sparse: true });

export default mongoose.model('Like', likeSchema);
