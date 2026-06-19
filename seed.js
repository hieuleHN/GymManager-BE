import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymmanager';

async function seed() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Đã kết nối MongoDB');

    const db = mongoose.connection.db;

    // Tạo công việc Admin
    const jobCollection = db.collection('jobs');
    const existingJob = await jobCollection.findOne({ name: 'Admin' });
    let adminJobId;
    if (!existingJob) {
      const result = await jobCollection.insertOne({
        name: 'Admin',
        salary: 20000000,
        description: 'Quản trị hệ thống',
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      adminJobId = result.insertedId;
      console.log('Đã tạo công việc Admin');
    } else {
      adminJobId = existingJob._id;
      console.log('Công việc Admin đã tồn tại');
    }

    // Tạo công việc Lễ tân
    const receptionistJob = await jobCollection.findOne({ name: 'Lễ tân' });
    if (!receptionistJob) {
      await jobCollection.insertOne({
        name: 'Lễ tân',
        salary: 7000000,
        description: 'Tiếp đón khách hàng',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Đã tạo công việc Lễ tân');
    }

    // Tạo công việc Huấn luyện viên
    const trainerJob = await jobCollection.findOne({ name: 'Huấn luyện viên' });
    if (!trainerJob) {
      await jobCollection.insertOne({
        name: 'Huấn luyện viên',
        salary: 10000000,
        description: 'Huấn luyện thể hình',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Đã tạo công việc Huấn luyện viên');
    }

    // Tạo công việc Kế toán
    const accountantJob = await jobCollection.findOne({ name: 'Kế toán' });
    if (!accountantJob) {
      await jobCollection.insertOne({
        name: 'Kế toán',
        salary: 9000000,
        description: 'Quản lý tài chính',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Đã tạo công việc Kế toán');
    }

    // Tạo tài khoản nhân viên Admin
    const staffCollection = db.collection('staffs');
    const existingStaff = await staffCollection.findOne({ account: 'admin' });
    if (!existingStaff) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await staffCollection.insertOne({
        account: 'admin',
        password: hashedPassword,
        fullName: 'Admin',
        email: 'admin@gym.com',
        phone: '0900000000',
        gender: 'Nam',
        job: adminJobId,
        startDate: new Date(),
        address: 'Hệ thống',
        baseSalary: 20000000,
        bonus: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Đã tạo tài khoản admin');
    } else {
      console.log('Tài khoản admin đã tồn tại');
    }

    console.log('\n=== THÔNG TIN ĐĂNG NHẬP ===');
    console.log('Nhân viên:');
    console.log('  Tài khoản: admin');
    console.log('  Mật khẩu: admin123');
    console.log('===========================\n');

    await mongoose.disconnect();
    console.log('Seed hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi seed:', err);
    process.exit(1);
  }
}

seed();
