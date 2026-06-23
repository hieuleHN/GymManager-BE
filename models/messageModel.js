import mongoose from 'mongoose';
import Message from './schemas/messageSchema.js';

// Lưu tin nhắn
export const saveMessage = async (data, callback) => {
  try {
    const msg = new Message(data);
    const saved = await msg.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

// lấy tin nhắn giữa 1 hội viên và 1 huấn luyện viên
export const getMessagesBetween = async (id_hoi_vien, id_huan_luyen_vien, callback) => {
  try {
    const messages = await Message.find({
      id_hoi_vien,
      id_huan_luyen_vien
    }).sort({ thoi_gian_gui: 1 });
    callback(null, messages);
  } catch (err) {
    callback(err);
  }
};

// đánh dấu tin nhắn là đã đọc
export const markAsRead = async (id_hoi_vien, id_huan_luyen_vien, receiverType, callback) => {
  try {
    // If receiver (người nhận) is hoi_vien, mark messages sent by huan_luyen_vien as read.
    // If receiver (người nhận) is huan_luyen_vien, mark messages sent by hoi_vien as read.
    const senderTypeToUpdate = receiverType === 'hoi_vien' ? 'huan_luyen_vien' : 'hoi_vien';

    await Message.updateMany(
      {
        id_hoi_vien,
        id_huan_luyen_vien,
        nguoi_gui_tin_nhan: senderTypeToUpdate,
        da_doc: false
      },
      { $set: { da_doc: true } }
    );
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

// lấy số tin nhắn chưa đọc của hội viên hoặc huấn luyện viên
export const getUnreadCount = async (userId, userType, callback) => {
  try {
    const filter = {
      da_doc: false,
      nguoi_gui_tin_nhan: userType === 'hoi_vien' ? 'huan_luyen_vien' : 'hoi_vien'
    };

    if (userType === 'hoi_vien') {
      filter.id_hoi_vien = new mongoose.Types.ObjectId(userId);
    } else {
      filter.id_huan_luyen_vien = new mongoose.Types.ObjectId(userId);
    }

    // Group by sender to get unread count per contact
    const aggregateQuery = [
      { $match: filter },
      {
        $group: {
          _id: userType === 'hoi_vien' ? '$id_huan_luyen_vien' : '$id_hoi_vien',
          count: { $sum: 1 }
        }
      }
    ];

    const unreadCounts = await Message.aggregate(aggregateQuery);

    const total = unreadCounts.reduce((sum, item) => sum + item.count, 0);
    const byContact = unreadCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    callback(null, { total, byContact });
  } catch (err) {
    callback(err);
  }
};
