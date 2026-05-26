// models/companyLocationModels.js
import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { objectId } from './sharedModels.js';

const companyLocationSchema = new mongoose.Schema({
  companyId: {
    type: objectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  addressLine: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    default: null,
    trim: true
  },
  ward: {
    type: String,
    default: null,
    trim: true
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: Object.values(CommonStatus),
    default: CommonStatus.ACTIVE
  }
}, {
  timestamps: true
});

companyLocationSchema.index({ companyId: 1 });
companyLocationSchema.index({ companyId: 1, isPrimary: 1 });

const CompanyLocation = mongoose.model(
  'CompanyLocation',
  companyLocationSchema,
  'company_locations'
);

export default CompanyLocation;