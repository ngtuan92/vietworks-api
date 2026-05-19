import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const followedCompanySchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  companyId: { type: objectId, ref: 'Company', required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

followedCompanySchema.index({ userId: 1, companyId: 1 }, { unique: true });

const FollowedCompany = mongoose.model('FollowedCompany', followedCompanySchema, 'followed_companies');
export default FollowedCompany;
