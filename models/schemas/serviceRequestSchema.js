import mongoose from 'mongoose';

export const SERVICE_TYPES = [
  'freeze',
  'activate',
  'reactivate-expired',
  'transfer',
  'change-club',
  'contract',
  'support',
  'cancel-refund',
  'locker',
  'complaint'
];

export const SERVICE_STATUSES = ['pending', 'awaiting_payment', 'accepted', 'rejected', 'cancelled'];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

const serviceRequestSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customer_name: {
    type: String,
    default: ''
  },
  customer_phone: {
    type: String,
    default: ''
  },
  service_type: {
    type: String,
    required: true,
    enum: SERVICE_TYPES
  },
  description: {
    type: String,
    default: ''
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  status: {
    type: String,
    enum: SERVICE_STATUSES,
    default: 'pending'
  },
  amount: {
    type: Number,
    default: 0
  },
  payment_status: {
    type: String,
    enum: PAYMENT_STATUSES,
    default: 'unpaid'
  },
  payment_method: {
    type: String,
    default: ''
  },
  paid_at: {
    type: Date,
    default: null
  },
  vnpay_txn_ref: {
    type: String,
    default: ''
  },
  vnpay_transaction_no: {
    type: String,
    default: ''
  },
  vnpay_bank_code: {
    type: String,
    default: ''
  },
  refund_amount: {
    type: Number,
    default: 0
  },
  refunded_at: {
    type: Date,
    default: null
  },
  admin_note: {
    type: String,
    default: ''
  },
  processed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  processed_at: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ServiceRequest', serviceRequestSchema);
