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
  fullName: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    enum: ['Nam', 'Nữ', 'Khác'],
    default: 'Nam'
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  idNumber: {
    type: String
  },
  idCardFront: {
    type: String
  },
  idCardBack: {
    type: String
  },
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
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
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

<<<<<<< HEAD
customerSchema.pre('save', function (next) {
=======
customerSchema.pre('save', function(next) {
>>>>>>> 8d5dd86e396b7ed3fe4ab92b312d01e2f4b52d8d
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Customer', customerSchema);