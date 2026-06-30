import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  baseSalary: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  totalSalary: {
    type: Number,
    default: 0
  },
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
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

salarySchema.pre('save', function(next) {
  this.totalSalary = this.baseSalary + this.bonus;
  this.updatedAt = new Date();
  next();
});

salarySchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('Salary', salarySchema);