import mongoose from 'mongoose';

const sensitiveKeywordSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  normalized: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['low', 'high'],
    default: 'high'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  note: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

sensitiveKeywordSchema.index({ normalized: 1 });
sensitiveKeywordSchema.index({ enabled: 1 });

export default mongoose.model('SensitiveKeyword', sensitiveKeywordSchema);
