import mongoose from 'mongoose';

const messageReminderSchema = new mongoose.Schema({
  id_hoi_vien: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  id_huan_luyen_vien: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  loai: {
    type: String,
    enum: ['truc_tiep', 'ho_tro'],
    default: 'truc_tiep'
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipientRole: {
    type: String,
    enum: ['member', 'staff', 'admin'],
    required: true
  },
  noi_dung: {
    type: String,
    required: true
  },
  remindAt: {
    type: Date,
    required: true
  },
  fired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

messageReminderSchema.index({ remindAt: 1, fired: 1 });

export default mongoose.model('MessageReminder', messageReminderSchema);
