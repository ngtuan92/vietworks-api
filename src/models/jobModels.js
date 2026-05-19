import mongoose from 'mongoose';
import { JobStatus, PremiumDeactivatedReason, SalaryType, SaturdayPolicy } from '../enums/jobEnums.js';
import { locationSnapshotSchema, objectId } from './sharedModels.js';

const jobSchema = new mongoose.Schema({
  companyId: { type: objectId, ref: 'Company', required: true },
  createdBy: { type: objectId, ref: 'User', required: true },
  title: { type: String, required: true },
  careerGroupId: { type: objectId, ref: 'CareerGroup', required: true },
  careerId: { type: objectId, ref: 'Career', required: true },
  careerPositionId: { type: objectId, ref: 'CareerPosition', required: true },
  jobLevelId: { type: objectId, ref: 'JobLevel', required: true },
  experienceLevelId: { type: objectId, ref: 'ExperienceLevel', required: true },
  skills: [{ type: objectId, ref: 'Skill' }],
  salary: {
    type: { type: String, enum: Object.values(SalaryType), default: SalaryType.NEGOTIABLE },
    minMillion: { type: Number, default: null },
    maxMillion: { type: Number, default: null },
    currency: { type: String, default: 'VND' }
  },
  workLocations: { type: [locationSnapshotSchema], default: [] },
  saturdayPolicy: { type: String, enum: Object.values(SaturdayPolicy), default: SaturdayPolicy.NOT_SPECIFIED },
  description: { type: String, required: true },
  requirements: { type: String, required: true },
  benefits: { type: String, required: true },
  workingTime: { type: String, required: true },
  applyInstruction: { type: String, required: true },
  deadline: { type: Date, required: true },
  status: { type: String, enum: Object.values(JobStatus), default: JobStatus.DRAFT },
  isUrgent: { type: Boolean, default: false },
  premium: {
    isActive: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
    deactivatedReason: { type: String, enum: Object.values(PremiumDeactivatedReason), default: null }
  },
  publishedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  rejectedReason: { type: String, default: null },
  bannedReason: { type: String, default: null }
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema, 'jobs');
export default Job;
