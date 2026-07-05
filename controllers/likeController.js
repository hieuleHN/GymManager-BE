import { toggleLike, checkLiked, getLikesByPost } from '../models/likeModel.js';

export const toggle = (req, res) => {
  const { postId } = req.params;
  const userIdField = req.user.isStaff
    ? { staffId: req.user.id, authorType: 'staff' }
    : { customerId: req.user.id, authorType: 'member' };

  toggleLike(postId, userIdField, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi thao tác: ' + err.message });
    res.json(result);
  });
};

export const check = (req, res) => {
  const { postId } = req.params;
  const userIdField = req.user.isStaff
    ? { staffId: req.user.id }
    : { customerId: req.user.id };

  checkLiked(postId, userIdField, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const listLikes = (req, res) => {
  getLikesByPost(req.params.postId, (err, likes) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(likes);
  });
};
