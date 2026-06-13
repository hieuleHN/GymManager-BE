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

export default mongoose.model('Package', packageSchema);
