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
  // Cost basis của túi — dùng để tính bù khi nâng cấp theo lượt (usage-based).
  // 'new' → = giá gói; 'upgrade' → = giá gói mới (túi mới mang giá trị notional gói mới).
  // Bảo toàn: hoàn tiền = pricePaid × (lượt còn / tổng lượt), không bao giờ vượt tiền đã vào.
  pricePaid: { type: Number, default: 0 },
  startedAt: { type: Date, required: true },
  expiredAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(CvUnlockCreditStatus), default: CvUnlockCreditStatus.ACTIVE },
  transactionId: { type: objectId, ref: 'Transaction', required: true }
}, { timestamps: true });

const CvUnlockCredit = mongoose.model('CvUnlockCredit', cvUnlockCreditSchema, 'cv_unlock_credits');
export default CvUnlockCredit;
