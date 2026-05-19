import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';

const companyIndustrySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const CompanyIndustry = mongoose.model('CompanyIndustry', companyIndustrySchema, 'company_industries');
export default CompanyIndustry;
