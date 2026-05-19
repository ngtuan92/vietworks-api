import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';

const careerGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: String,
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const CareerGroup = mongoose.model('CareerGroup', careerGroupSchema, 'career_groups');
export default CareerGroup;
