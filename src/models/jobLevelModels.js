import mongoose from 'mongoose';
import { CommonStatus, JobLevelCode } from '../enums/masterDataEnums.js';

const jobLevelSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(JobLevelCode), required: true, unique: true },
  name: { type: String, required: true },
  levelOrder: { type: Number, required: true },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const JobLevel = mongoose.model('JobLevel', jobLevelSchema, 'job_levels');
export default JobLevel;
