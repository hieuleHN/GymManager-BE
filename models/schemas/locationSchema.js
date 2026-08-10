import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  title: {
    type: String
  },
  description: {
    type: String
  },
  address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
  },
  images: [
    {
      url: String,
      description: String
    }
  ],
  openTime: {
    type: String,
    default: '06:00'
  },
  closeTime: {
    type: String,
    default: '21:00'
  },
  bankName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  accountName: {
    type: String,
    default: ''
  },
  branch: {
    type: String,
    default: ''
  },
  qrImage: {
    type: String,
    default: ''
  },
  signature: {
    type: String,
    default: ''
  },
  enabledServices: {
    type: [String],
    default: []
  },
  serviceFees: [
    {
      _id: false,
      service_type: {
        type: String
      },
      hasFee: {
        type: Boolean,
        default: false
      },
      fee: {
        type: Number,
        default: 0
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Location', locationSchema);
