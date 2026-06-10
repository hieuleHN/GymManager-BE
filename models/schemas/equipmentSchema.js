import mongoose from 'mongoose';

const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  quantity: {
    type: Number,
    default: 1
  },

  status: {
    type: String,
    default: 'active'
  },

  supplier: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  purchaser: {
    type: String,
    required: true
  },

  warranty_period: {
    type: Number,
    default: 12
  },

  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Equipment', equipmentSchema);