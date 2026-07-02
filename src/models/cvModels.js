import mongoose from 'mongoose';
import { CvBackgroundType, CvStatus } from '../enums/cvEnums.js';
import { boostSchema, objectId } from './sharedModels.js';

const cvSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  title: { type: String, required: true },
  templateId: { type: objectId, ref: 'CvTemplate', required: true },
  templateCode: { type: String, required: true, default: 'left-col' },
  templateSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  previewImageUrl: { type: String, default: null },
  style: {
    fontId: { type: mongoose.Schema.Types.Mixed, default: null }, 
    themeColorId: { type: String, default: null }, 
    backgroundType: { type: String, enum: Object.values(CvBackgroundType), default: CvBackgroundType.NONE },
    backgroundId: { type: objectId, ref: 'CvBackground', default: null },
    customBackgroundUrl: { type: String, default: null },
    fontSize: { type: String, default: 'medium' },
    density: { type: String, default: 'normal' },
    titleStyle: { type: String, default: 'underline' },
    avatarShape: { type: String, default: 'circle' }
  },
  boost: { type: boostSchema, default: () => ({}) },
  aiReviewSummary: {
    lastReviewId: { type: objectId, ref: 'AiCvReview', default: null },
    lastOverallScore: { type: Number, default: null },
    lastMatchingScore: { type: Number, default: null },
    lastReviewedAt: { type: Date, default: null }
  },
  sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
  isMain: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(CvStatus), default: CvStatus.ACTIVE }
}, { timestamps: true });

const Cv = mongoose.model('Cv', cvSchema, 'cvs');
export default Cv;
