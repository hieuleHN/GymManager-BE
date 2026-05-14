import { getAllPayments } from '../models/paymentModel.js';

export const getPayments = (req, res) => {
  getAllPayments((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
