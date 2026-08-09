import { listKeywords, addKeyword, updateKeyword, deleteKeyword } from '../models/sensitiveKeywordModel.js';

export const getKeywords = (req, res) => {
  listKeywords().then((data) => res.json(data)).catch((err) => res.status(500).json({ error: err.message }));
};

export const createKeyword = (req, res) => {
  const { keyword, level, enabled, note } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Thiếu từ khoá!' });
  }
  addKeyword({ keyword: keyword.trim(), level, enabled, note }, (err, saved) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json(saved);
  });
};

export const editKeyword = (req, res) => {
  const { id } = req.params;
  const { keyword, level, enabled, note } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Thiếu từ khoá!' });
  }
  updateKeyword(id, { keyword: keyword.trim(), level, enabled, note }, (err, updated) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!updated) return res.status(404).json({ error: 'Từ khoá không tồn tại!' });
    res.json(updated);
  });
};

export const removeKeyword = (req, res) => {
  const { id } = req.params;
  deleteKeyword(id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!result) return res.status(404).json({ error: 'Từ khoá không tồn tại!' });
    res.json({ success: true });
  });
};
