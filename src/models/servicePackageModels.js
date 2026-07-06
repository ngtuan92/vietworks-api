import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import {
  ServicePackageCode,
  ServicePackageTargetRole,
  ServicePackageType,
  ServicePackageUnit
} from '../enums/paymentEnums.js';

const servicePackageSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  targetRole: { type: String, enum: Object.values(ServicePackageTargetRole), required: true },
  packageType: { type: String, enum: Object.values(ServicePackageType), required: true },
  price: { type: Number, required: true },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  durationDays: { type: Number, default: null },
  quantity: { type: Number, default: 1 },
  unit: { type: String, enum: Object.values(ServicePackageUnit), required: true },
  benefits: {
    jobPostsAllowed: { type: Number, default: 0 },
    featuredDays: { type: Number, default: 0 },
    cvAccessLimit: { type: Number, default: 0 },
    aiPremiumAccess: { type: Boolean, default: false },
    priorityDisplay: { type: Boolean, default: false },
    // ── Field bổ sung cho spec v2.0 (seed data mới dùng) ──
    boostCv: { type: Boolean, default: false },
    priorityInTalentPool: { type: Boolean, default: false },
    priorityInApplicationList: { type: Boolean, default: false },
    topHomepage: { type: Boolean, default: false },
    topSearch: { type: Boolean, default: false },
    urgentBadge: { type: Boolean, default: false },
    unlockCvCount: { type: Number, default: 0 },
    aiReviewLimit: { type: Number, default: 0 }, // -1 = unlimited
    aiMatchJob: { type: Boolean, default: false },
    aiRankingCv: { type: Boolean, default: false },
    aiSummaryCv: { type: Boolean, default: false },
    aiMatchCandidate: { type: Boolean, default: false },
    autoApplyLimit: { type: Number, default: 0 },
    emailCandidateLimit: { type: Number, default: 0 },
    weeklyEmailSuggestion: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false }
  },
  description: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  sortOrder: { type: Number, default: 0 },
  // ── Field quy tắc nghiệp vụ (spec v2.0 §5-§7) ──
  // Trial = cấp miễn phí 1 lần cho user mới (không qua thanh toán)
  isFreeTrial: { type: Boolean, default: false },
  // Cho phép nâng cấp lên gói cao hơn (mặc định true cho time-based, false cho trial/unlock bundle)
  allowUpgrade: { type: Boolean, default: true },
  // Cho phép gia hạn (mua cùng gói đang active → cộng dồn expiredAt)
  allowRenew: { type: Boolean, default: true },
  // Cap refund khi nâng cấp, ví dụ 0.30 = hoàn tối đa 30% giá gói cũ (chỉ áp dụng cho Employer Premium Job)
  // Jobseeker Boost = 1.0 (full refund), Employer Premium = 0.30 (cap 30%), Trial = 0
  refundCapRatio: { type: Number, default: 1.0, min: 0, max: 1 },
  // Ngưỡng thời gian đã dùng để cho phép nâng cấp (vd: 0.5 = chỉ cho nâng cấp khi dùng < 50%)
  upgradeMaxUsedRatio: { type: Number, default: 0.5, min: 0, max: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ServicePackage = mongoose.model('ServicePackage', servicePackageSchema, 'service_packages');
export default ServicePackage;
