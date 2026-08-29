import mongoose from 'mongoose';

// Audit log: ghi lại ai / làm gì / với đối tượng nào / khi nào, kèm giá trị trước-sau
const auditLogSchema = new mongoose.Schema({
  actor_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  actor_name: {
    type: String,
    default: ''
  },
  actor_role: {
    type: String,
    default: ''
  },
  // Ví dụ: PACKAGE_CREATE, PACKAGE_UPDATE, PACKAGE_LIFECYCLE_CHANGE, PRICE_CHANGE,
  // PACKAGE_DELETE_BLOCKED, PACKAGE_DELETE, REGISTRATION_APPROVE, REGISTRATION_REJECT,
  // ADMIN_RENEW_CREATE, PAYMENT_REMIND, RENEWAL_REMIND_BULK, PAYMENT_CONFIRM ...
  action: {
    type: String,
    required: true,
    index: true
  },
  entity_type: {
    type: String,
    index: true
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  entity_name: {
    type: String,
    default: ''
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
