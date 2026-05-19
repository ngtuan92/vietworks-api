import mongoose from 'mongoose';

export const objectId = mongoose.Schema.Types.ObjectId;

export const locationSnapshotSchema = new mongoose.Schema(
  {
    provinceCode: String,
    provinceName: String,
    districtCode: String,
    districtName: String,
    wardCode: String,
    wardName: String,
    detailAddress: String
  },
  { _id: false }
);

export const fileSchema = new mongoose.Schema(
  {
    fileUrl: String,
    fileName: String,
    fileType: String,
    fileSize: Number
  },
  { _id: false }
);

export const boostSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null }
  },
  { _id: false }
);
