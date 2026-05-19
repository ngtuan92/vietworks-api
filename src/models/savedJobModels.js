import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const savedJobSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  jobId: { type: objectId, ref: 'Job', required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const SavedJob = mongoose.model('SavedJob', savedJobSchema, 'saved_jobs');
export default SavedJob;
