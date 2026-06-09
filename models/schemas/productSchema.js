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

  quantity: {
    type: Number,
    default: 0
  },

  description: {
    type: String,
    default: ''
  },

  importDate: { // Ngày nhập hàng (Thêm mới)
    type: Date,
    required: true
  },

  expiryDate: { // Ngày hết hạn (Thêm mới)
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
  }
});

export default mongoose.model('Product', productSchema);