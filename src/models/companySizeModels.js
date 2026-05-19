import mongoose from 'mongoose';
import { CommonStatus, CompanySizeCode } from '../enums/masterDataEnums.js';

const companySizeSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(CompanySizeCode), required: true, unique: true },
  name: { type: String, required: true },
  minEmployees: { type: Number, required: true },
  maxEmployees: { type: Number, default: null },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const CompanySize = mongoose.model('CompanySize', companySizeSchema, 'company_sizes');
export default CompanySize;
