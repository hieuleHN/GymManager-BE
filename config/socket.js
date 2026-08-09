import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createMessage, recallMessage } from '../models/messageModel.js';
import Customer from '../models/schemas/customerSchema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

let io;
const onlineUsers = new Map();

const SUPPORT_ROLES = ['Lễ tân', 'Quản lý'];

const isSupportStaff = (user) => {
  if (!user || !user.isStaff) return false;
  if (user.isAdmin) return true;
  return SUPPORT_ROLES.includes(user.role);
};

const matchesLocation = (staffLocationId, memberLocationId) => {
  if (!staffLocationId) return true;
  if (!memberLocationId) return false;
  return staffLocationId.toString() === memberLocationId.toString();
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Unauthorized'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    if (userId) onlineUsers.set(userId.toString(), { socketId: socket.id, user: socket.user });

    socket.on('join', (data) => {
      const id = data?.userId || userId;
      if (id) onlineUsers.set(id.toString(), { socketId: socket.id, user: socket.user });
      socket.emit('joined', { ok: true });
    });

    socket.on('checkStatus', (userIds) => {
      const statuses = {};
      (userIds || []).forEach((id) => {
        statuses[id] = onlineUsers.has(id?.toString?.() || id);
      });
      socket.emit('statusResult', statuses);
    });

    socket.on('sendMessage', async (data) => {
      try {
        if (!data || !data.id_hoi_vien || !data.id_huan_luyen_vien || !data.noi_dung) return;
        const saved = await new Promise((resolve, reject) => {
          createMessage({ ...data, loai: 'truc_tiep' }, (err, result) => (err ? reject(err) : resolve(result)));
        });
        const recipientId = data.nguoi_gui_tin_nhan === 'hoi_vien'
          ? data.id_huan_luyen_vien.toString()
          : data.id_hoi_vien.toString();
        emitToUser(recipientId, 'receiveMessage', saved);
        socket.emit('receiveMessage', saved);
      } catch (err) {
        console.error('[Socket] sendMessage error:', err);
      }
    });

    socket.on('sendSupportMessage', async (data) => {
      try {
        if (!data || !data.noi_dung) return;
        const isStaffSender = !!socket.user?.isStaff;
        const idHoiVien = isStaffSender ? data.id_hoi_vien : socket.user?.id;
        const idHuanLuyenVien = isStaffSender ? socket.user?.id : null;
        if (!idHoiVien) return;

        const saved = await new Promise((resolve, reject) => {
          createMessage({
            id_hoi_vien: idHoiVien,
            id_huan_luyen_vien: idHuanLuyenVien,
            nguoi_gui_tin_nhan: isStaffSender ? 'huan_luyen_vien' : 'hoi_vien',
            noi_dung: data.noi_dung,
            loai: 'ho_tro',
            reply_to: data.reply_to || null,
            reply_noi_dung: data.reply_noi_dung || '',
            reply_nguoi_gui: data.reply_nguoi_gui || ''
          }, (err, result) => (err ? reject(err) : resolve(result)));
        });

        if (isStaffSender) {
          emitToUser(idHoiVien.toString(), 'receiveMessage', saved);
          socket.emit('receiveMessage', saved);
        } else {
          const member = await Customer.findById(idHoiVien).select('locationId').lean();
          const memberLocationId = member?.locationId || null;
          emitSupportMessage(saved, memberLocationId);
          socket.emit('receiveMessage', saved);
        }
      } catch (err) {
        console.error('[Socket] sendSupportMessage error:', err);
      }
    });

    socket.on('recallMessage', async (data) => {
      try {
        if (!data || !data.messageId) return;
        const userId = socket.user?.id?.toString();
        const userType = socket.user?.isStaff ? 'huan_luyen_vien' : 'hoi_vien';
        const updated = await new Promise((resolve, reject) => {
          recallMessage(data.messageId, userId, userType, (err, result) => (err ? reject(err) : resolve(result)));
        });
        if (!updated) return;

        const isSupport = updated.loai === 'ho_tro';
        if (isSupport) {
          const recipientIsMember = updated.nguoi_gui_tin_nhan === 'huan_luyen_vien';
          if (recipientIsMember) {
            emitToUser(updated.id_hoi_vien.toString(), 'messageRecalled', updated);
          } else {
            const member = await Customer.findById(updated.id_hoi_vien).select('locationId').lean();
            emitSupportMessage(updated, member?.locationId || null, 'messageRecalled');
          }
        } else {
          const otherPartyId = userType === 'hoi_vien'
            ? updated.id_huan_luyen_vien?.toString()
            : updated.id_hoi_vien.toString();
          if (otherPartyId) emitToUser(otherPartyId, 'messageRecalled', updated);
        }
        emitToUser(userId, 'messageRecalled', updated);
      } catch (err) {
        console.error('[Socket] recallMessage error:', err);
      }
    });

    socket.on('disconnect', () => {
      if (userId && onlineUsers.get(userId.toString())?.socketId === socket.id) {
        onlineUsers.delete(userId.toString());
      }
    });
  });

  return io;
};

export const getIO = () => io;

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  for (const entry of onlineUsers.values()) {
    if (entry.user?.id?.toString() === userId.toString()) {
      io.to(entry.socketId).emit(event, payload);
    }
  }
};

export const emitSupportMessage = (payload, memberLocationId, event = 'receiveMessage') => {
  if (!io) return;
  for (const entry of onlineUsers.values()) {
    if (!isSupportStaff(entry.user)) continue;
    if (!matchesLocation(entry.user.locationId || null, memberLocationId)) continue;
    io.to(entry.socketId).emit(event, payload);
  }
};

export const emitToSupportStaff = (payload, memberLocationId, event = 'receiveMessage') => {
  emitSupportMessage(payload, memberLocationId, event);
};
