import mongoose from 'mongoose';

const vnpayGroupSchema = new mongoose.Schema({
  txnRef: { type: String, required: true, unique: true },
  bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  totalAmount: { type: Number, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  paid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

vnpayGroupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('VnpayGroup', vnpayGroupSchema);
