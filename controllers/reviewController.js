import { createReview, getReviewsByTrainer, getReviewStats, getReviewsByCustomer } from '../models/reviewModel.js';

export const create = (req, res) => {
  const { trainerId, rating, comment } = req.body;
  if (!trainerId || !rating) {
    return res.status(400).json({ error: 'Thiếu thông tin đánh giá!' });
  }
  createReview({ customerId: req.user.id, trainerId, rating, comment }, (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Đánh giá thành công!', review });
  });
};

export const listByTrainer = (req, res) => {
  const { trainerId } = req.params;
  getReviewsByTrainer(trainerId, (err, reviews) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(reviews);
  });
};

export const stats = (req, res) => {
  const { trainerId } = req.params;
  getReviewStats(trainerId, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const listByCustomer = (req, res) => {
  const { customerId } = req.params;
  getReviewsByCustomer(customerId, (err, reviews) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(reviews);
  });
};
