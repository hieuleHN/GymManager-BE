import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  price: {
    type: Number,
    required: true
  },

  costPrice: {
    type: Number,
    default: 0
  },

  quantity: {
    type: Number,
    default: 0
  },

  sold: {
    type: Number,
    default: 0
  },

  description: {
    type: String,
    default: ''
  },

  image: { // 🌟 Đường dẫn ảnh sản phẩm (Thêm mới để khớp giao diện)
    type: String,
    default: ''
  },

  importDate: {
    type: Date,
    required: true
  },

  expiryDate: {
    type: Date,
    required: true
  },

  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  reports: [{
    reason: { type: String, required: true },
    reportedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending'
    }
  }]
});

export default mongoose.model('Product', productSchema);