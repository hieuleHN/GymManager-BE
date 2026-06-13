import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymmanager';

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🎯 MongoDB được kết nối thành công!');

    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      // Xóa index cũ username_1 trong các collection (nếu còn)
      const cleanIndexes = async (collectionName) => {
        const col = collections.find(c => c.name === collectionName);
        if (col) {
          const indexes = await db.collection(collectionName).indexes();
          for (const idx of indexes) {
            if (idx.name && idx.name.endsWith('_1') && idx.name !== 'account_1' && idx.name !== '_id_') {
              try {
                await db.collection(collectionName).dropIndex(idx.name);
                console.log(`🗑️ Đã xóa index cũ ${idx.name} trong ${collectionName}`);
              } catch {}
            }
          }
        }
      };

      await cleanIndexes('staffs');
      await cleanIndexes('customers');
      await cleanIndexes('users');
    } catch (idxErr) {
      console.log('⚠️ Không thể dọn index:', idxErr.message);
    }
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  }
};

connectDB();

export default mongoose;