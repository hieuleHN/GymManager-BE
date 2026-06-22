import mongoose from 'mongoose';

const userPackageSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  package_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  duration_months: {
    type: Number,
    default: 1
  },
  total_price: {
    type: Number,
    default: 0
  },
  signature: {
    type: String,
    default: ''
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
    enum: ['đang hoạt động', 'còn 10 ngày', 'hết hạn', 'đã hủy'],
    default: 'đang hoạt động'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userPackageSchema.pre('save', function(next) {
  if (this.isModified('start_date') && !this.end_date) {
    const end = new Date(this.start_date);
    end.setMonth(end.getMonth() + this.duration_months);
    this.end_date = end;
  }
  next();
});

export default mongoose.model('UserPackage', userPackageSchema);
