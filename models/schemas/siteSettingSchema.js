import mongoose from 'mongoose';

const siteSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'homepage',
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

siteSettingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('SiteSetting', siteSettingSchema);
