import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  type: {
    type: String,
    enum: ['topup', 'payment', 'refund', 'withdraw'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    default: 0
  },
  balanceAfter: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  vnpayTxnRef: {
    type: String,
    default: ''
  },
  vnpayTransactionNo: String,
  vnpayBankCode: String,
  vnpayBankTranNo: String,
  vnpayCardType: String,
  vnpayPayDate: String,
  description: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

walletTransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('WalletTransaction', walletTransactionSchema);
