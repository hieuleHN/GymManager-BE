import mongoose from 'mongoose';

const communityCommentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true
  },
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
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active'
  }
}, { timestamps: true });

export default mongoose.model('CommunityComment', communityCommentSchema);
