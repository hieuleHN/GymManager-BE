import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  salary: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String
  },
  permissions: [{
    type: String
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

jobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Job', jobSchema);