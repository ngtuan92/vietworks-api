import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { objectId } from './sharedModels.js';

const careerPositionSchema = new mongoose.Schema({
  careerGroupId: { type: objectId, ref: 'CareerGroup', required: true },
  careerId: { type: objectId, ref: 'Career', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const CareerPosition = mongoose.model('CareerPosition', careerPositionSchema, 'career_positions');
export default CareerPosition;
