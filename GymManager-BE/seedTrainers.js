import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymmanager';

async function seedTrainers() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Đã kết nối MongoDB');

    const db = mongoose.connection.db;
    const jobCollection = db.collection('jobs');
    const staffCollection = db.collection('staffs');
    const locationCollection = db.collection('locations');

    let location = await locationCollection.findOne({});
    if (!location) {
      const locResult = await locationCollection.insertOne({
        title: 'GymZone Hà Nội',
        address: '123 Đường Lê Lợi, Hà Nội',
        phone: '0900000001',
        description: 'Chi nhánh chính',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      location = await locationCollection.findOne({ _id: locResult.insertedId });
      console.log('Đã tạo location mẫu');
    }

    let trainerJob = await jobCollection.findOne({ name: 'Huấn luyện viên' });
    if (!trainerJob) {
      const jobResult = await jobCollection.insertOne({
        name: 'Huấn luyện viên',
        salary: 10000000,
        description: 'Huấn luyện thể hình',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      trainerJob = await jobCollection.findOne({ _id: jobResult.insertedId });
      console.log('Đã tạo job Huấn luyện viên');
    }

    const trainers = [
      { fullName: 'Nguyễn Thùy Anh', email: 'thuyanh@gym.com', phone: '0912345601', gender: 'Nữ' },
      { fullName: 'Trần Văn Mạnh', email: 'vanmanh@gym.com', phone: '0912345602', gender: 'Nam' },
      { fullName: 'Lê Minh Châu', email: 'minhchau@gym.com', phone: '0912345603', gender: 'Nữ' },
      { fullName: 'Phạm Quốc Huy', email: 'quochuy@gym.com', phone: '0912345604', gender: 'Nam' },
      { fullName: 'Hoàng Thị Mai', email: 'thimai@gym.com', phone: '0912345605', gender: 'Nữ' },
      { fullName: 'Vũ Đức Thắng', email: 'ducthang@gym.com', phone: '0912345606', gender: 'Nam' }
    ];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('trainer123', salt);

    for (const t of trainers) {
      const existing = await staffCollection.findOne({ email: t.email });
      if (!existing) {
        await staffCollection.insertOne({
          account: t.email.split('@')[0],
          password: hashedPassword,
          fullName: t.fullName,
          email: t.email,
          phone: t.phone,
          gender: t.gender,
          job: trainerJob._id,
          startDate: new Date(),
          address: 'Hà Nội',
          locationId: location._id,
          baseSalary: 10000000,
          bonus: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Đã tạo HLV: ${t.fullName}`);
      } else {
        console.log(`HLV ${t.fullName} đã tồn tại`);
      }
    }

    await mongoose.disconnect();
    console.log('\nSeed HLV hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi seed:', err);
    process.exit(1);
  }
}

seedTrainers();
