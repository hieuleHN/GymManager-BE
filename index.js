import express from 'express';
import cors from 'cors';
import db from './config/db.js';
import dotenv from 'dotenv';
import locationRoutes from './routes/locationRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
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
import bookingRoutes from './routes/bookingRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import checkInRoutes from './routes/checkInRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import reportRoutes from './routes/reportRoutes.js';


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
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/checkin', checkInRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);


initPackageStatusScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
