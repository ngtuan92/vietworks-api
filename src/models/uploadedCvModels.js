import mongoose from 'mongoose';
import { CvStatus, TextExtractStatus } from '../enums/cvEnums.js';
import { objectId } from './sharedModels.js';

const uploadedCvSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  title: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  textExtractStatus: { type: String, enum: Object.values(TextExtractStatus), default: TextExtractStatus.NOT_EXTRACTED },
  extractedText: { type: String, default: null },
  aiReviewSummary: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: Object.values(CvStatus), default: CvStatus.ACTIVE }
}, { timestamps: true });

const UploadedCv = mongoose.model('UploadedCv', uploadedCvSchema, 'uploaded_cvs');
export default UploadedCv;
