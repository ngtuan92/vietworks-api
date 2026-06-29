import mongoose from 'mongoose';
import { CvUnlockCreditStatus } from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const cvUnlockCreditSchema = new mongoose.Schema({
  employerUserId: { type: objectId, ref: 'User', required: true },
  companyId: { type: objectId, ref: 'Company', default: null },
  packageId: { type: objectId, ref: 'ServicePackage', required: true },
  packageCode: { type: String, required: true },
  totalCredits: { type: Number, required: true },
  usedCredits: { type: Number, default: 0 },
  remainingCredits: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  expiredAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(CvUnlockCreditStatus), default: CvUnlockCreditStatus.ACTIVE },
  transactionId: { type: objectId, ref: 'Transaction', required: true }
}, { timestamps: true });

const CvUnlockCredit = mongoose.model('CvUnlockCredit', cvUnlockCreditSchema, 'cv_unlock_credits');
export default CvUnlockCredit;
