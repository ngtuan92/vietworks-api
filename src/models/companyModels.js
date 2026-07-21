import mongoose from 'mongoose';
import { CompanyVerificationStatus } from '../enums/masterDataEnums.js';
import { fileSchema, locationSnapshotSchema, objectId } from './sharedModels.js';

const companySchema = new mongoose.Schema({
  ownerUserId: { type: objectId, ref: 'User', required: true },
  name: { type: String, required: true },
  taxCode: { type: String, required: true, unique: true },
  website: { type: String, default: null },
  industryIds: [{ type: objectId, ref: 'CompanyIndustry', required: true }],
  industryNameSnapshots: { type: [String], default: [] },
  size: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  coverUrl: { type: String, default: null },
  description: { type: String, required: true },
  locations: { type: [locationSnapshotSchema], default: [] },
  businessLicenseFile: { type: fileSchema, default: null },
  verificationStatus: { type: String, enum: Object.values(CompanyVerificationStatus), default: CompanyVerificationStatus.UNVERIFIED },
  verifiedBy: { type: objectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  followersCount: { type: Number, default: 0 }
}, { timestamps: true });

const Company = mongoose.model('Company', companySchema, 'companies');
export default Company;
