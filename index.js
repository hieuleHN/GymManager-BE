import express from 'express';
import db from './config/db.js';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import packageRoutes from './routes/pakageRoutes.js';
import userPackageRoutes from './routes/userPackageRouters.js';
import { initPackageStatusScheduler } from './services/cronService.js';

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/roles', roleRoutes);
app.use('/locations', locationRoutes);
app.use('/services', serviceRoutes);
app.use('/packages', packageRoutes);
app.use('/user-packages', userPackageRoutes);

initPackageStatusScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
