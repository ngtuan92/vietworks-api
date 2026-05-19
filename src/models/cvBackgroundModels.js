import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { CvBackgroundCategory } from '../enums/cvEnums.js';
import { objectId } from './sharedModels.js';

const cvBackgroundSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  imageUrl: { type: String, default: null },
  category: { type: String, enum: Object.values(CvBackgroundCategory), default: CvBackgroundCategory.DEFAULT },
  isPremium: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  createdBy: { type: objectId, ref: 'User', required: true }
}, { timestamps: true });

const CvBackground = mongoose.model('CvBackground', cvBackgroundSchema, 'cv_backgrounds');
export default CvBackground;
