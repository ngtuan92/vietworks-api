import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';

const jobBoostSchema = new mongoose.Schema({
  jobId: { type: objectId, ref: 'Job', required: true },
  employerId: { type: objectId, ref: 'User', required: true },
  packageId: { type: objectId, ref: 'ServicePackage', required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(UserServicePackageStatus), default: UserServicePackageStatus.ACTIVE },
  labelType: { type: String, enum: ['FEATURED', 'URGENT', 'HIGHLIGHT'], default: 'FEATURED' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

jobBoostSchema.index({ jobId: 1, status: 1 });
jobBoostSchema.index({ employerId: 1 });
jobBoostSchema.index({ endAt: 1 }, { expireAfterSeconds: 0 });

const JobBoost = mongoose.models.JobBoost || mongoose.model('JobBoost', jobBoostSchema, 'job_boosts');
export default JobBoost;