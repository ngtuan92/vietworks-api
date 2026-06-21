import mongoose from 'mongoose';
import { CommonStatus, JobLevelCode } from '../enums/masterDataEnums.js';

const jobLevelSchema = new mongoose.Schema({
  // Không còn liên kết cứng với careerGroupId để dùng chung toàn hệ thống
  code: {
  type: String,
  required: true,
  trim: true // Tự động loại bỏ khoảng trắng thừa hai đầu
},  name: { type: String, required: true },
  levelOrder: { type: Number, required: true },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const JobLevel = mongoose.model('JobLevel', jobLevelSchema, 'job_levels');
export default JobLevel;
