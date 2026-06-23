import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Staff from './models/schemas/staffSchema.js';
import Customer from './models/schemas/customerSchema.js';

dotenv.config();
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymmanager';

async function seedChatUsers() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Đã kết nối MongoDB');

    const db = mongoose.connection.db;
    const jobCollection = db.collection('jobs');
    const trainerJob = await jobCollection.findOne({ name: 'Huấn luyện viên' });

    if (!trainerJob) {
      console.log('Chưa có công việc Huấn luyện viên. Hãy chạy "npm run seed" trước.');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHashed = await bcrypt.hash('123456', salt);

    // Tạo 2 Huấn luyện viên
    const hlv1 = new Staff({
      account: 'hlv1',
      password: passwordHashed,
      fullName: 'Nguyễn Văn HLV Một',
      email: 'hlv1@gym.com',
      phone: '0901111111',
      gender: 'Nam',
      job: trainerJob._id,
      startDate: new Date(),
      status: 'active'
    });

    const hlv2 = new Staff({
      account: 'hlv2',
      password: passwordHashed,
      fullName: 'Trần Thị HLV Hai',
      email: 'hlv2@gym.com',
      phone: '0902222222',
      gender: 'Nữ',
      job: trainerJob._id,
      startDate: new Date(),
      status: 'active'
    });

    // Tạo 2 Hội viên
    const hv1 = new Customer({
      account: 'hoivien1',
      password: passwordHashed,
      fullName: 'Lê Văn Hội Viên 1',
      phone: '0903333333',
      gender: 'Nam',
      status: 'approved'
    });

    const hv2 = new Customer({
      account: 'hoivien2',
      password: passwordHashed,
      fullName: 'Phạm Thị Hội Viên 2',
      phone: '0904444444',
      gender: 'Nữ',
      status: 'approved'
    });

    // Xóa user cũ nếu trùng
    await Staff.deleteMany({ account: { $in: ['hlv1', 'hlv2'] } });
    await Customer.deleteMany({ account: { $in: ['hoivien1', 'hoivien2'] } });

    await Staff.insertMany([hlv1, hlv2]);
    await Customer.insertMany([hv1, hv2]);

    console.log('Đã tạo thành công 2 HLV (hlv1, hlv2) và 2 Hội viên (hoivien1, hoivien2)');
    console.log('Mật khẩu chung cho tất cả là: 123456');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Lỗi seed chat users:', err);
    process.exit(1);
  }
}

seedChatUsers();
