import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  note: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: 500000
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: ''
  },
  vnpay_txn_ref: {
    type: String,
    default: ''
  },
  vnpay_bank_code: {
    type: String,
    default: ''
  },
  vnpay_bank_tran_no: {
    type: String,
    default: ''
  },
  vnpay_card_type: {
    type: String,
    default: ''
  },
  vnpay_transaction_no: {
    type: String,
    default: ''
  },
  payment_date: {
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

bookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Booking', bookingSchema);
