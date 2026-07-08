import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import {
  PackageTargetType,
  ServicePackageType,
  UserServicePackageStatus
} from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const userServicePackageSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  companyId: { type: objectId, ref: 'Company', default: null },
  packageId: { type: objectId, required: true }, // Removed ref
  // ── Snapshot là dữ liệu phái sinh từ ServicePackage; khi ServicePackage bị sửa/xoá
  // sau này, subscription vẫn đọc được từ snapshot. Trước đây required: true → dễ vỡ
  // khi controller truyền field undefined (vd: gói unlock có durationDays=null).
  // Relax về optional + có default null để create không bao giờ chặn user.
  packageSnapshot: {
    id: { type: objectId, default: null },
    code: { type: String, default: null },
    name: { type: String, default: null },
    type: { type: String, default: null },
    price: { type: Number, default: null },
    durationDays: { type: Number, default: null },
    aiPremiumAccess: { type: Boolean, default: false }
  },
  packageCode: { type: String, required: true },
  packageType: { type: String, enum: Object.values(ServicePackageType), required: true },
  targetType: { type: String, enum: Object.values(PackageTargetType), required: true },
  targetId: { type: objectId, required: true },
  startedAt: { type: Date, required: true },
  expiredAt: { type: Date, default: null },
  status: { type: String, enum: Object.values(UserServicePackageStatus), default: UserServicePackageStatus.ACTIVE },
  pricePaid: { type: Number, required: true },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  transactionId: { type: objectId, ref: 'Transaction', required: true },
  cancelledReason: { type: String, default: null },
  cancelledAt: { type: Date, default: null },
  refundAmount: { type: Number, default: 0 }
}, { timestamps: true });

// Index để query nhanh "user X có gói active nào cho target Y" (chặn mua trùng)
userServicePackageSchema.index({ userId: 1, targetType: 1, targetId: 1, status: 1 });
// Index để query "danh sách gói đang active của user" (MySubscriptions page)
userServicePackageSchema.index({ userId: 1, status: 1, expiredAt: 1 });
// TTL: tự xoá record đã hết hạn sau 30 ngày (giữ lịch sử ngắn hạn)
userServicePackageSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const UserServicePackage = mongoose.model('UserServicePackage', userServicePackageSchema, 'user_service_packages');
export default UserServicePackage;
