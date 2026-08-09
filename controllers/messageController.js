import {
  createMessage,
  getMessagesBetween,
  getSupportThread,
  getContacts,
  getUnreadCounts,
  markMessagesRead,
  markSupportRead as markSupportThreadRead,
  recallMessage as modelRecallMessage,
  togglePinMessage,
  setMessageReminder
} from '../models/messageModel.js';
import Message from '../models/schemas/messageSchema.js';
import Customer from '../models/schemas/customerSchema.js';
import { emitToUser, emitToSupportStaff } from '../config/socket.js';

const getUserType = (req) => (req.user.isStaff ? 'huan_luyen_vien' : 'hoi_vien');

export const contacts = (req, res) => {
  const userId = req.user.id;
  const userType = getUserType(req);
  const userLocationId = req.user.locationId || null;
  getContacts(userId, userType, userLocationId, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};

export const unread = (req, res) => {
  const userId = req.user.id;
  const userType = getUserType(req);
  const userLocationId = req.user.locationId || null;
  getUnreadCounts(userId, userType, userLocationId, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};

export const history = (req, res) => {
  const { contactId } = req.params;
  const userId = req.user.id;
  const userType = getUserType(req);

  const idHoiVien = userType === 'hoi_vien' ? userId : contactId;
  const idHuanLuyenVien = userType === 'hoi_vien' ? contactId : userId;

  getMessagesBetween(idHoiVien, idHuanLuyenVien, 'truc_tiep', (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(messages);
  });
};

export const supportHistory = (req, res) => {
  const { contactId } = req.params;
  const userId = req.user.id;
  const userType = getUserType(req);

  const idHoiVien = userType === 'hoi_vien' ? userId : contactId;

  getSupportThread(idHoiVien, (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(messages);
  });
};

export const markRead = (req, res) => {
  const { contactId } = req.body;
  if (!contactId) return res.status(400).json({ error: 'Thiếu contactId!' });
  const userId = req.user.id;
  const userType = getUserType(req);
  const userLocationId = req.user.locationId || null;
  markMessagesRead(userId, userType, contactId, userLocationId, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const markSupportRead = (req, res) => {
  const { contactId } = req.body;
  if (!contactId) return res.status(400).json({ error: 'Thiếu contactId!' });
  const userId = req.user.id;
  const userType = getUserType(req);
  const userLocationId = req.user.locationId || null;
  markSupportThreadRead(userId, userType, contactId, userLocationId, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

const emitToThread = (message, event, userType, userId, locationId = null) => {
  const isSupport = message.loai === 'ho_tro';
  if (isSupport) {
    const recipientIsMember = message.nguoi_gui_tin_nhan === 'huan_luyen_vien';
    if (recipientIsMember) {
      emitToUser(message.id_hoi_vien.toString(), event, message);
    } else {
      emitToSupportStaff(message, locationId, event);
    }
    emitToUser(userId.toString(), event, message);
  } else {
    const otherPartyId = userType === 'hoi_vien'
      ? message.id_huan_luyen_vien?.toString()
      : message.id_hoi_vien.toString();
    emitToUser(userId.toString(), event, message);
    if (otherPartyId) emitToUser(otherPartyId, event, message);
  }
};

export const recall = async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId!' });
  const userId = req.user.id;
  const userType = getUserType(req);

  modelRecallMessage(messageId, userId, userType, (err, updated) => {
    if (err) return res.status(400).json({ error: err.message, code: err.code });
    if (!updated) return res.status(404).json({ error: 'Tin nhắn không tồn tại!' });

    emitToThread(updated, 'messageRecalled', userType, userId.toString(), req.user.locationId || null);
    res.json(updated);
  });
};

export const pin = async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId!' });
  const userId = req.user.id;
  const userType = getUserType(req);

  togglePinMessage(messageId, userId, userType, (err, updated) => {
    if (err) return res.status(400).json({ error: err.message, code: err.code });
    if (!updated) return res.status(404).json({ error: 'Tin nhắn không tồn tại!' });

    emitToThread(updated, 'messagePinned', userType, userId.toString(), req.user.locationId || null);
    res.json(updated);
  });
};

export const reminder = async (req, res) => {
  const { messageId, remindAt } = req.body;
  if (!messageId || !remindAt) return res.status(400).json({ error: 'Thiếu messageId hoặc remindAt!' });
  const userId = req.user.id;
  const userType = getUserType(req);

  try {
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Tin nhắn không tồn tại!' });

    const reminderData = {
      messageId,
      id_hoi_vien: msg.id_hoi_vien,
      id_huan_luyen_vien: msg.id_huan_luyen_vien || null,
      loai: msg.loai || 'truc_tiep',
      recipientId: userId,
      recipientRole: userType === 'hoi_vien' ? 'member' : 'staff',
      noi_dung: msg.da_thu_hoi ? '[Tin nhắn đã thu hồi]' : msg.noi_dung,
      remindAt: new Date(remindAt)
    };

    setMessageReminder(reminderData, (err, saved) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(saved);
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const send = (req, res) => {
  const { id_hoi_vien, id_huan_luyen_vien, noi_dung, reply_to, reply_noi_dung, reply_nguoi_gui } = req.body;
  if (!id_hoi_vien || !id_huan_luyen_vien || !noi_dung) {
    return res.status(400).json({ error: 'Thiếu thông tin tin nhắn!' });
  }
  const nguoi_gui_tin_nhan = getUserType(req);
  createMessage({ id_hoi_vien, id_huan_luyen_vien, nguoi_gui_tin_nhan, noi_dung, loai: 'truc_tiep', reply_to, reply_noi_dung, reply_nguoi_gui }, (err, saved) => {
    if (err) return res.status(500).json({ error: err.message });
    const recipientId = nguoi_gui_tin_nhan === 'hoi_vien'
      ? id_huan_luyen_vien.toString()
      : id_hoi_vien.toString();
    emitToUser(recipientId, 'receiveMessage', saved);
    res.status(201).json(saved);
  });
};

export const sendSupport = async (req, res) => {
  const { id_hoi_vien, noi_dung, reply_to, reply_noi_dung, reply_nguoi_gui } = req.body;
  if (!noi_dung) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn!' });
  const userType = getUserType(req);
  const nguoi_gui_tin_nhan = userType;
  const isStaff = userType === 'huan_luyen_vien';
  const idHoiVien = isStaff ? id_hoi_vien : req.user.id;
  const idHuanLuyenVien = isStaff ? req.user.id : null;
  if (!idHoiVien) return res.status(400).json({ error: 'Thiếu thông tin hội viên!' });

  createMessage({ id_hoi_vien: idHoiVien, id_huan_luyen_vien: idHuanLuyenVien, nguoi_gui_tin_nhan, noi_dung, loai: 'ho_tro', reply_to, reply_noi_dung, reply_nguoi_gui }, async (err, saved) => {
    if (err) return res.status(500).json({ error: err.message });
    if (isStaff) {
      emitToUser(idHoiVien.toString(), 'receiveMessage', saved);
    } else {
      let customerLocationId = req.user.locationId || null;
      try {
        const member = await Customer.findById(idHoiVien).select('locationId').lean();
        customerLocationId = member?.locationId || customerLocationId;
      } catch {}
      emitToSupportStaff(saved, customerLocationId);
    }
    res.status(201).json(saved);
  });
};

export const uploadAttachment = (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) {
    return res.status(400).json({ error: req.fileValidationError || 'Chưa có file được tải lên!' });
  }

  const { id_hoi_vien, id_huan_luyen_vien, loai, noi_dung, reply_to, reply_noi_dung, reply_nguoi_gui } = req.body;
  const isSupport = (loai || 'truc_tiep') === 'ho_tro';
  if (!id_hoi_vien) {
    return res.status(400).json({ error: 'Thiếu thông tin tin nhắn!' });
  }
  if (!isSupport && !id_huan_luyen_vien) {
    return res.status(400).json({ error: 'Thiếu thông tin tin nhắn!' });
  }

  const allImages = files.every((f) => f.mimetype.startsWith('image/'));
  const nguoi_gui_tin_nhan = getUserType(req);
  const attachments = files.map((f) => ({
    fileName: f.originalname,
    fileType: f.mimetype,
    fileSize: f.size,
    fileUrl: `/uploads/chat/${f.filename}`
  }));

  const fallbackText = files.length === 1 ? files[0].originalname : `${files.length} ảnh/file`;

  createMessage({
    id_hoi_vien,
    id_huan_luyen_vien: id_huan_luyen_vien || null,
    nguoi_gui_tin_nhan,
    noi_dung: noi_dung || fallbackText,
    loai: loai || 'truc_tiep',
    reply_to: reply_to || null,
    reply_noi_dung: reply_noi_dung || '',
    reply_nguoi_gui: reply_nguoi_gui || '',
    loai_tin_nhan: allImages ? 'image' : 'file',
    attachment: attachments[0] || null,
    attachments
  }, (err, saved) => {
    if (err) return res.status(500).json({ error: err.message });

    if (isSupport) {
      const isStaffSender = nguoi_gui_tin_nhan === 'huan_luyen_vien';
      if (isStaffSender) {
        emitToUser(id_hoi_vien.toString(), 'receiveMessage', saved);
      } else {
        emitToSupportStaff(saved, req.user.locationId || null);
      }
      emitToUser(req.user.id.toString(), 'receiveMessage', saved);
    } else {
      const recipientId = nguoi_gui_tin_nhan === 'hoi_vien'
        ? id_huan_luyen_vien.toString()
        : id_hoi_vien.toString();
      emitToUser(recipientId, 'receiveMessage', saved);
      emitToUser(req.user.id.toString(), 'receiveMessage', saved);
    }

    res.status(201).json(saved);
  });
};
