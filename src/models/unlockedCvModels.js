import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import { UnlockMethod } from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const unlockedCvSchema = new mongoose.Schema({
  employerUserId: { type: objectId, ref: 'User', required: true },
  companyId: { type: objectId, ref: 'Company', required: true },
  jobseekerUserId: { type: objectId, ref: 'User', required: true },
  cvId: { type: objectId, ref: 'Cv', required: true },
  unlockMethod: { type: String, enum: Object.values(UnlockMethod), required: true },
  cvUnlockCreditId: { type: objectId, ref: 'CvUnlockCredit', default: null },
  pricePaid: { type: Number, default: 0 },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  transactionId: { type: objectId, ref: 'Transaction', default: null },
  unlockedAt: { type: Date, default: Date.now }
}, { timestamps: false });

unlockedCvSchema.index({ employerUserId: 1, cvId: 1 }, { unique: true });

const UnlockedCv = mongoose.model('UnlockedCv', unlockedCvSchema, 'unlocked_cvs');
export default UnlockedCv;
