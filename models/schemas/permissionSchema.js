import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    unique: true
  },
  permissions: [{
    feature: {
      type: String,
      required: true
    },
    actions: [{
      type: String,
      enum: ['view', 'create', 'read', 'update', 'delete'],
      required: true
    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

permissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Permission', permissionSchema);
