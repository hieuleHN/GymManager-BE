import mongoose from 'mongoose';

const productReturnSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  returnDate: {
    type: Date,
    default: Date.now
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ProductReturn', productReturnSchema);