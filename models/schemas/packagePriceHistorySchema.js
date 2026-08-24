import mongoose from 'mongoose';

// Lịch sử giá gói tập: mỗi lần đổi giá tháng gốc / bảng giảm giá đều ghi 1 dòng.
// Hợp đồng (UserPackage) đã chốt giá cũ giữ nguyên total_price nên không bị ảnh hưởng.
const packagePriceHistorySchema = new mongoose.Schema({
  package_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true,
    index: true
  },
  // Giá tháng gốc áp dụng sau lần thay đổi này
  unit_price: {
    type: Number,
    required: true
  },
  unit_price_old: {
    type: Number,
    default: null
  },
  // Bảng giảm giá theo số tháng sau lần thay đổi này [{months, discount}]
  durations: [{
    months: Number,
    discount: Number
  }],
  durations_old: [{
    months: Number,
    discount: Number
  }],
  reason: {
    type: String,
    default: ''
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  changed_by_name: {
    type: String,
    default: ''
  },
  changed_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('PackagePriceHistory', packagePriceHistorySchema);
