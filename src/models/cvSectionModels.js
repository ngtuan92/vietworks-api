import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { CvSectionCode } from '../enums/cvEnums.js';

const cvSectionSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(CvSectionCode), required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  icon: String,
  allowMultiple: { type: Boolean, default: false },
  allowMultipleItems: { type: Boolean, default: false },
  isRequired: { type: Boolean, default: false },
  defaultOrder: { type: Number, default: 0 },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE },
  isSystemCodeLocked: { type: Boolean, default: true }
}, { timestamps: true });

const CvSection = mongoose.model('CvSection', cvSectionSchema, 'cv_sections');
export default CvSection;
