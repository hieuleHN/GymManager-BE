import Message from './schemas/messageSchema.js';
import Customer from './schemas/customerSchema.js';
import Staff from './schemas/staffSchema.js';
import Location from './schemas/locationSchema.js';
import MessageReminder from './schemas/messageReminderSchema.js';
import { getActiveKeywords, scanForKeywords } from './sensitiveKeywordModel.js';

export const createMessage = async (data, callback) => {
  try {
    const textToScan = `${data.noi_dung || ''} ${(data.attachments || []).map((a) => a.fileName).join(' ')}`;
    const keywords = await getActiveKeywords();
    const hits = scanForKeywords(textToScan, keywords);
    const message = new Message({
      id_hoi_vien: data.id_hoi_vien,
      id_huan_luyen_vien: data.id_huan_luyen_vien || null,
      nguoi_gui_tin_nhan: data.nguoi_gui_tin_nhan,
      loai: data.loai || 'truc_tiep',
      noi_dung: data.noi_dung,
      reply_to: data.reply_to || null,
      reply_noi_dung: data.reply_noi_dung || '',
      reply_nguoi_gui: data.reply_nguoi_gui || '',
      loai_tin_nhan: data.loai_tin_nhan || 'text',
      attachment: data.attachment || undefined,
      attachments: data.attachments || undefined,
      flagged: hits.length > 0,
      flag_reasons: hits.slice(0, 10),
      flag_status: hits.length > 0 ? 'pending' : 'pending'
    });
    const saved = await message.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const recallMessage = async (messageId, userId, userType, callback) => {
  try {
    if (!messageId) return callback(new Error('Thiếu messageId!'));
    const message = await Message.findById(messageId);
    if (!message) return callback(new Error('Tin nhắn không tồn tại!'));

    const isOwner = userType === 'hoi_vien'
      ? message.nguoi_gui_tin_nhan === 'hoi_vien' && message.id_hoi_vien.toString() === userId.toString()
      : message.nguoi_gui_tin_nhan === 'huan_luyen_vien' && message.id_huan_luyen_vien?.toString() === userId.toString();
    if (!isOwner) return callback(new Error('Bạn không có quyền thu hồi tin nhắn này!'));

    const ageHours = (Date.now() - new Date(message.thoi_gian_gui).getTime()) / 3600000;
    if (ageHours > 24) {
      const err = new Error('Thu hồi thất bại vì tin nhắn đã quá 24 giờ kể từ khi gửi!');
      err.code = 'RECALL_EXPIRED';
      return callback(err);
    }

    const updated = await Message.findByIdAndUpdate(messageId, { da_thu_hoi: true }, { new: true });
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const togglePinMessage = async (messageId, userId, userType, callback) => {
  try {
    if (!messageId) return callback(new Error('Thiếu messageId!'));
    const message = await Message.findById(messageId);
    if (!message) return callback(new Error('Tin nhắn không tồn tại!'));

    const isParticipant = userType === 'hoi_vien'
      ? message.id_hoi_vien.toString() === userId.toString()
      : message.id_huan_luyen_vien?.toString() === userId.toString() || message.nguoi_gui_tin_nhan === 'huan_luyen_vien';
    if (!isParticipant) return callback(new Error('Bạn không có quyền ghim tin nhắn này!'));

    if (!message.is_pinned) {
      const threadQuery = { loai: message.loai };
      if (message.loai === 'ho_tro') {
        threadQuery.id_hoi_vien = message.id_hoi_vien;
      } else {
        threadQuery.id_hoi_vien = message.id_hoi_vien;
        threadQuery.id_huan_luyen_vien = message.id_huan_luyen_vien || null;
      }
      const pinnedCount = await Message.countDocuments({ ...threadQuery, is_pinned: true });
      if (pinnedCount >= 3) {
        const err = new Error('Tối đa 3 tin nhắn được ghim cho một cuộc trò chuyện!');
        err.code = 'PIN_LIMIT';
        return callback(err);
      }
    }

    const updated = await Message.findByIdAndUpdate(
      messageId,
      { is_pinned: !message.is_pinned },
      { new: true }
    );
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const setMessageReminder = async (data, callback) => {
  try {
    const reminder = new MessageReminder({
      id_hoi_vien: data.id_hoi_vien,
      id_huan_luyen_vien: data.id_huan_luyen_vien || null,
      loai: data.loai || 'truc_tiep',
      messageId: data.messageId,
      recipientId: data.recipientId,
      recipientRole: data.recipientRole,
      noi_dung: data.noi_dung,
      remindAt: data.remindAt
    });
    const saved = await reminder.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getDueReminders = async () => {
  return MessageReminder.find({ fired: false, remindAt: { $lte: new Date() } });
};

export const markReminderFired = async (id) => {
  return MessageReminder.findByIdAndUpdate(id, { fired: true }, { new: true });
};

export const getMessagesBetween = async (idHoiVien, idHuanLuyenVien, loai = 'truc_tiep', callback) => {
  try {
    const query = { id_hoi_vien: idHoiVien, loai };
    if (idHuanLuyenVien) query.id_huan_luyen_vien = idHuanLuyenVien;
    const messages = await Message.find(query).sort({ thoi_gian_gui: 1 });
    callback(null, messages);
  } catch (err) {
    callback(err);
  }
};

export const getSupportThread = async (idHoiVien, callback) => {
  try {
    const messages = await Message.find({ id_hoi_vien: idHoiVien, loai: 'ho_tro' })
      .sort({ thoi_gian_gui: 1 });
    callback(null, messages);
  } catch (err) {
    callback(err);
  }
};

export const getSupportThreadForStaff = async (idHoiVien, idHuanLuyenVien, callback) => {
  try {
    const messages = await Message.find({ id_hoi_vien: idHoiVien, loai: 'ho_tro' })
      .sort({ thoi_gian_gui: 1 });
    callback(null, messages);
  } catch (err) {
    callback(err);
  }
};

export const getContacts = async (userId, userType, userLocationId, callback) => {
  try {
    let messages;
    if (userType === 'huan_luyen_vien') {
      messages = await Message.find({ id_huan_luyen_vien: userId, loai: 'truc_tiep' }).sort({ thoi_gian_gui: -1 });
    } else {
      messages = await Message.find({ id_hoi_vien: userId, loai: 'truc_tiep' }).sort({ thoi_gian_gui: -1 });
    }

    const contactMap = new Map();
    for (const msg of messages) {
      const contactId = userType === 'huan_luyen_vien'
        ? msg.id_hoi_vien.toString()
        : msg.id_huan_luyen_vien.toString();
      if (!contactMap.has(contactId)) {
        contactMap.set(contactId, {
          contactId,
          lastMessage: msg.noi_dung,
          lastTime: msg.thoi_gian_gui,
          unread: 0,
          isIncomingUnread: userType === 'huan_luyen_vien'
            ? msg.nguoi_gui_tin_nhan === 'hoi_vien' && !msg.da_doc
            : msg.nguoi_gui_tin_nhan === 'huan_luyen_vien' && !msg.da_doc
        });
      } else {
        const entry = contactMap.get(contactId);
        const isUnread = userType === 'huan_luyen_vien'
          ? msg.nguoi_gui_tin_nhan === 'hoi_vien' && !msg.da_doc
          : msg.nguoi_gui_tin_nhan === 'huan_luyen_vien' && !msg.da_doc;
        if (isUnread) entry.unread += 1;
      }
    }

    const contactIds = [...contactMap.keys()];
    const contacts = [];
    for (const contactId of contactIds) {
      let info;
      if (userType === 'huan_luyen_vien') {
        info = await Customer.findById(contactId).select('fullName account avatar phone');
      } else {
        info = await Staff.findById(contactId).select('fullName account avatar').populate('job', 'name');
      }
      const entry = contactMap.get(contactId);
      contacts.push({
        _id: contactId,
        fullName: info?.fullName || info?.account || 'Người dùng',
        account: info?.account || '',
        avatar: info?.avatar || '',
        role: userType === 'huan_luyen_vien'
          ? 'Hội viên'
          : info?.job?.name || 'HLV',
        lastMessage: entry.lastMessage,
        timestamp: entry.lastTime,
        unread: entry.unread,
        isSupport: false
      });
    }

    if (userType === 'huan_luyen_vien') {
      const supportContacts = await getSupportContactsForStaff(userId, userLocationId);
      contacts.push(...supportContacts);
    } else {
      const supportContact = await getSupportContactForMember(userId);
      if (supportContact) contacts.push(supportContact);
    }

    contacts.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    callback(null, contacts);
  } catch (err) {
    callback(err);
  }
};

const getSupportContactForMember = async (memberId) => {
  const messages = await Message.find({ id_hoi_vien: memberId, loai: 'ho_tro' }).sort({ thoi_gian_gui: -1 });
  if (messages.length === 0) return null;

  const claimingStaffId = messages.find((m) => m.id_huan_luyen_vien)?.id_huan_luyen_vien;
  let fullName = 'Hỗ trợ khách hàng';
  let avatar = '';
  let role = 'Hỗ trợ';
  if (claimingStaffId) {
    const staff = await Staff.findById(claimingStaffId).select('fullName account avatar').populate('job', 'name');
    if (staff) {
      fullName = staff.fullName || staff.account;
      avatar = staff.avatar || '';
      role = staff.job?.name || 'Hỗ trợ';
    }
  }

  let unread = 0;
  for (const m of messages) {
    if (m.nguoi_gui_tin_nhan === 'huan_luyen_vien' && !m.da_doc) unread += 1;
  }

  return {
    _id: 'support',
    fullName,
    account: 'Hỗ trợ khách hàng',
    avatar,
    role,
    lastMessage: messages[0].noi_dung,
    timestamp: messages[0].thoi_gian_gui,
    unread,
    isSupport: true
  };
};

const getSupportContactsForStaff = async (staffId, staffLocationId) => {
  const messages = await Message.find({ loai: 'ho_tro' }).sort({ thoi_gian_gui: -1 });

  const contactMap = new Map();
  for (const msg of messages) {
    const memberId = msg.id_hoi_vien.toString();
    const isUnclaimed = !msg.id_huan_luyen_vien;
    const isMine = msg.id_huan_luyen_vien && msg.id_huan_luyen_vien.toString() === staffId.toString();
    if (!isUnclaimed && !isMine) continue;

    const isUnread = msg.nguoi_gui_tin_nhan === 'hoi_vien' && !msg.da_doc;
    if (!contactMap.has(memberId)) {
      contactMap.set(memberId, {
        memberId,
        lastMessage: msg.noi_dung,
        lastTime: msg.thoi_gian_gui,
        unread: isUnread ? 1 : 0
      });
    } else {
      const entry = contactMap.get(memberId);
      if (isUnread) entry.unread += 1;
      if (new Date(msg.thoi_gian_gui) > new Date(entry.lastTime)) {
        entry.lastMessage = msg.noi_dung;
        entry.lastTime = msg.thoi_gian_gui;
      }
    }
  }

  const contacts = [];
  for (const memberId of contactMap.keys()) {
    const member = await Customer.findById(memberId).select('fullName account avatar locationId');
    if (!member) continue;
    if (staffLocationId && member.locationId && member.locationId.toString() !== staffLocationId.toString()) continue;

    const entry = contactMap.get(memberId);
    contacts.push({
      _id: memberId,
      fullName: member.fullName || member.account || 'Hội viên',
      account: member.account || '',
      avatar: member.avatar || '',
      role: 'Hỗ trợ',
      lastMessage: entry.lastMessage,
      timestamp: entry.lastTime,
      unread: entry.unread,
      isSupport: true
    });
  }

  return contacts;
};

export const getUnreadCounts = async (userId, userType, userLocationId, callback) => {
  try {
    let query;
    if (userType === 'huan_luyen_vien') {
      query = { id_huan_luyen_vien: userId, nguoi_gui_tin_nhan: 'hoi_vien', da_doc: false, loai: 'truc_tiep' };
    } else {
      query = { id_hoi_vien: userId, nguoi_gui_tin_nhan: 'huan_luyen_vien', da_doc: false, loai: 'truc_tiep' };
    }
    const messages = await Message.find(query).select('id_hoi_vien id_huan_luyen_vien');
    const byContact = {};
    let total = 0;
    for (const msg of messages) {
      const contactId = userType === 'huan_luyen_vien'
        ? msg.id_hoi_vien.toString()
        : msg.id_huan_luyen_vien.toString();
      byContact[contactId] = (byContact[contactId] || 0) + 1;
      total += 1;
    }

    if (userType === 'huan_luyen_vien') {
      const supportMsgs = await Message.find({ loai: 'ho_tro', nguoi_gui_tin_nhan: 'hoi_vien', da_doc: false })
        .select('id_hoi_vien id_huan_luyen_vien');
      for (const msg of supportMsgs) {
        const isUnclaimed = !msg.id_huan_luyen_vien;
        const isMine = msg.id_huan_luyen_vien && msg.id_huan_luyen_vien.toString() === userId.toString();
        if (!isUnclaimed && !isMine) continue;
        const memberId = msg.id_hoi_vien.toString();
        const member = await Customer.findById(memberId).select('locationId');
        if (userLocationId && member?.locationId && member.locationId.toString() !== userLocationId.toString()) continue;
        byContact[memberId] = (byContact[memberId] || 0) + 1;
        total += 1;
      }
    } else {
      const supportUnread = await Message.countDocuments({
        id_hoi_vien: userId,
        loai: 'ho_tro',
        nguoi_gui_tin_nhan: 'huan_luyen_vien',
        da_doc: false
      });
      if (supportUnread > 0) {
        byContact['support'] = (byContact['support'] || 0) + supportUnread;
        total += supportUnread;
      }
    }

    callback(null, { total, byContact });
  } catch (err) {
    callback(err);
  }
};

export const markMessagesRead = async (userId, userType, contactId, userLocationId, callback) => {
  try {
    let query;
    if (userType === 'huan_luyen_vien') {
      query = { id_huan_luyen_vien: userId, id_hoi_vien: contactId, nguoi_gui_tin_nhan: 'hoi_vien', da_doc: false, loai: 'truc_tiep' };
    } else {
      query = { id_hoi_vien: userId, id_huan_luyen_vien: contactId, nguoi_gui_tin_nhan: 'huan_luyen_vien', da_doc: false, loai: 'truc_tiep' };
    }
    await Message.updateMany(query, { da_doc: true });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const markSupportRead = async (userId, userType, contactId, userLocationId, callback) => {
  try {
    let query;
    if (userType === 'huan_luyen_vien') {
      query = { id_hoi_vien: contactId, loai: 'ho_tro', nguoi_gui_tin_nhan: 'hoi_vien', da_doc: false };
      const supportMsgs = await Message.find(query).select('id_huan_luyen_vien');
      const applicable = supportMsgs.filter((m) =>
        !m.id_huan_luyen_vien || m.id_huan_luyen_vien.toString() === userId.toString()
      );
      const ids = applicable.map((m) => m._id);
      if (ids.length > 0) await Message.updateMany({ _id: { $in: ids } }, { da_doc: true });
    } else {
      query = { id_hoi_vien: userId, loai: 'ho_tro', nguoi_gui_tin_nhan: 'huan_luyen_vien', da_doc: false };
      await Message.updateMany(query, { da_doc: true });
    }
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const getMonitorConversations = async (filter, callback) => {
  try {
    const { locationId, loai, flagStatus, level, keyword, staffId, memberId, fromDate, toDate } = filter || {};

    const match = {};
    if (loai && loai !== 'all') match.loai = loai;
    if (flagStatus && flagStatus !== 'all') {
      if (flagStatus === 'flagged') match.flagged = true;
      else match.flag_status = flagStatus;
    }
    if (level && level !== 'all') {
      match.flagged = true;
      match.flag_reasons = { $elemMatch: { level } };
    }
    if (fromDate || toDate) {
      match.thoi_gian_gui = {};
      if (fromDate) match.thoi_gian_gui.$gte = new Date(fromDate);
      if (toDate) match.thoi_gian_gui.$lte = new Date(toDate);
    }

    const memberIds = new Set();
    const staffIds = new Set();
    if (keyword) {
      const kwRegex = new RegExp(keyword, 'i');
      const [members, staffs] = await Promise.all([
        Customer.find({ $or: [{ fullName: kwRegex }, { account: kwRegex }] }).select('_id').lean(),
        Staff.find({ $or: [{ fullName: kwRegex }, { account: kwRegex }] }).select('_id').lean()
      ]);
      members.forEach((m) => memberIds.add(m._id.toString()));
      staffs.forEach((s) => staffIds.add(s._id.toString()));
    }
    if (staffId) staffIds.add(staffId);
    if (memberId) memberIds.add(memberId);

    const idOr = [];
    if (memberIds.size > 0) idOr.push({ id_hoi_vien: { $in: [...memberIds] } });
    if (staffIds.size > 0) idOr.push({ id_huan_luyen_vien: { $in: [...staffIds] } });
    if (idOr.length > 0) match.$or = idOr;

    const messages = await Message.find(match).sort({ thoi_gian_gui: -1 });

    const threadKey = (m) => (m.loai === 'ho_tro'
      ? `${m.id_hoi_vien.toString()}_ho_tro`
      : `${m.id_hoi_vien.toString()}_${m.id_huan_luyen_vien?.toString() || 'null'}_${m.loai}`);
    const threadMap = new Map();
    for (const m of messages) {
      const key = threadKey(m);
      if (!threadMap.has(key)) {
        threadMap.set(key, {
          key,
          id_hoi_vien: m.id_hoi_vien,
          id_huan_luyen_vien: m.id_huan_luyen_vien || null,
          loai: m.loai,
          lastMessage: m.noi_dung,
          lastTime: m.thoi_gian_gui,
          lastSender: m.nguoi_gui_tin_nhan,
          flaggedCount: m.flagged ? 1 : 0,
          totalCount: 1,
          flagReasons: m.flagged ? (m.flag_reasons || []).map((r) => r.keyword) : []
        });
      } else {
        const entry = threadMap.get(key);
        entry.totalCount += 1;
        if (m.id_huan_luyen_vien && m.loai === 'ho_tro') {
          entry.id_huan_luyen_vien = m.id_huan_luyen_vien;
        }
        if (m.flagged) {
          entry.flaggedCount += 1;
          (m.flag_reasons || []).forEach((r) => {
            if (!entry.flagReasons.includes(r.keyword)) entry.flagReasons.push(r.keyword);
          });
        }
        if (new Date(m.thoi_gian_gui) > new Date(entry.lastTime)) {
          entry.lastMessage = m.noi_dung;
          entry.lastTime = m.thoi_gian_gui;
          entry.lastSender = m.nguoi_gui_tin_nhan;
        }
      }
    }

    const threads = [...threadMap.values()];
    if (locationId && locationId !== 'all') {
      const members = await Customer.find({ locationId }).select('_id').lean();
      const allowedIds = new Set(members.map((m) => m._id.toString()));
      threads.forEach((t) => { t._matchedLocation = allowedIds.has(t.id_hoi_vien.toString()); });
    }

    const results = [];
    for (const t of threads) {
      const member = await Customer.findById(t.id_hoi_vien).select('fullName account avatar locationId').lean();
      let staff = null;
      if (t.id_huan_luyen_vien) {
        staff = await Staff.findById(t.id_huan_luyen_vien).select('fullName account avatar job').populate('job', 'name').lean();
      }
      results.push({
        key: t.key,
        id_hoi_vien: t.id_hoi_vien,
        id_huan_luyen_vien: t.id_huan_luyen_vien,
        loai: t.loai,
        memberName: member?.fullName || member?.account || 'Hội viên',
        memberAccount: member?.account || '',
        memberAvatar: member?.avatar || '',
        memberLocationId: member?.locationId || null,
        staffName: staff ? (staff.fullName || staff.account) : null,
        staffRole: staff?.job?.name || null,
        lastMessage: t.lastMessage,
        lastTime: t.lastTime,
        lastSender: t.lastSender,
        flaggedCount: t.flaggedCount,
        totalCount: t.totalCount,
        flagReasons: t.flagReasons
      });
    }

    let filtered = results;
    if (locationId && locationId !== 'all') {
      filtered = results.filter((r) => r.memberLocationId?.toString() === locationId.toString());
    }
    filtered.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    callback(null, filtered);
  } catch (err) {
    callback(err);
  }
};

export const getMonitorTranscript = async (idHoiVien, idHuanLuyenVien, loai, callback) => {
  try {
    const query = { id_hoi_vien: idHoiVien, loai };
    if (loai === 'truc_tiep' && idHuanLuyenVien) query.id_huan_luyen_vien = idHuanLuyenVien;
    const messages = await Message.find(query).sort({ thoi_gian_gui: 1 }).lean();
    callback(null, messages);
  } catch (err) {
    callback(err);
  }
};

export const setMessageFlagStatus = async (messageId, status, callback) => {
  try {
    const updated = await Message.findByIdAndUpdate(
      messageId,
      { flag_status: status },
      { new: true }
    );
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const adminDeleteMessage = async (messageId, callback) => {
  try {
    const result = await Message.findByIdAndDelete(messageId);
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getMonitorStats = async (filter, callback) => {
  try {
    const { locationId, loai, fromDate, toDate } = filter || {};
    const match = {};
    if (loai && loai !== 'all') match.loai = loai;
    if (fromDate || toDate) {
      match.thoi_gian_gui = {};
      if (fromDate) match.thoi_gian_gui.$gte = new Date(fromDate);
      if (toDate) match.thoi_gian_gui.$lte = new Date(toDate);
    }

    let query = Message.find(match);
    const allMessages = await query.lean();

    const flagged = allMessages.filter((m) => m.flagged);
    const byLevelCounts = { high: 0, low: 0 };
    for (const m of flagged) {
      const levels = new Set((m.flag_reasons || []).map((r) => r.level));
      if (levels.has('high')) byLevelCounts.high += 1;
      else if (levels.has('low')) byLevelCounts.low += 1;
    }
    const conversationKeys = new Set(
      allMessages.map((m) => (m.loai === 'ho_tro'
        ? `${m.id_hoi_vien.toString()}_ho_tro`
        : `${m.id_hoi_vien.toString()}_${m.id_huan_luyen_vien?.toString() || 'null'}_${m.loai}`))
    );
    const byLocation = {};
    const byStaff = {};
    const byDay = {};

    const memberIds = [...new Set(allMessages.map((m) => m.id_hoi_vien.toString()))];
    const staffIds = [...new Set(allMessages.filter((m) => m.id_huan_luyen_vien).map((m) => m.id_huan_luyen_vien.toString()))];
    const members = await Customer.find({ _id: { $in: memberIds } }).select('locationId').lean();
    const staffs = await Staff.find({ _id: { $in: staffIds } }).select('fullName account').lean();
    const memberLoc = {};
    members.forEach((m) => { memberLoc[m._id.toString()] = m.locationId?.toString() || 'unknown'; });
    const staffName = {};
    staffs.forEach((s) => { staffName[s._id.toString()] = s.fullName || s.account; });

    for (const m of allMessages) {
      const loc = m.loai === 'ho_tro' ? memberLoc[m.id_hoi_vien.toString()] : memberLoc[m.id_hoi_vien.toString()];
      const day = new Date(m.thoi_gian_gui).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      if (loc && loc !== 'unknown') byLocation[loc] = (byLocation[loc] || 0) + 1;
      if (m.id_huan_luyen_vien) {
        const sid = m.id_huan_luyen_vien.toString();
        byStaff[sid] = byStaff[sid] || { name: staffName[sid] || 'HLV', count: 0 };
        byStaff[sid].count += 1;
      }
    }

    const flaggedByLocation = {};
    for (const m of flagged) {
      const loc = memberLoc[m.id_hoi_vien.toString()];
      if (loc && loc !== 'unknown') flaggedByLocation[loc] = (flaggedByLocation[loc] || 0) + 1;
    }

    const locationNames = await Location.find({ _id: { $in: Object.keys(byLocation).concat(Object.keys(flaggedByLocation)) } }).select('address').lean();
    const locNameMap = {};
    locationNames.forEach((l) => { locNameMap[l._id.toString()] = l.address; });

    callback(null, {
      totalConversations: conversationKeys.size,
      totalMessages: allMessages.length,
      flaggedMessages: flagged.length,
      pendingFlags: flagged.filter((m) => m.flag_status !== 'resolved' && m.flag_status !== 'ignored').length,
      highFlags: byLevelCounts.high,
      lowFlags: byLevelCounts.low,
      byLocation: Object.entries(byLocation).map(([id, count]) => ({ locationId: id, name: locNameMap[id] || 'Cơ sở', count })),
      flaggedByLocation: Object.entries(flaggedByLocation).map(([id, count]) => ({ locationId: id, name: locNameMap[id] || 'Cơ sở', count })),
      byStaff: Object.values(byStaff).sort((a, b) => b.count - a.count).slice(0, 10),
      byDay: Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, count]) => ({ day, count }))
    });
  } catch (err) {
    callback(err);
  }
};
