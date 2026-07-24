import mongoose from 'mongoose';

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  supplier: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  purchaser: { type: String, required: true },
  description: { type: String, default: '' },
  warranty_period: { type: Number, default: 12 },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  createdAt: { type: Date, default: Date.now },
  reports: [{
    statusType: { type: String, enum: ['hoạt động', 'bảo trì', 'hỏng hóc', 'thiếu linh kiện'], default: 'hoạt động' },
    affectedQuantity: { type: Number, default: 1, min: 1 },
    reason: { type: String, required: true },
    reportedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'resolved'], default: 'pending' }
  }]
});

export default mongoose.model('Equipment', equipmentSchema);
