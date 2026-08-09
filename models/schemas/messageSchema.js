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
    required: false,
    default: null
  },
  nguoi_gui_tin_nhan: {
    type: String,
    enum: ['hoi_vien', 'huan_luyen_vien'],
    required: true
  },
  loai: {
    type: String,
    enum: ['truc_tiep', 'ho_tro'],
    default: 'truc_tiep'
  },
  noi_dung: {
    type: String,
    required: true
  },
  thoi_gian_gui: {
    type: Date,
    default: Date.now
  },
  da_doc: {
    type: Boolean,
    default: false
  },
  da_thu_hoi: {
    type: Boolean,
    default: false
  },
  is_pinned: {
    type: Boolean,
    default: false
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flag_reasons: {
    type: [
      {
        keyword: { type: String, default: '' },
        level: { type: String, enum: ['low', 'high'], default: 'high' }
      }
    ],
    default: []
  },
  flag_status: {
    type: String,
    enum: ['pending', 'resolved', 'ignored'],
    default: 'pending'
  },
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: false,
    default: null
  },
  reply_noi_dung: {
    type: String,
    required: false,
    default: ''
  },
  reply_nguoi_gui: {
    type: String,
    required: false,
    default: ''
  },
  loai_tin_nhan: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  attachment: {
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    fileUrl: { type: String, default: '' }
  },
  attachments: {
    type: [
      {
        fileName: { type: String, default: '' },
        fileType: { type: String, default: '' },
        fileSize: { type: Number, default: 0 },
        fileUrl: { type: String, default: '' }
      }
    ],
    default: []
  }
});

messageSchema.index({ id_hoi_vien: 1, id_huan_luyen_vien: 1, thoi_gian_gui: -1 });
messageSchema.index({ loai: 1, id_hoi_vien: 1, thoi_gian_gui: -1 });

export default mongoose.model('Message', messageSchema);
