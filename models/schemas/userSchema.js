import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  first_name: String,
  last_name: String,
  avatar: String,
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  locations: [
    {
      location_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
      },
      services: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service'
        }
      ]
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);
