import CommunityComment from './schemas/communityCommentSchema.js';
import CommunityPost from './schemas/communityPostSchema.js';

export const createComment = async (data, callback) => {
  try {
    const comment = new CommunityComment(data);
    const saved = await comment.save();
    await CommunityPost.findByIdAndUpdate(data.postId, { $inc: { commentCount: 1 } });
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getCommentsByPost = async (postId, page = 1, limit = 50, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { postId, status: 'active' };
    const [data, total] = await Promise.all([
      CommunityComment.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit),
      CommunityComment.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const deleteComment = async (id, callback) => {
  try {
    const comment = await CommunityComment.findByIdAndDelete(id);
    if (!comment) return callback({ message: 'Không tìm thấy bình luận!' });
    await CommunityPost.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};
