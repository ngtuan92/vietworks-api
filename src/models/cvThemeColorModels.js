import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';

const cvThemeColorSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  primaryColor: { type: String, required: true },
  secondaryColor: { type: String, required: true },
  textColor: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const CvThemeColor = mongoose.model('CvThemeColor', cvThemeColorSchema, 'cv_theme_colors');
export default CvThemeColor;
