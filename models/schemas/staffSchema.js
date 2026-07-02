import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    enum: ['Nam', 'Nữ', 'Khác'],
    default: 'Nam'
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  address: {
    type: String
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  baseSalary: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

staffSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Staff', staffSchema);