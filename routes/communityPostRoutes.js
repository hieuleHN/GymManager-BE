import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import * as PostController from '../controllers/communityPostController.js';
import * as CommentController from '../controllers/commentController.js';
import * as LikeController from '../controllers/likeController.js';
import * as ReportController from '../controllers/reportController.js';
import * as NotificationController from '../controllers/notificationController.js';

const router = express.Router();
const uploadCommunity = uploadDynamic('community');
const handleUpload = (req, res, next) => {
  uploadCommunity.fields([{ name: 'images', maxCount: 10 }])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// Posts
router.get('/posts', authenticateToken, PostController.list);
router.post('/posts', authenticateToken, handleUpload, PostController.create);
router.get('/posts/my', authenticateToken, PostController.myPosts);
router.get('/posts/announcements', authenticateToken, PostController.announcements);
router.get('/posts/admin', authenticateToken, PostController.adminPosts);
router.get('/posts/user/:userId', authenticateToken, PostController.userPosts);
router.get('/posts/:id', authenticateToken, PostController.detail);
router.put('/posts/:id', authenticateToken, PostController.update);
router.delete('/posts/:id', authenticateToken, PostController.remove);
router.patch('/posts/:id/hide', authenticateToken, PostController.hidePost);
router.patch('/posts/:id/ban', authenticateToken, PostController.banPost);
router.patch('/posts/:id/restore', authenticateToken, PostController.restorePost);

// Likes
router.post('/posts/:postId/like', authenticateToken, LikeController.toggle);
router.get('/posts/:postId/like/check', authenticateToken, LikeController.check);
router.get('/posts/:postId/likes', authenticateToken, LikeController.listLikes);

// Comments
router.get('/posts/:postId/comments', authenticateToken, CommentController.listComments);
router.post('/posts/:postId/comments', authenticateToken, CommentController.addComment);
router.delete('/comments/:id', authenticateToken, CommentController.removeComment);

// Reports
router.post('/posts/:postId/report', authenticateToken, ReportController.create);
router.get('/reports', authenticateToken, ReportController.list);
router.get('/reports/pending', authenticateToken, ReportController.pending);
router.put('/reports/:id/resolve', authenticateToken, ReportController.resolve);
router.put('/reports/:id/dismiss', authenticateToken, ReportController.dismiss);

// Notifications
router.get('/notifications', authenticateToken, NotificationController.list);
router.get('/notifications/unread-count', authenticateToken, NotificationController.unreadCount);
router.put('/notifications/:id/read', authenticateToken, NotificationController.read);
router.put('/notifications/read-all', authenticateToken, NotificationController.readAll);

export default router;
