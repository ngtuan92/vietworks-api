import mongoose from 'mongoose';
import { CommonStatus, Currency, SalaryRangeCode } from '../enums/masterDataEnums.js';

const salaryRangeSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(SalaryRangeCode), required: true, unique: true },
  name: { type: String, required: true },
  minMillion: { type: Number, default: null },
  maxMillion: { type: Number, default: null },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const SalaryRange = mongoose.model('SalaryRange', salaryRangeSchema, 'salary_ranges');
export default SalaryRange;
