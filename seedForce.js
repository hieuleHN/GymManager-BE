import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymmanager';

async function seedForce() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Đã kết nối MongoDB');

    const db = mongoose.connection.db;
    const jobCollection = db.collection('jobs');
    const staffCollection = db.collection('staffs');
    const locationCollection = db.collection('locations');

    // Xóa ALL staff
    await staffCollection.deleteMany({});
    console.log('Đã xóa tất cả staff');

    // Xóa ALL jobs rồi tạo lại
    await jobCollection.deleteMany({});
    console.log('Đã xóa tất cả jobs');

    const jobData = [
      { name: 'Admin', salary: 20000000, description: 'Quản trị hệ thống', isAdmin: true },
      { name: 'Gym & Bodybuilding', salary: 12000000, description: 'Huấn luyện thể hình, xây dựng cơ bắp', isAdmin: false },
      { name: 'Yoga & Pilates', salary: 10000000, description: 'Yoga, Pilates, cân bằng thân-tâm', isAdmin: false },
      { name: 'Boxing & Kickfit', salary: 11000000, description: 'Boxing, Kickfit, võ thuật ứng dụng', isAdmin: false },
      { name: 'Cardio & HIIT', salary: 10000000, description: 'Cardio, HIIT, đốt mỡ giảm cân', isAdmin: false },
      { name: 'CrossFit & Functional', salary: 11000000, description: 'CrossFit, tập luyện chức năng', isAdmin: false }
    ];

    const jobIds = {};
    for (const j of jobData) {
      const result = await jobCollection.insertOne({
        name: j.name, salary: j.salary, description: j.description,
        isAdmin: j.isAdmin, createdAt: new Date(), updatedAt: new Date()
      });
      jobIds[j.name] = result.insertedId;
      console.log(`Tạo job: ${j.name}`);
    }

    let location = await locationCollection.findOne({});
    if (!location) {
      const locResult = await locationCollection.insertOne({
        title: 'ZenFitness', address: '123 Đường Lê Lợi',
        phone: '0900000001', description: 'Chi nhánh chính',
        status: 'active', createdAt: new Date(), updatedAt: new Date()
      });
      location = await locationCollection.findOne({ _id: locResult.insertedId });
    }

    const salt = await bcrypt.genSalt(10);

    // Admin
    const adminPass = await bcrypt.hash('admin123', salt);
    await staffCollection.insertOne({
      account: 'admin', password: adminPass, fullName: 'Admin',
      email: 'admin@gym.com', phone: '0900000000', gender: 'Nam',
      job: jobIds['Admin'], startDate: new Date(), address: 'Hệ thống',
      locationId: location._id, baseSalary: 20000000, bonus: 0, status: 'active',
      avatar: '', description: '', specialties: [], rating: 5, totalReviews: 0, experience: '',
      createdAt: new Date(), updatedAt: new Date()
    });
    console.log('Tạo admin');

    // HLV
    const trainerPass = await bcrypt.hash('trainer123', salt);
    const trainers = [
      {
        fullName: 'Nguyễn Thùy Anh', email: 'thuyanh@gym.com', phone: '0912345601', gender: 'Nữ',
        job: 'Yoga & Pilates',
        avatar: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=400',
        description: 'Huấn luyện viên Yoga được chứng nhận với 8 năm kinh nghiệm. Chuyên về Yoga phục hồi, Pilates và thiền định.',
        specialties: ['Yoga', 'Pilates', 'Thiền', 'Flexibility'], rating: 4.9, totalReviews: 124, experience: '8 năm kinh nghiệm'
      },
      {
        fullName: 'Trần Văn Mạnh', email: 'vanmanh@gym.com', phone: '0912345602', gender: 'Nam',
        job: 'Gym & Bodybuilding',
        avatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fe?auto=format&fit=crop&q=80&w=400',
        description: 'Cựu vận động viên thể hình quốc gia. Chuyên về xây dựng cơ bắp, tăng cường sức mạnh.',
        specialties: ['Bodybuilding', 'Powerlifting', 'Strength'], rating: 4.8, totalReviews: 98, experience: '10 năm kinh nghiệm'
      },
      {
        fullName: 'Lê Minh Châu', email: 'minhchau@gym.com', phone: '0912345603', gender: 'Nữ',
        job: 'Boxing & Kickfit',
        avatar: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=400',
        description: 'Võ sĩ chuyên nghiệp chuyển sang huấn luyện. Chuyên về Boxing, Kickfit và tự vệ.',
        specialties: ['Boxing', 'Kickfit', 'Self-defense'], rating: 4.9, totalReviews: 156, experience: '6 năm kinh nghiệm'
      },
      {
        fullName: 'Phạm Quốc Huy', email: 'quochuy@gym.com', phone: '0912345604', gender: 'Nam',
        job: 'CrossFit & Functional',
        avatar: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400',
        description: 'Chuyên gia CrossFit Level 2. Chuyên về tập luyện chức năng và thể lực toàn diện.',
        specialties: ['CrossFit', 'Functional', 'HIIT'], rating: 4.7, totalReviews: 87, experience: '5 năm kinh nghiệm'
      },
      {
        fullName: 'Hoàng Thị Mai', email: 'thimai@gym.com', phone: '0912345605', gender: 'Nữ',
        job: 'Cardio & HIIT',
        avatar: 'https://images.unsplash.com/photo-1548690312-e3b507d17a4d?auto=format&fit=crop&q=80&w=400',
        description: 'Chuyên gia Cardio & HIIT. Chuyên về đốt mỡ, giảm cân và cải thiện sức khỏe tim mạch.',
        specialties: ['Cardio', 'HIIT', 'Fat burn'], rating: 4.8, totalReviews: 112, experience: '4 năm kinh nghiệm'
      },
      {
        fullName: 'Vũ Đức Thắng', email: 'ducthang@gym.com', phone: '0912345606', gender: 'Nam',
        job: 'Gym & Bodybuilding',
        avatar: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400',
        description: 'Chuyên gia tăng cường sức mạnh và thể hình. Phương pháp tập luyện khoa học, an toàn.',
        specialties: ['Strength', 'Bodybuilding', 'Nutrition'], rating: 4.9, totalReviews: 201, experience: '7 năm kinh nghiệm'
      }
    ];

    for (const t of trainers) {
      await staffCollection.insertOne({
        account: t.email.split('@')[0], password: trainerPass,
        fullName: t.fullName, email: t.email, phone: t.phone, gender: t.gender,
        job: jobIds[t.job], startDate: new Date(), address: 'Hà Nội',
        locationId: location._id, avatar: t.avatar, description: t.description,
        specialties: t.specialties, rating: t.rating, totalReviews: t.totalReviews,
        experience: t.experience, baseSalary: 10000000, bonus: 0, status: 'active',
        createdAt: new Date(), updatedAt: new Date()
      });
      console.log(`Tạo HLV: ${t.fullName} - ${t.job}`);
    }

    await mongoose.disconnect();
    console.log('\nDONE! Restart backend server.');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi:', err);
    process.exit(1);
  }
}

seedForce();
