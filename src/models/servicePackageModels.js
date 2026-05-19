import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import {
  ServicePackageCode,
  ServicePackageTargetRole,
  ServicePackageType,
  ServicePackageUnit
} from '../enums/paymentEnums.js';

const servicePackageSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(ServicePackageCode), required: true, unique: true },
  name: { type: String, required: true },
  targetRole: { type: String, enum: Object.values(ServicePackageTargetRole), required: true },
  packageType: { type: String, enum: Object.values(ServicePackageType), required: true },
  price: { type: Number, required: true },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  durationDays: { type: Number, default: null },
  quantity: { type: Number, default: 1 },
  unit: { type: String, enum: Object.values(ServicePackageUnit), required: true },
  benefits: { type: mongoose.Schema.Types.Mixed, default: {} },
  description: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

const ServicePackage = mongoose.model('ServicePackage', servicePackageSchema, 'service_packages');
export default ServicePackage;
