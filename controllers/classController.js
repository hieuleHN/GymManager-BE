import { getAllClasses } from '../models/classModel.js';

export const getClasses = (req, res) => {
  getAllClasses((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
