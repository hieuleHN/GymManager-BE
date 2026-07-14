import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import db from './config/db.js';
import dotenv from 'dotenv';
import locationRoutes from './routes/locationRoutes.js';
import packageRoutes from './routes/pakageRoutes.js';
import { initPackageStatusScheduler } from './services/cronService.js';

import productRoutes from './routes/productRoutes.js';
import equipmentRoutes from './routes/equipmentRoutes.js';
import disciplineRoutes from './routes/disciplineRoutes.js';
import productReturnRoutes from './routes/productReturnRoutes.js';

import customerRoutes from './routes/customerRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import lockerRoutes from './routes/lockerRoutes.js';
import userPackageRoutes from './routes/userPackageRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { saveMessage } from './models/messageModel.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/locations', locationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/packages', packageRoutes);

app.use('/products', productRoutes);
app.use('/api/products', productRoutes);
app.use('/equipments', equipmentRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/disciplines', disciplineRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/product-returns', productReturnRoutes);

app.use('/api/customers', customerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/lockers', lockerRoutes);
app.use('/api/user-packages', userPackageRoutes);
app.use('/api/messages', messageRoutes);

initPackageStatusScheduler();

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);
  let currentUserId = null;
  
  socket.on('join', (userId) => {
    socket.join(userId);
    currentUserId = userId;
    onlineUsers.set(userId, true);
    io.emit('userStatus', { userId, status: 'online' });
  });

  socket.on('checkStatus', (userIds) => {
    if (!Array.isArray(userIds)) return;
    const statuses = {};
    userIds.forEach(id => {
      statuses[id] = onlineUsers.has(id);
    });
    socket.emit('statusResult', statuses);
  });

  socket.on('sendMessage', (data) => {
    saveMessage(data, (err, saved) => {
      if (!err) {
        io.to(data.id_hoi_vien).emit('receiveMessage', saved);
        io.to(data.id_huan_luyen_vien).emit('receiveMessage', saved);
      } else {
        console.error('Error saving message:', err);
      }
    });
  });

  socket.on('disconnect', () => {
    if (currentUserId) {
      // In a robust app, we'd check if other sockets for this user are still open
      onlineUsers.delete(currentUserId);
      io.emit('userStatus', { userId: currentUserId, status: 'offline' });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
