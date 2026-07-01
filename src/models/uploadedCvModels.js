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
  // ── Thêm bởi fix "Boost CV từ ví lỗi": Boost CV cập nhật các field này qua $set.
  // Nếu thiếu trong schema → Mongoose strict mode vẫn lưu vào DB nhưng query sort theo
  // isBoosted (Talent Pool) không hoạt động đáng tin cậy giữa các request.
  isPublic: { type: Boolean, default: true }, // Có hiện trong Talent Pool hay không
  isBoosted: { type: Boolean, default: false }, // Đang trong gói Boost CV (cache ưu tiên)
  boostedUntil: { type: Date, default: null }, // Hạn boost — null = không boost
  skills: [{ type: String }],
  summary: { type: String, default: null },
  experienceYears: { type: Number, default: null },
  location: {
    provinceCode: { type: String, default: null },
    provinceName: { type: String, default: null }
  },
  textExtractStatus: { type: String, enum: Object.values(TextExtractStatus), default: TextExtractStatus.NOT_EXTRACTED },
  extractedText: { type: String, default: null },
  aiReviewSummary: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: Object.values(CvStatus), default: CvStatus.ACTIVE }
}, { timestamps: true });

const UploadedCv = mongoose.model('UploadedCv', uploadedCvSchema, 'uploaded_cvs');
export default UploadedCv;
