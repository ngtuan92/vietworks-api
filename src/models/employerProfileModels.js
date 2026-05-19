import mongoose from 'mongoose';
import { Gender } from '../enums/masterDataEnums.js';
import { objectId } from './sharedModels.js';

const employerProfileSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true, unique: true },
  companyId: { type: objectId, ref: 'Company', default: null },
  representativeName: { type: String, required: true },
  gender: { type: String, enum: Object.values(Gender), required: true },
  phone: { type: String, required: true }
}, { timestamps: true });

const EmployerProfile = mongoose.model('EmployerProfile', employerProfileSchema, 'employer_profiles');
export default EmployerProfile;
