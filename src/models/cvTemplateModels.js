import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { objectId } from './sharedModels.js';

const cvTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  careerGroupId: { type: objectId, ref: 'CareerGroup', required: true },
  thumbnailUrl: { type: String, required: true },
  previewImageUrl: { type: String, required: true },
  description: String,
  templateCode: { type: String, required: true },
  layoutConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  isPremium: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  createdBy: { type: objectId, ref: 'User', required: true }
}, { timestamps: true });

const CvTemplate = mongoose.model('CvTemplate', cvTemplateSchema, 'cv_templates');
export default CvTemplate;
