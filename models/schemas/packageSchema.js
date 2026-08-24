import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  description: String,
  duration_days: {
    type: Number,
    default: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Vòng đời gói: nháp -> đang bán -> tạm ngưng -> ngừng bán
  lifecycle_status: {
    type: String,
    enum: ['nháp', 'đang bán', 'tạm ngưng', 'ngừng bán'],
    default: 'nháp'
  },
  status_changed_at: {
    type: Date,
    default: null
  },
  status_changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  service_id: {
    type: Number,
    default: null
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  disciplineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discipline'
  },
  combo: {
    type: Boolean,
    default: false
  },
  disciplines: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discipline'
  }],
  features: [{
    type: String
  }],
  durations: [{
    months: { type: Number },
    discount: { type: Number }
  }],
  contractA: {
    type: String,
    default: ''
  },
  contractB: {
    type: String,
    default: ''
  },
  contractTerms: {
    type: String,
    default: ''
  },
  ptSessionsPerMonth: {
    type: Number,
    default: 0
  },
  isFullMonth: {
    type: Boolean,
    default: false
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
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

// Đồng bộ is_active với vòng đời: chỉ "đang bán" là hiện lên trang khách
packageSchema.pre('save', function (next) {
  if (this.isModified('lifecycle_status')) {
    this.is_active = this.lifecycle_status === 'đang bán';
  }
  next();
});

export default mongoose.model('Package', packageSchema);
