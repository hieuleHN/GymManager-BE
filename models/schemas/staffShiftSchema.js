import mongoose from 'mongoose';

const staffShiftSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  shift: {
    type: String,
    enum: ['morning-noon', 'afternoon-evening'],
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  notes: {
    type: String,
    default: ''
  },
  assignedBy: {
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

staffShiftSchema.index({ staffId: 1, date: 1, shift: 1 }, { unique: true });

staffShiftSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('StaffShift', staffShiftSchema);
