import mongoose from 'mongoose';
import { UserRole, AccountStatus, AuthProvider } from '../enums/userEnums.js';
import { hashPassword, comparePassword } from '../utils/authUtils.js';

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'Please add a role']
  },
  fullName: {
    type: String,
    required: [true, 'Please add a full name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  passwordHash: {
    type: String,
    required: function() {
      return this.authProvider === AuthProvider.LOCAL;
    },
    select: false
  },
  phone: {
    type: String
  },
  accountStatus: {
    type: String,
    enum: Object.values(AccountStatus),
    default: AccountStatus.UNVERIFIED
  },
  authProvider: {
    type: String,
    enum: Object.values(AuthProvider),
    default: AuthProvider.LOCAL
  },
  banReason: {
    type: String,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  emailVerification: {
    otpCodeHash: {
      type: String,
      default: null,
      select: false
    },
    otpExpiresAt: {
      type: Date,
      default: null
    },
    otpLastSentAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    }
  },
  passwordReset: {
    tokenHash: {
      type: String,
      default: null,
      select: false
    },
    expiresAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }
  this.passwordHash = await hashPassword(this.passwordHash);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await comparePassword(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema, 'users');
export default User;

