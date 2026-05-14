import { getAllMembers, addMember } from '../models/memberModel.js';

export const getMembers = (req, res) => {
  getAllMembers((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const createMember = (req, res) => {
  const { name, email, membershipType } = req.body;
  addMember(name, email, membershipType, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Member added', id: results.insertId });
  });
};
