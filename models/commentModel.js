import Comment from './schemas/commentSchema.js';
import CommunityPost from './schemas/communityPostSchema.js';

export const createComment = async (data, callback) => {
  try {
    const comment = new Comment(data);
    const saved = await comment.save();
    await CommunityPost.findByIdAndUpdate(data.postId, { $inc: { commentsCount: 1 } });
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getCommentsByPost = async (postId, page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Comment.find({ postId })
        .populate('customerId', 'fullName account avatar')
        .populate('staffId', 'fullName account avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({ postId })
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const deleteCommentById = async (id, callback) => {
  try {
    const comment = await Comment.findByIdAndDelete(id);
    if (!comment) return callback({ message: 'Không tìm thấy bình luận!' });
    await CommunityPost.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -1 } });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};
