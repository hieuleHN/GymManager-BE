import mongoose from 'mongoose';

const salaryHistorySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  baseSalary: {
    type: Number,
    required: true
  },
  bonus: {
    type: Number,
    default: 0
  },
  totalSalary: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  note: {
    type: String
  }
});

export default mongoose.model('SalaryHistory', salaryHistorySchema);