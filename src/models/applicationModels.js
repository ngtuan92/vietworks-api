import mongoose from 'mongoose';
import { ApplicationStatus } from '../enums/jobEnums.js';
import { locationSnapshotSchema, objectId } from './sharedModels.js';

const applicationSchema = new mongoose.Schema({
  jobId: { type: objectId, ref: 'Job', required: true },
  companyId: { type: objectId, ref: 'Company', required: true },
  jobseekerUserId: { type: objectId, ref: 'User', required: true },
  cvId: { type: objectId, ref: 'Cv', default: null },
  uploadedCvId: { type: objectId, ref: 'UploadedCv', default: null },
  expectedWorkLocation: { type: locationSnapshotSchema, default: null },
  status: { type: String, enum: Object.values(ApplicationStatus), default: ApplicationStatus.APPLIED },
  coverLetter: { type: String, default: null },
  personalDataAgreementAccepted: { type: Boolean, required: true },
  viewedAt: { type: Date, default: null },
  approvedMessage: { type: String, default: null },
  rejectionReason: { type: String, default: null },
  interviewInvitation: {
    interviewTime: { type: String },
    interviewType: { type: String, enum: ['ONLINE', 'OFFLINE'] },
    location: { type: String },
    contactPerson: { type: String },
    contactPhone: { type: String },
    note: { type: String },
    createdAt: { type: Date }
  },
  statusHistory: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema, 'applications');
export default Application;
