import mongoose from 'mongoose';

const staffAttendanceSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StaffShift',
    default: null
  },
  date: {
    type: Date,
    required: true
  },
  checkInTime: {
    type: Date,
    default: null
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  status: {
    type: String,
    enum: ['checked-in', 'checked-out', 'absent', 'late'],
    default: 'checked-in'
  },
  minutesLate: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
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

staffAttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

staffAttendanceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('StaffAttendance', staffAttendanceSchema);
