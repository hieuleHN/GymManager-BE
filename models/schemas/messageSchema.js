import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id_hoi_vien: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  id_huan_luyen_vien: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  nguoi_gui_tin_nhan: {
    type: String,
    enum: ['hoi_vien', 'huan_luyen_vien'],
    required: true
  },
  noi_dung: {
    type: String,
    required: true
  },
  thoi_gian_gui: {
    type: Date,
    default: Date.now
  },
  da_doc: { // tin nhắn đã được đọc hay chưa
    type: Boolean,
    default: false
  }
});

export default mongoose.model('Message', messageSchema);
