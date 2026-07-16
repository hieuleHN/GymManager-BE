import Notification from './schemas/notificationSchema.js';

export const createNotification = async (data, callback) => {
  try {
    const notification = new Notification({
      recipientId: data.recipientId,
      recipientRole: data.recipientRole,
      title: data.title,
      message: data.message,
      type: data.type,
      relatedBookingId: data.relatedBookingId,
      relatedPostId: data.relatedPostId
    });
    const saved = await notification.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getNotificationsByRecipient = async (recipientId, recipientRole, page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { recipientId, recipientRole };
    const [data, total] = await Promise.all([
      Notification.find(query)
        .populate('relatedBookingId')
        .populate('relatedPostId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const markAsRead = async (id, callback) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );
    if (!notification) return callback({ message: 'Không tìm thấy thông báo!' });
    callback(null, notification);
  } catch (err) {
    callback(err);
  }
};

export const markAllAsRead = async (recipientId, recipientRole, callback) => {
  try {
    await Notification.updateMany(
      { recipientId, recipientRole, read: false },
      { read: true }
    );
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const getUnreadCount = async (recipientId, recipientRole, callback) => {
  try {
    const count = await Notification.countDocuments({
      recipientId,
      recipientRole,
      read: false
    });
    callback(null, { count });
  } catch (err) {
    callback(err);
  }
};

export const deleteNotification = async (id, callback) => {
  try {
    const notification = await Notification.findByIdAndDelete(id);
    if (!notification) return callback({ message: 'Không tìm thấy thông báo!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};
