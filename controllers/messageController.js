import { getMessagesBetween, markAsRead, getUnreadCount } from '../models/messageModel.js';
import Customer from '../models/schemas/customerSchema.js';
import Staff from '../models/schemas/staffSchema.js';

// lấy lịch sử tin nhắn giữa hội viên và huấn luyện viên
export const getHistory = (req, res) => {
  const { contactId } = req.params;
  const userId = req.user.id;
  const isStaff = req.user.isStaff;

  const id_hoi_vien = isStaff ? contactId : userId;
  const id_huan_luyen_vien = isStaff ? userId : contactId;

  getMessagesBetween(id_hoi_vien, id_huan_luyen_vien, (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(messages);
  });
};

// đánh dấu tin nhắn là đã đọc
export const markRead = (req, res) => {
  const { contactId } = req.body;
  const userId = req.user.id;
  const isStaff = req.user.isStaff;

  const id_hoi_vien = isStaff ? contactId : userId;
  const id_huan_luyen_vien = isStaff ? userId : contactId;
  const receiverType = isStaff ? 'huan_luyen_vien' : 'hoi_vien';

  markAsRead(id_hoi_vien, id_huan_luyen_vien, receiverType, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

// lấy số tin nhắn chưa đọc của hội viên hoặc huấn luyện viên
export const getUnread = (req, res) => {
  const userId = req.user.id;
  const userType = req.user.isStaff ? 'huan_luyen_vien' : 'hoi_vien';

  getUnreadCount(userId, userType, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

// lấy danh sách các liên hệ (hội viên hoặc huấn luyện viên)
export const getContacts = async (req, res) => {
  try {
    const isStaff = req.user.isStaff;
    if (isStaff) {
      // Return list of customers
      const customers = await Customer.find({ status: { $ne: 'locked' } }, 'fullName account idCardFront');
      res.json(customers);
    } else {
      // Return list of trainers. Assuming job name contains "Huấn luyện viên" or "Trainer"
      // Wait, let's just return all staff who are not admin.
      const trainers = await Staff.find({ status: 'active' }, 'fullName account')
        .populate({
          path: 'job',
          match: { isAdmin: { $ne: true } },
          select: 'name isAdmin'
        });

      const filteredTrainers = trainers.filter(t => t.job !== null);
      res.json(filteredTrainers);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
