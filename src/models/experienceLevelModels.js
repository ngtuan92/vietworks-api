  import mongoose from 'mongoose';
  import { CommonStatus, ExperienceLevelCode } from '../enums/masterDataEnums.js';

  const experienceLevelSchema = new mongoose.Schema({
    code: { type: String, enum: Object.values(ExperienceLevelCode), required: true, unique: true },
    name: { type: String, required: true },
    minYear: { type: Number, required: true },
    maxYear: { type: Number, default: null },
    status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
  }, { timestamps: true });

  const ExperienceLevel = mongoose.model('ExperienceLevel', experienceLevelSchema, 'experience_levels');
  export default ExperienceLevel;
