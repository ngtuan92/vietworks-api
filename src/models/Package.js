import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add package name']
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Please add package price']
  },
  currency: {
    type: String,
    default: 'VND'
  },
  duration: {
    type: Number,
    required: [true, 'Please add duration in days']
  },
  jobPostsAllowed: {
    type: Number,
    default: 1
  },
  featuredDays: {
    type: Number,
    default: 0
  },
  cvAccessLimit: {
    type: Number,
    default: 0
  },
  features: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Package = mongoose.model('Package', packageSchema);
export default Package;