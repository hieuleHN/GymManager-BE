import {
  createNotification,
  getNotificationsByRecipient,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} from '../models/notificationModel.js';

export const create = (req, res) => {
  const { recipientId, recipientRole, title, message, type, relatedBookingId } = req.body;

  if (!recipientId || !recipientRole || !title || !message || !type) {
    return res.status(400).json({ error: 'Thiếu thông tin thông báo!' });
  }

  createNotification({
    recipientId,
    recipientRole,
    title,
    message,
    type,
    relatedBookingId
  }, (err, notification) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json(notification);
  });
};

export const list = (req, res) => {
  const { recipientId, recipientRole } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (!recipientId || !recipientRole) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  getNotificationsByRecipient(recipientId, recipientRole, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const markRead = (req, res) => {
  markAsRead(req.params.id, (err, notification) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã đánh dấu đã đọc', notification });
  });
};

export const markAllRead = (req, res) => {
  const { recipientId, recipientRole } = req.body;

  if (!recipientId || !recipientRole) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  markAllAsRead(recipientId, recipientRole, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
  });
};

export const unreadCount = (req, res) => {
  const { recipientId, recipientRole } = req.query;

  if (!recipientId || !recipientRole) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  getUnreadCount(recipientId, recipientRole, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const remove = (req, res) => {
  deleteNotification(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã xóa thông báo' });
  });
};
