import Like from './schemas/likeSchema.js';
import CommunityPost from './schemas/communityPostSchema.js';

export const toggleLike = async (postId, userIdField, callback) => {
  try {
    const existing = await Like.findOne({ postId, ...userIdField });
    if (existing) {
      await Like.findByIdAndDelete(existing._id);
      await CommunityPost.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
      return callback(null, { liked: false });
    }
    const like = new Like({ postId, ...userIdField });
    await like.save();
    await CommunityPost.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });
    callback(null, { liked: true });
  } catch (err) {
    callback(err);
  }
};

export const checkLiked = async (postId, userIdField, callback) => {
  try {
    const existing = await Like.findOne({ postId, ...userIdField });
    callback(null, { liked: !!existing });
  } catch (err) {
    callback(err);
  }
};

export const getLikesByPost = async (postId, callback) => {
  try {
    const likes = await Like.find({ postId })
      .populate('customerId', 'fullName account avatar')
      .populate('staffId', 'fullName account avatar');
    callback(null, likes);
  } catch (err) {
    callback(err);
  }
};
