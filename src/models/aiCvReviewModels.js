import mongoose from 'mongoose';
import {
  AiCvType,
  AiFeedbackCategory,
  AiFeedbackSeverity,
  AiJdInputType,
  AiReviewStatus
} from '../enums/aiEnums.js';
import { objectId } from './sharedModels.js';

const aiCvReviewSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  cvType: { type: String, enum: Object.values(AiCvType), required: true },
  cvId: { type: objectId, ref: 'Cv', default: null },
  uploadedCvId: { type: objectId, ref: 'UploadedCv', default: null },
  jdInputType: { type: String, enum: Object.values(AiJdInputType), default: AiJdInputType.NONE },
  jdText: { type: String, default: null },
  jobId: { type: objectId, ref: 'Job', default: null },
  status: { type: String, enum: Object.values(AiReviewStatus), default: AiReviewStatus.PENDING },
  score: { type: mongoose.Schema.Types.Mixed, default: {} },
  jdMatching: { type: mongoose.Schema.Types.Mixed, default: {} },
  feedback: {
    type: [{
      category: { type: String, enum: Object.values(AiFeedbackCategory), required: true },
      severity: { type: String, enum: Object.values(AiFeedbackSeverity), required: true },
      message: { type: String, required: true },
      suggestion: { type: String, required: true }
    }],
    default: []
  },
  aiProvider: { type: String, required: true },
  aiModel: { type: String, required: true },
  tokenUsage: { type: mongoose.Schema.Types.Mixed, default: null },
  rawResult: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: null }
}, { timestamps: true });

const AiCvReview = mongoose.model('AiCvReview', aiCvReviewSchema, 'ai_cv_reviews');
export default AiCvReview;
