import mongoose from 'mongoose';
import { CvBackgroundType, CvStatus } from '../enums/cvEnums.js';
import { boostSchema, objectId } from './sharedModels.js';

const cvSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  title: { type: String, required: true },
  templateId: { type: objectId, ref: 'CvTemplate', required: true },
  style: {
    fontId: { type: objectId, ref: 'CvFont', default: null },
    themeColorId: { type: objectId, ref: 'CvThemeColor', default: null },
    backgroundType: { type: String, enum: Object.values(CvBackgroundType), default: CvBackgroundType.NONE },
    backgroundId: { type: objectId, ref: 'CvBackground', default: null },
    customBackgroundUrl: { type: String, default: null }
  },
  boost: { type: boostSchema, default: () => ({}) },
  aiReviewSummary: {
    lastReviewId: { type: objectId, ref: 'AiCvReview', default: null },
    lastOverallScore: { type: Number, default: null },
    lastMatchingScore: { type: Number, default: null },
    lastReviewedAt: { type: Date, default: null }
  },
  sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
  status: { type: String, enum: Object.values(CvStatus), default: CvStatus.ACTIVE }
}, { timestamps: true });

const Cv = mongoose.model('Cv', cvSchema, 'cvs');
export default Cv;
