import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const unlockedCandidateSchema = new mongoose.Schema({
  employerId: { type: objectId, ref: 'User', required: true },
  candidateId: { type: objectId, ref: 'User', required: true },
  cvId: { type: objectId, ref: 'UploadedCv', default: null },
  amountCharged: { type: Number, default: 0 },
  packageId: { type: objectId, ref: 'ServicePackage', default: null },
  packageName: { type: String, default: null },
  unlockedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

unlockedCandidateSchema.index({ employerId: 1, candidateId: 1 }, { unique: true });
unlockedCandidateSchema.index({ candidateId: 1 });

const UnlockedCandidate = mongoose.models.UnlockedCandidate || mongoose.model('UnlockedCandidate', unlockedCandidateSchema, 'unlocked_candidates');
export default UnlockedCandidate;