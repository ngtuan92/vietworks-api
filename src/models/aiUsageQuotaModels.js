import mongoose from 'mongoose';
import { AiFeature, AiQuotaPeriodType } from '../enums/aiEnums.js';
import { objectId } from './sharedModels.js';

const aiUsageQuotaSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  feature: { type: String, enum: Object.values(AiFeature), default: AiFeature.AI_CV_REVIEW },
  periodType: { type: String, enum: Object.values(AiQuotaPeriodType), required: true },
  periodKey: { type: String, required: true },
  usedCount: { type: Number, default: 0 },
  limitCount: { type: Number, required: true },
  isUnlimited: { type: Boolean, default: false },
  resetAt: { type: Date, required: true }
}, { timestamps: true });

aiUsageQuotaSchema.index({ userId: 1, feature: 1, periodType: 1, periodKey: 1 }, { unique: true });

const AiUsageQuota = mongoose.model('AiUsageQuota', aiUsageQuotaSchema, 'ai_usage_quotas');
export default AiUsageQuota;
