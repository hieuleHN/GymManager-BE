import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: String,
  gender: {
    type: String,
    enum: ['Nam', 'Nữ', 'Khác'],
    default: 'Nam'
  },
  phone: String,
  email: String,
  address: String,
  idNumber: String,
  idCardFront: String,
  idCardBack: String,
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  registerDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'pending_approval', 'approved', 'rejected', 'locked'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  approvedAt: Date,
  rejectionReason: String,
  balance: {
    type: Number,
    default: 0
  },
  infoFilledAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

customerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Customer', customerSchema);
