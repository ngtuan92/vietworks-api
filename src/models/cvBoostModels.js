import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';

const cvBoostSchema = new mongoose.Schema({
  cvId: { type: objectId, ref: 'UploadedCV', required: true },
  userId: { type: objectId, ref: 'User', required: true },
  packageId: { type: objectId, ref: 'ServicePackage', required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(UserServicePackageStatus), default: UserServicePackageStatus.ACTIVE },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

cvBoostSchema.index({ cvId: 1, status: 1 });
cvBoostSchema.index({ userId: 1 });
cvBoostSchema.index({ endAt: 1 }, { expireAfterSeconds: 0 });

const CvBoost = mongoose.models.CvBoost || mongoose.model('CvBoost', cvBoostSchema, 'cv_boosts');
export default CvBoost;