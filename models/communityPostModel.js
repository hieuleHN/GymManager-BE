import CommunityPost from './schemas/communityPostSchema.js';
import mongoose from 'mongoose';

export const createPost = async (data, callback) => {
  try {
    const post = new CommunityPost(data);
    const saved = await post.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getAllPosts = async (page = 1, limit = 20, filter = {}, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { ...filter };
    const [data, total] = await Promise.all([
      CommunityPost.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityPost.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getPostById = async (id, callback) => {
  try {
    const post = await CommunityPost.findById(id);
    if (!post) return callback(null, null);
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const updatePost = async (id, data, callback) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(id, { ...data }, { new: true });
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const deletePost = async (id, callback) => {
  try {
    const post = await CommunityPost.findByIdAndDelete(id);
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, { success: true, images: post.images || [] });
  } catch (err) {
    callback(err);
  }
};

export const toggleLike = async (postId, userId, userModel, callback) => {
  try {
    const post = await CommunityPost.findById(postId);
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });

    const existingIndex = post.likes.findIndex(
      l => l.userId.toString() === userId && l.userModel === userModel
    );

    if (existingIndex > -1) {
      post.likes.splice(existingIndex, 1);
    } else {
      post.likes.push({ userId, userModel });
    }

    await post.save();
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const incrementShare = async (id, callback) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(
      id,
      { $inc: { shareCount: 1 } },
      { new: true }
    );
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const incrementViews = async (id, callback) => {
  try {
    await CommunityPost.findByIdAndUpdate(id, { $inc: { views: 1 } });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const getPostsByAuthor = async (authorId, authorModel, page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { authorId: new mongoose.Types.ObjectId(authorId), authorModel, status: 'active' };
    const [data, total] = await Promise.all([
      CommunityPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      CommunityPost.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};
