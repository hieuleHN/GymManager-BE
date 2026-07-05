import CommunityPost from './schemas/communityPostSchema.js';

export const createPost = async (data, callback) => {
  try {
    const post = new CommunityPost(data);
    const saved = await post.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getAllPosts = async (page = 1, limit = 10, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CommunityPost.find({ status: { $nin: ['banned', 'hidden'] } })
        .populate('customerId', 'fullName account avatar')
        .populate('staffId', 'fullName account avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityPost.countDocuments({ status: { $nin: ['banned', 'hidden'] } })
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getPostById = async (id, callback) => {
  try {
    const post = await CommunityPost.findById(id)
      .populate('customerId', 'fullName account avatar')
      .populate('staffId', 'fullName account avatar');
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const getPostsByCustomer = async (customerId, page = 1, limit = 10, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CommunityPost.find({ customerId, status: { $nin: ['banned','hidden'] } })
        .populate('customerId', 'fullName account avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityPost.countDocuments({ customerId, status: { $nin: ['banned', 'hidden'] } })
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updatePostById = async (id, data, callback) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, post);
  } catch (err) {
    callback(err);
  }
};

export const deletePostById = async (id, callback) => {
  try {
    const post = await CommunityPost.findByIdAndDelete(id);
    if (!post) return callback({ message: 'Không tìm thấy bài viết!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const getAnnouncements = async (page = 1, limit = 10, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CommunityPost.find({ isAnnouncement: true })
        .populate('staffId', 'fullName account avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityPost.countDocuments({ isAnnouncement: true })
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getMemberPostsForAdmin = async (page = 1, limit = 10, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { isAnnouncement: { $ne: true }, status: { $in: ['active', 'reported', 'hidden'] } };
    const [data, total] = await Promise.all([
      CommunityPost.find(query)
        .populate('customerId', 'fullName account avatar')
        .populate('staffId', 'fullName account avatar')
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
