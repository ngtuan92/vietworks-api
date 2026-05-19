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
  packageId: { type: objectId, ref: 'ServicePackage', required: true },
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

const UserServicePackage = mongoose.model('UserServicePackage', userServicePackageSchema, 'user_service_packages');
export default UserServicePackage;
