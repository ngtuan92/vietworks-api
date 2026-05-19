import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';

const cvFontSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  cssFontFamily: { type: String, required: true },
  fontUrl: { type: String, required: true },
  previewText: String,
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const CvFont = mongoose.model('CvFont', cvFontSchema, 'cv_fonts');
export default CvFont;
