import Review from './schemas/reviewSchema.js';
import Staff from './schemas/staffSchema.js';

export const createReview = async (data, callback) => {
  try {
    const existing = await Review.findOne({ customerId: data.customerId, trainerId: data.trainerId });
    if (existing) {
      existing.rating = data.rating;
      existing.comment = data.comment || '';
      existing.createdAt = new Date();
      const saved = await existing.save();
      await updateTrainerRating(data.trainerId);
      callback(null, saved);
      return;
    }
    const review = new Review(data);
    const saved = await review.save();
    await updateTrainerRating(data.trainerId);
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getReviewsByTrainer = async (trainerId, callback) => {
  try {
    const reviews = await Review.find({ trainerId })
      .populate('customerId', 'fullName avatar')
      .sort({ createdAt: -1 });
    callback(null, reviews);
  } catch (err) {
    callback(err);
  }
};

export const getReviewsByCustomer = async (customerId, callback) => {
  try {
    const reviews = await Review.find({ customerId })
      .populate('trainerId', 'fullName')
      .sort({ createdAt: -1 });
    callback(null, reviews);
  } catch (err) {
    callback(err);
  }
};

export const getReviewStats = async (trainerId, callback) => {
  try {
    const stats = await Review.aggregate([
      { $match: { trainerId: require('mongoose').Types.ObjectId.createFromHexString(trainerId) } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    callback(null, stats.length > 0 ? { average: stats[0].average, count: stats[0].count } : { average: 0, count: 0 });
  } catch (err) {
    callback(err);
  }
};

const updateTrainerRating = async (trainerId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { trainerId: require('mongoose').Types.ObjectId.createFromHexString(trainerId.toString()) } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = stats.length > 0 ? Math.round(stats[0].average * 10) / 10 : 0;
    const cnt = stats.length > 0 ? stats[0].count : 0;
    await Staff.findByIdAndUpdate(trainerId, { rating: avg, totalReviews: cnt });
  } catch (e) {
    console.error('Update rating error:', e);
  }
};
