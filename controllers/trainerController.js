import { getAllTrainers } from '../models/trainerModel.js';

export const getTrainers = (req, res) => {
  getAllTrainers((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
