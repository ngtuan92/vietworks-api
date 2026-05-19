import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { objectId } from './sharedModels.js';

const careerSchema = new mongoose.Schema({
  careerGroupId: { type: objectId, ref: 'CareerGroup', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const Career = mongoose.model('Career', careerSchema, 'careers');
export default Career;
