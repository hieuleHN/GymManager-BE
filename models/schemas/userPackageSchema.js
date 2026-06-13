import mongoose from 'mongoose';

const userPackageSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  package_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['đang hoạt động', 'còn 10 ngày', 'hết hạn'],
    default: 'đang hoạt động'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('UserPackage', userPackageSchema);
